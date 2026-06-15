import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, divisions, users, tasks, taskAssignees } from '@/lib/db/schema'
import { eq, isNull, asc, and, inArray } from 'drizzle-orm'
import { canEditProject } from '@/lib/roles'
import { EditProjectForm } from './edit-project-form'

export const metadata = { title: 'Edit Project — Terminal Workdesk' }

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canEditProject(session.role)) redirect(`/projects/${id}`)

  const [projRow] = await db.select({
    id: projects.id, name: projects.name, projectCode: projects.projectCode,
    divisionId: projects.divisionId, projectType: projects.projectType,
    objective: projects.objective, deliverables: projects.deliverables,
    startDate: projects.startDate, deadline: projects.deadline,
    priority: projects.priority, budgetPlanned: projects.budgetPlanned,
    attachmentUrl: projects.attachmentUrl, notes: projects.notes,
    status: projects.status,
  }).from(projects).where(eq(projects.id, id)).limit(1)

  if (!projRow) notFound()

  const [divisionRows, memberRows, taskRows] = await Promise.all([
    db.select({ id: divisions.id, name: divisions.name })
      .from(divisions).where(isNull(divisions.deletedAt)).orderBy(asc(divisions.name)),
    db.select({ id: users.id, fullName: users.fullName, role: users.role })
      .from(users).where(eq(users.isActive, true)).orderBy(asc(users.fullName)),
    db.select({ id: tasks.id, name: tasks.name, priority: tasks.priority, dueDate: tasks.dueDate })
      .from(tasks)
      .where(and(eq(tasks.projectId, id), isNull(tasks.deletedAt)))
      .orderBy(asc(tasks.createdAt)),
  ])

  const taskIds = taskRows.map(t => t.id)
  const assigneeRows = taskIds.length
    ? await db.select({ taskId: taskAssignees.taskId, userId: users.id, fullName: users.fullName })
        .from(taskAssignees).leftJoin(users, eq(taskAssignees.userId, users.id))
        .where(inArray(taskAssignees.taskId, taskIds))
    : []

  const assigneeMap = new Map<string, { id: string; fullName: string }[]>()
  for (const a of assigneeRows) {
    if (!a.userId) continue
    const arr = assigneeMap.get(a.taskId) ?? []
    arr.push({ id: a.userId, fullName: a.fullName ?? '?' })
    assigneeMap.set(a.taskId, arr)
  }

  const existingTasks = taskRows.map(t => ({
    id: t.id,
    name: t.name,
    priority: t.priority ?? 'Medium',
    dueDate: t.dueDate instanceof Date
      ? t.dueDate.toISOString().slice(0, 10)
      : String(t.dueDate ?? '').slice(0, 10),
    assignees: assigneeMap.get(t.id) ?? [],
  }))

  return (
    <EditProjectForm
      project={projRow as any}
      divisions={divisionRows}
      members={memberRows as any[]}
      existingTasks={existingTasks}
    />
  )
}
