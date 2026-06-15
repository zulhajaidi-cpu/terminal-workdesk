import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { calendarEvents, eventParticipants } from '@/lib/db/schema'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, eventName, eventType, divisionId, relatedProjectId, startAt, endAt, allDay, location, link, notes, participants } = body

  if (!title || !startAt || !endAt) {
    return NextResponse.json({ error: 'Title, startAt, dan endAt wajib diisi' }, { status: 400 })
  }

  const [event] = await db.insert(calendarEvents).values({
    title,
    eventName: eventName || null,
    eventType: eventType ?? 'Other',
    divisionId: divisionId || null,
    relatedProjectId: relatedProjectId || null,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    allDay: allDay ?? false,
    location: location || null,
    link: link || null,
    notes: notes || null,
    createdBy: session.id,
  }).returning({ id: calendarEvents.id })

  // participants: array of { userId, jobdesk }
  if (participants && participants.length > 0) {
    await db.insert(eventParticipants).values(
      participants.map((p: { userId: string; jobdesk?: string }) => ({
        eventId: event.id,
        userId: p.userId,
        roleInEvent: p.jobdesk || null,
      }))
    ).onConflictDoNothing()
  }

  return NextResponse.json({ ok: true, id: event.id }, { status: 201 })
}
