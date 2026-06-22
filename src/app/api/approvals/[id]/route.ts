import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { approvalRequests, approvalSteps, projects, projectMembers, notifications } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { canApprove } from '@/lib/roles'
import { awardProjectExp } from '@/lib/exp'

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Hanya Super Admin yang bisa menghapus approval' }, { status: 403 })
  }
  const [req] = await db.select({ id: approvalRequests.id }).from(approvalRequests).where(eq(approvalRequests.id, id)).limit(1)
  if (!req) return NextResponse.json({ error: 'Approval tidak ditemukan' }, { status: 404 })
  // approvalSteps cascade deletes automatically (onDelete: 'cascade')
  await db.delete(approvalRequests).where(eq(approvalRequests.id, id))
  return NextResponse.json({ ok: true })
}

const ROLE_STEP: Record<string, number> = {
  leader_divisi: 1, spv_manager: 2, head_director: 3, super_admin: 3,
}
const STEP_APPROVER_ROLE: Record<number, 'spv' | 'manager' | 'director'> = {
  1: 'spv', 2: 'manager', 3: 'director',
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || !canApprove(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { action, note } = await request.json()
  if (!['approve', 'reject', 'revision'].includes(action)) {
    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 })
  }

  const [req] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, id)).limit(1)
  if (!req) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

  const myStep = ROLE_STEP[session.role]
  if (req.currentStep !== myStep) {
    return NextResponse.json({ error: 'Bukan giliran Anda untuk menyetujui' }, { status: 403 })
  }

  // Update step
  await db.update(approvalSteps)
    .set({ action, note: note || null, actedAt: new Date(), approverUserId: session.id })
    .where(and(eq(approvalSteps.approvalRequestId, id), eq(approvalSteps.stepOrder, myStep)))

  const projectId = req.relatedEntityId
  const [proj] = await db.select({ name: projects.name, picId: projects.picId })
    .from(projects).where(eq(projects.id, projectId)).limit(1)
  const projName = proj?.name ?? 'Project'

  let newRequestStatus: 'Pending' | 'Approved' | 'Rejected' = 'Pending'
  let newProjectStatus: string | null = null
  let nextStep = req.currentStep
  // Reviewing the *results*: final approve completes the project; reject/revision sends it back.
  if (action === 'approve') {
    if (myStep >= 3) {
      newRequestStatus = 'Approved'
      newProjectStatus = 'Completed'
    } else {
      nextStep = myStep + 1
    }
  } else if (action === 'reject') {
    newRequestStatus = 'Rejected'
    newProjectStatus = 'In Progress'   // hasil ditolak → kembali dikerjakan
  } else if (action === 'revision') {
    newRequestStatus = 'Rejected'      // requester must fix & re-submit
    newProjectStatus = 'Revision'
  }

  await db.update(approvalRequests)
    .set({ status: newRequestStatus, currentStep: nextStep, updatedAt: new Date() })
    .where(eq(approvalRequests.id, id))

  if (newProjectStatus) {
    await db.update(projects)
      .set({
        status: newProjectStatus as any,
        approvalStatus: newRequestStatus,
        currentApprovalStep: action === 'approve' ? myStep : null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
  } else {
    await db.update(projects)
      .set({ currentApprovalStep: nextStep, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
  }

  /* ── In-app notifications ──────────────────────────────── */
  const notifValues: {
    userId: string; title: string; message: string
    type: 'approval_request' | 'approval_result' | 'revision_requested' | 'project_done'
    relatedEntityType: string; relatedEntityId: string
  }[] = []

  if (action === 'approve' && newProjectStatus === null) {
    // Advanced a step → ping the next approver
    const [next] = await db.select({ uid: approvalSteps.approverUserId })
      .from(approvalSteps)
      .where(and(eq(approvalSteps.approvalRequestId, id), eq(approvalSteps.stepOrder, nextStep)))
      .limit(1)
    if (next?.uid && next.uid !== session.id) {
      notifValues.push({
        userId: next.uid, title: 'Review hasil project',
        message: `Hasil project "${projName}" menunggu persetujuan Anda`,
        type: 'approval_request', relatedEntityType: 'project', relatedEntityId: projectId,
      })
    }
  } else if (newProjectStatus === 'Completed') {
    // Final approval → notify requester + PIC + members
    const members = await db.select({ uid: projectMembers.userId })
      .from(projectMembers).where(eq(projectMembers.projectId, projectId))
    const recipients = new Set<string>([req.requestedBy, ...(proj?.picId ? [proj.picId] : []), ...members.map(m => m.uid)])
    recipients.delete(session.id)
    for (const uid of recipients) {
      notifValues.push({
        userId: uid, title: 'Project disetujui & selesai 🎉',
        message: `Hasil project "${projName}" telah disetujui penuh. Status: Completed.`,
        type: 'project_done', relatedEntityType: 'project', relatedEntityId: projectId,
      })
    }
  } else if (req.requestedBy !== session.id) {
    // Reject / revision → notify the submitter
    notifValues.push({
      userId: req.requestedBy,
      title: action === 'revision' ? 'Hasil project perlu revisi' : 'Hasil project ditolak',
      message: `"${projName}": ${action === 'revision' ? 'diminta revisi' : 'ditolak'}${note ? ` — "${note}"` : ''}`,
      type: action === 'revision' ? 'revision_requested' : 'approval_result',
      relatedEntityType: 'project', relatedEntityId: projectId,
    })
  }

  if (notifValues.length > 0) await db.insert(notifications).values(notifValues)

  // Auto-award EXP project ke seluruh tim saat project final-approved (dedup di helper).
  if (newProjectStatus === 'Completed') {
    try { await awardProjectExp(projectId, session.id) } catch (e) { console.error('awardProjectExp failed:', e) }
  }

  return NextResponse.json({ ok: true })
}
