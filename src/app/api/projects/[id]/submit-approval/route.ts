import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, approvalRequests, approvalSteps, users, notifications } from '@/lib/db/schema'
import { eq, and, inArray, isNull } from 'drizzle-orm'
import { canEditProject } from '@/lib/roles'
import { allTasksChecked } from '@/lib/projects'

/**
 * Submit a project's RESULTS for review. Enabled only once every task is checked
 * ("✓ Selesai"). Runs the same 3-step ladder — SPV → Manager → Direktur — but it now
 * reviews the *output* of a finished project, not its creation.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [project] = await db.select({
    id: projects.id, name: projects.name, picId: projects.picId, status: projects.status,
  }).from(projects).where(eq(projects.id, id)).limit(1)
  if (!project) return NextResponse.json({ error: 'Project tidak ditemukan' }, { status: 404 })

  // Only the PIC or a leader+/manager/director/super_admin may submit the results.
  const allowed = project.picId === session.id || canEditProject(session.role)
  if (!allowed) return NextResponse.json({ error: 'Tidak punya akses untuk mengirim hasil project' }, { status: 403 })

  if (project.status === 'Completed') {
    return NextResponse.json({ error: 'Project sudah selesai & disetujui' }, { status: 400 })
  }

  // Block re-submission if an approval is already pending (regardless of project status).
  const [existingPending] = await db
    .select({ id: approvalRequests.id })
    .from(approvalRequests)
    .where(and(eq(approvalRequests.relatedEntityId, id), eq(approvalRequests.status, 'Pending')))
    .limit(1)
  if (existingPending) {
    return NextResponse.json({ error: 'Project sudah dalam proses review, tunggu hasil approval sebelumnya.' }, { status: 400 })
  }

  // Gate: need at least 1 task checked.
  const { ready, total, done } = await allTasksChecked(id)
  if (!ready) {
    return NextResponse.json({
      error: `Centang minimal 1 task sebelum mengirim hasil (${done}/${total} di-centang).`,
    }, { status: 400 })
  }

  // Drop any prior rejected/revised approval before creating a new one.
  await db.delete(approvalRequests).where(eq(approvalRequests.relatedEntityId, id))

  // Approval ladder. If submitter is the SPV (leader_divisi), step 1 is auto-approved.
  const submitterIsSPV = session.role === 'leader_divisi'
  const startStep = submitterIsSPV ? 2 : 1

  const approverUsers = await db.select({ id: users.id, role: users.role }).from(users)
    .where(and(eq(users.isActive, true), inArray(users.role, ['leader_divisi', 'spv_manager', 'head_director'])))

  const [approvalReq] = await db.insert(approvalRequests).values({
    type: 'project',
    relatedEntityType: 'project',
    relatedEntityId: id,
    requestedBy: session.id,
    currentStep: startStep,
    status: 'Pending',
  }).returning()

  const STEP_MAP = [
    { step: 1, dbRole: 'leader_divisi', role: 'spv' as const },
    { step: 2, dbRole: 'spv_manager',   role: 'manager' as const },
    { step: 3, dbRole: 'head_director', role: 'director' as const },
  ]
  const steps = STEP_MAP.map(s => ({
    approvalRequestId: approvalReq.id,
    stepOrder: s.step,
    approverRole: s.role,
    approverUserId: s.step === 1 && submitterIsSPV ? session.id : (approverUsers.find(u => u.role === s.dbRole)?.id ?? null),
    action: (s.step === 1 && submitterIsSPV ? 'approve' : 'pending') as 'approve' | 'pending',
    actedAt: s.step === 1 && submitterIsSPV ? new Date() : null,
    note: s.step === 1 && submitterIsSPV ? 'Auto-approved: diajukan oleh SPV' : null,
  }))
  await db.insert(approvalSteps).values(steps)

  await db.update(projects).set({
    status: 'Need Review',
    approvalStatus: 'Pending',
    currentApprovalStep: startStep,
    updatedAt: new Date(),
  }).where(eq(projects.id, id))

  // Notify the current approver (in-app only).
  const currentApprover = steps.find(s => s.stepOrder === startStep)?.approverUserId
  if (currentApprover && currentApprover !== session.id) {
    await db.insert(notifications).values({
      userId: currentApprover,
      title: 'Review hasil project',
      message: `${session.fullName} mengirim hasil project "${project.name}" untuk direview`,
      type: 'approval_request',
      relatedEntityType: 'project',
      relatedEntityId: id,
    })
  }

  return NextResponse.json({ ok: true })
}
