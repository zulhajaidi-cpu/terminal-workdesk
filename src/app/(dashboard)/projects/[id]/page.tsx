import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, divisions, users, projectMembers, tasks, taskAssignees, approvalRequests, approvalSteps, projectComments } from '@/lib/db/schema'
import { eq, isNull, asc, desc, and, inArray, ne } from 'drizzle-orm'
import { ProjectDetailContent } from './project-detail-content'

export const metadata = { title: 'Detail Project — Terminal Workdesk' }

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const [projectRows] = await db.select({
    id: projects.id, name: projects.name, projectCode: projects.projectCode,
    objective: projects.objective, deliverables: projects.deliverables,
    status: projects.status, priority: projects.priority, progress: projects.progress,
    startDate: projects.startDate, deadline: projects.deadline, isOverdue: projects.isOverdue,
    picId: projects.picId,
    budgetPlanned: projects.budgetPlanned, budgetApproved: projects.budgetApproved, budgetActual: projects.budgetActual,
    approvalStatus: projects.approvalStatus, currentApprovalStep: projects.currentApprovalStep,
    notes: projects.notes, attachmentUrl: projects.attachmentUrl, createdAt: projects.createdAt, updatedAt: projects.updatedAt,
    divisionName: divisions.name, picName: users.fullName, picAvatar: users.avatarUrl,
  })
    .from(projects)
    .leftJoin(divisions, eq(projects.divisionId, divisions.id))
    .leftJoin(users, eq(projects.picId, users.id))
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1)

  if (!projectRows) notFound()

  const [memberRows, taskRows, approvalRows, commentRows, allUserRows] = await Promise.all([
    db.select({ userId: projectMembers.userId, fullName: users.fullName, avatarUrl: users.avatarUrl })
      .from(projectMembers).leftJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, id)),
    db.select({
      id: tasks.id, name: tasks.name, status: tasks.status, priority: tasks.priority,
      dueDate: tasks.dueDate, isOverdue: tasks.isOverdue, checked: tasks.checked,
      description: tasks.description, outputUrl: tasks.outputUrl,
    })
      .from(tasks).where(and(eq(tasks.projectId, id), isNull(tasks.deletedAt))).orderBy(asc(tasks.createdAt)),
    db.select({
      id: approvalRequests.id, status: approvalRequests.status, currentStep: approvalRequests.currentStep,
      createdAt: approvalRequests.createdAt,
      stepOrder: approvalSteps.stepOrder, approverRole: approvalSteps.approverRole,
      action: approvalSteps.action, note: approvalSteps.note, actedAt: approvalSteps.actedAt,
    })
      .from(approvalRequests)
      .leftJoin(approvalSteps, eq(approvalSteps.approvalRequestId, approvalRequests.id))
      .where(eq(approvalRequests.relatedEntityId, id))
      .orderBy(desc(approvalRequests.createdAt), asc(approvalSteps.stepOrder)),
    db.select({
      id: projectComments.id, content: projectComments.content, createdAt: projectComments.createdAt,
      userId: projectComments.userId, userName: users.fullName, userAvatar: users.avatarUrl, userRole: users.role,
    })
      .from(projectComments)
      .leftJoin(users, eq(projectComments.userId, users.id))
      .where(and(eq(projectComments.projectId, id), isNull(projectComments.deletedAt)))
      .orderBy(asc(projectComments.createdAt)),
    db.select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.fullName)),
  ])

  // Assignees per task
  const taskIds = taskRows.map(t => t.id)
  const assigneeRows = taskIds.length
    ? await db.select({ taskId: taskAssignees.taskId, userId: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl })
        .from(taskAssignees).leftJoin(users, eq(taskAssignees.userId, users.id))
        .where(inArray(taskAssignees.taskId, taskIds))
    : []
  const assigneeMap = new Map<string, { id: string; fullName: string; avatarUrl: string | null }[]>()
  for (const a of assigneeRows) {
    if (!a.userId) continue
    const arr = assigneeMap.get(a.taskId) ?? []
    arr.push({ id: a.userId, fullName: a.fullName ?? '?', avatarUrl: a.avatarUrl })
    assigneeMap.set(a.taskId, arr)
  }

  const tasksWithAssignees = taskRows.map(t => ({
    ...t,
    dueDate: t.dueDate as unknown as string,
    assignees: assigneeMap.get(t.id) ?? [],
  }))

  // Reshape approval rows → one request with a steps[] array (latest request)
  const latestReqId = approvalRows[0]?.id ?? null
  const approval = latestReqId ? {
    id: latestReqId,
    status: approvalRows[0].status,
    currentStep: approvalRows[0].currentStep,
    steps: approvalRows
      .filter(r => r.id === latestReqId && r.stepOrder !== null)
      .map(r => ({ stepOrder: r.stepOrder as number, approverRole: r.approverRole, action: r.action, note: r.note, actedAt: r.actedAt })),
  } : null

  const totalTasks = tasksWithAssignees.length
  const doneTasks = tasksWithAssignees.filter(t => t.status === 'Completed').length
  const derivedProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : projectRows.progress

  const project = {
    ...projectRows,
    members: memberRows,
    tasks: tasksWithAssignees,
    approval,
    taskStats: { total: totalTasks, done: doneTasks, progress: derivedProgress },
  }

  const mentionableUsers = allUserRows.filter(u => u.id && u.fullName) as { id: string; fullName: string }[]

  return (
    <ProjectDetailContent
      project={project as any}
      currentUserRole={session.role}
      currentUserId={session.id}
      comments={commentRows as any[]}
      projectMembers={mentionableUsers}
      allUsers={mentionableUsers}
      currentUser={{
        id: session.id,
        fullName: session.fullName,
        avatarUrl: session.avatarUrl ?? null,
        role: session.role,
      }}
    />
  )
}
