import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { calendarEvents, divisions, users, eventParticipants } from '@/lib/db/schema'
import { eq, isNull, desc } from 'drizzle-orm'
import { EventsContent } from './events-content'

export const metadata = { title: 'Events & Agenda — Terminal Workdesk' }

export default async function EventsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [eventRows, divisionRows, allUsers, participantRows] = await Promise.all([
    db.select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      eventName: calendarEvents.eventName,
      notes: calendarEvents.notes,
      eventType: calendarEvents.eventType,
      startAt: calendarEvents.startAt,
      endAt: calendarEvents.endAt,
      allDay: calendarEvents.allDay,
      location: calendarEvents.location,
      link: calendarEvents.link,
      divisionId: calendarEvents.divisionId,
      divisionName: divisions.name,
      createdBy: calendarEvents.createdBy,
      creatorName: users.fullName,
      createdAt: calendarEvents.createdAt,
    })
      .from(calendarEvents)
      .leftJoin(divisions, eq(calendarEvents.divisionId, divisions.id))
      .leftJoin(users, eq(calendarEvents.createdBy, users.id))
      .where(isNull(calendarEvents.deletedAt))
      .orderBy(desc(calendarEvents.startAt)),

    db.select({ id: divisions.id, name: divisions.name })
      .from(divisions)
      .where(isNull(divisions.deletedAt)),

    db.select({ id: users.id, fullName: users.fullName, divisionId: users.divisionId, role: users.role })
      .from(users)
      .where(eq(users.isActive, true)),

    db.select({
      eventId: eventParticipants.eventId,
      userId: eventParticipants.userId,
      jobdesk: eventParticipants.roleInEvent,
      userName: users.fullName,
      userRole: users.role,
    })
      .from(eventParticipants)
      .leftJoin(users, eq(eventParticipants.userId, users.id)),
  ])

  return (
    <EventsContent
      events={eventRows as any[]}
      divisions={divisionRows}
      allUsers={allUsers}
      participantRows={participantRows as any[]}
      currentUser={{ id: session.id, role: session.role }}
    />
  )
}
