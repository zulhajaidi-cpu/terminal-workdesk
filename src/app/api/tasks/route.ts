import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { tasks, taskAssignees } from '@/lib/db/schema'
import { recalcProjectProgress } from '@/lib/projects'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    name,
    projectId, project_id,
    divisionId, division_id,
    priority,
    dueDate, due_date,
    description, assignees,
    category, progressPct,
  } = body

  const resolvedProjectId = projectId || project_id || null
  const resolvedDivisionId = divisionId || division_id
  const resolvedDueDate = dueDate || due_date

  if (!name || !resolvedDivisionId || !resolvedDueDate) {
    return NextResponse.json({ error: 'Nama task, divisi, dan due date wajib diisi' }, { status: 400 })
  }

  const [task] = await db.insert(tasks).values({
    name,
    projectId: resolvedProjectId,
    divisionId: resolvedDivisionId,
    priority: priority ?? 'Medium',
    dueDate: new Date(resolvedDueDate),
    description: description || null,
    status: body.status ?? 'To Do',
    createdBy: session.id,
    requiresApproval: false,
    isOverdue: false,
    ...(category ? { category } : {}),
    ...(progressPct !== undefined ? { progressPct } : {}),
  }).returning({ id: tasks.id })

  if (assignees && assignees.length > 0) {
    await db.insert(taskAssignees).values(
      assignees.map((uid: string) => ({ taskId: task.id, userId: uid }))
    )
  }

  // A new (unchecked) task lowers the project's derived progress — keep it in sync.
  if (resolvedProjectId) await recalcProjectProgress(resolvedProjectId)

  return NextResponse.json({ ok: true, id: task.id })
}
