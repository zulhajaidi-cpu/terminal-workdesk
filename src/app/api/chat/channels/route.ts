import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatChannels, chatMembers, divisions, users } from '@/lib/db/schema'
import { eq, isNull, and, or } from 'drizzle-orm'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [channels, divisionRows] = await Promise.all([
    db.select({
      id: chatChannels.id,
      name: chatChannels.name,
      description: chatChannels.description,
      type: chatChannels.type,
      divisionId: chatChannels.divisionId,
      divisionName: divisions.name,
      createdBy: chatChannels.createdBy,
      createdAt: chatChannels.createdAt,
    })
      .from(chatChannels)
      .leftJoin(divisions, eq(chatChannels.divisionId, divisions.id))
      .where(eq(chatChannels.isArchived, false)),

    db.select({ id: divisions.id, name: divisions.name })
      .from(divisions)
      .where(isNull(divisions.deletedAt)),
  ])

  return NextResponse.json({ channels, divisions: divisionRows })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, description, type, divisionId, memberIds } = body

  if (!name) return NextResponse.json({ error: 'Nama channel wajib diisi' }, { status: 400 })

  const [channel] = await db.insert(chatChannels).values({
    name: name.toLowerCase().replace(/\s+/g, '-'),
    description: description || null,
    type: type ?? 'general',
    divisionId: divisionId || null,
    createdBy: session.id,
  }).returning({ id: chatChannels.id, name: chatChannels.name })

  // For direct channels, insert members
  if (memberIds && memberIds.length > 0) {
    const allMembers = [...new Set([session.id, ...memberIds])]
    await db.insert(chatMembers).values(
      allMembers.map(uid => ({ channelId: channel.id, userId: uid }))
    ).onConflictDoNothing()
  }

  return NextResponse.json({ ok: true, channel }, { status: 201 })
}
