import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { calendarEvents, eventParticipants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }
  const allowed = ['title', 'eventName', 'eventType', 'divisionId', 'relatedProjectId', 'startAt', 'endAt', 'allDay', 'location', 'link', 'notes']
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key] ?? null
  }
  if (updates.startAt) updates.startAt = new Date(updates.startAt as string)
  if (updates.endAt) updates.endAt = new Date(updates.endAt as string)

  const [updated] = await db.update(calendarEvents).set(updates).where(eq(calendarEvents.id, id)).returning({ id: calendarEvents.id })
  if (!updated) return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 })

  // Sync participants if provided
  if (Array.isArray(body.participants)) {
    await db.delete(eventParticipants).where(eq(eventParticipants.eventId, id))
    if (body.participants.length > 0) {
      await db.insert(eventParticipants).values(
        body.participants.map((p: { userId: string; jobdesk?: string }) => ({
          eventId: id,
          userId: p.userId,
          roleInEvent: p.jobdesk || null,
        }))
      ).onConflictDoNothing()
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [ev] = await db.select({ createdBy: calendarEvents.createdBy })
    .from(calendarEvents).where(eq(calendarEvents.id, id)).limit(1)
  if (!ev) return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 })

  const canDelete = session.role === 'super_admin' || ev.createdBy === session.id
  if (!canDelete) return NextResponse.json({ error: 'Tidak bisa menghapus event orang lain' }, { status: 403 })

  await db.update(calendarEvents).set({ deletedAt: new Date() }).where(eq(calendarEvents.id, id))
  return NextResponse.json({ ok: true })
}
