import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { calendarEvents, divisions, projects, tasks, users, approvalRequests } from '@/lib/db/schema'
import { isNull, eq, asc, desc } from 'drizzle-orm'
import { CalendarContent } from './calendar-content'

export const metadata = { title: 'Kalender — Terminal Workdesk' }

export default async function CalendarPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [calEventRows, projectRows, taskRows, approvalRows, divisionRows] = await Promise.all([
    // Manual calendar events
    db.select({
      id: calendarEvents.id, title: calendarEvents.title,
      eventType: calendarEvents.eventType,
      startAt: calendarEvents.startAt, endAt: calendarEvents.endAt,
      allDay: calendarEvents.allDay, location: calendarEvents.location,
      link: calendarEvents.link, notes: calendarEvents.notes,
      divisionId: calendarEvents.divisionId,
      relatedProjectId: calendarEvents.relatedProjectId,
      createdBy: calendarEvents.createdBy,
      divisionName: divisions.name,
    })
      .from(calendarEvents)
      .leftJoin(divisions, eq(calendarEvents.divisionId, divisions.id))
      .where(isNull(calendarEvents.deletedAt))
      .orderBy(asc(calendarEvents.startAt)),

    // Projects — for start & deadline markers
    db.select({
      id: projects.id, name: projects.name, projectCode: projects.projectCode,
      status: projects.status, priority: projects.priority,
      startDate: projects.startDate, deadline: projects.deadline,
      divisionName: divisions.name, divisionId: projects.divisionId,
    })
      .from(projects)
      .leftJoin(divisions, eq(projects.divisionId, divisions.id))
      .where(isNull(projects.deletedAt))
      .orderBy(asc(projects.deadline)),

    // Tasks — for due date markers
    db.select({
      id: tasks.id, name: tasks.name, dueDate: tasks.dueDate,
      status: tasks.status, priority: tasks.priority, isOverdue: tasks.isOverdue,
      projectName: projects.name, divisionName: divisions.name, divisionId: tasks.divisionId,
    })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(divisions, eq(tasks.divisionId, divisions.id))
      .where(isNull(tasks.deletedAt))
      .orderBy(asc(tasks.dueDate)),

    // Approvals — pending only
    db.select({
      id: approvalRequests.id, status: approvalRequests.status,
      currentStep: approvalRequests.currentStep,
      createdAt: approvalRequests.createdAt,
      projectName: projects.name,
      requesterName: users.fullName,
      divisionName: divisions.name, divisionId: projects.divisionId,
    })
      .from(approvalRequests)
      .leftJoin(projects, eq(approvalRequests.relatedEntityId, projects.id))
      .leftJoin(users, eq(approvalRequests.requestedBy, users.id))
      .leftJoin(divisions, eq(projects.divisionId, divisions.id))
      .orderBy(desc(approvalRequests.createdAt)),

    db.select({ id: divisions.id, name: divisions.name })
      .from(divisions).where(isNull(divisions.deletedAt)),
  ])

  return (
    <CalendarContent
      calEvents={calEventRows as any[]}
      projectRows={projectRows as any[]}
      taskRows={taskRows as any[]}
      approvalRows={approvalRows as any[]}
      divisions={divisionRows}
      projectsForForm={projectRows.map(p => ({ id: p.id, name: p.name }))}
      currentUser={{ id: session.id, role: session.role, divisionId: session.divisionId ?? null }}
    />
  )
}
