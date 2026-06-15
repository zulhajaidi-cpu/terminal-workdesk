import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, projectMembers, tasks, taskAssignees } from '@/lib/db/schema'
import { canCreateProject } from '@/lib/roles'

function generateProjectCode(): string {
  const now = new Date()
  const yr = now.getFullYear().toString().slice(-2)
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000 + 1000)
  return `PRJ-${yr}${mo}-${rand}`
}

/**
 * Create a project. Projects are now created as **Draft** — approval is no longer a
 * gate to *start* a project. Instead, once all of a project's tasks are checked
 * ("✓ Selesai"), the PIC submits the *results* for review via
 * POST /api/projects/[id]/submit-approval (SPV → Manager → Direktur).
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || !canCreateProject(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const {
    name, divisionId, projectType, picId, objective, deliverables,
    startDate, deadline, priority, budgetPlanned, attachmentUrl,
    notes, members, initialTasks,
  } = body

  if (!name || !divisionId || !startDate || !deadline || !objective || !deliverables) {
    return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
  }

  // --- Insert project (always Draft) ---
  const [project] = await db.insert(projects).values({
    projectCode: generateProjectCode(),
    name,
    divisionId,
    projectType: projectType ?? 'General',
    picId: picId ?? session.id,
    objective,
    deliverables,
    startDate,
    deadline,
    priority: priority ?? 'Medium',
    status: 'Draft',
    budgetPlanned: budgetPlanned ? Number(budgetPlanned) : null,
    attachmentUrl: attachmentUrl || null,
    notes: notes || null,
    approvalStatus: null,
    currentApprovalStep: null,
    createdBy: session.id,
  }).returning()

  const memberIds = Array.from(new Set([session.id, picId, ...(members ?? [])].filter(Boolean)))

  // --- Members + initial tasks in parallel ---
  const insertTasks = (initialTasks ?? []).length > 0
    ? db.insert(tasks).values(
        (initialTasks as any[]).map((t: any) => ({
          name: t.name,
          projectId: project.id,
          divisionId,
          priority: t.priority ?? 'Medium',
          dueDate: new Date(t.dueDate ?? deadline),
          description: t.description || null,
          status: 'To Do' as const,
          createdBy: session.id,
          requiresApproval: false,
          isOverdue: false,
          checked: false,
        }))
      ).returning()
    : Promise.resolve([])

  const insertMembers = db.insert(projectMembers).values(
    memberIds.map(uid => ({ projectId: project.id, userId: uid as string }))
  )

  const [createdTasks] = await Promise.all([insertTasks, insertMembers])

  // --- Task assignees ---
  if (Array.isArray(createdTasks) && createdTasks.length > 0) {
    const taskAssigneeRows: { taskId: string; userId: string }[] = []
    for (let i = 0; i < createdTasks.length; i++) {
      const t = (initialTasks as any[])[i]
      if (t.assignees?.length > 0) {
        taskAssigneeRows.push(...t.assignees.map((uid: string) => ({ taskId: createdTasks[i].id, userId: uid })))
      }
    }
    if (taskAssigneeRows.length > 0) await db.insert(taskAssignees).values(taskAssigneeRows)
  }

  return NextResponse.json({ id: project.id, projectCode: project.projectCode }, { status: 201 })
}
