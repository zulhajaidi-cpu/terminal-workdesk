import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatReactions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId, emoji } = await request.json()
  if (!messageId || !emoji) return NextResponse.json({ error: 'messageId & emoji required' }, { status: 400 })

  // Toggle: if exists delete, else insert
  const [existing] = await db.select({ id: chatReactions.id })
    .from(chatReactions)
    .where(and(
      eq(chatReactions.messageId, messageId),
      eq(chatReactions.userId, session.id),
      eq(chatReactions.emoji, emoji),
    )).limit(1)

  if (existing) {
    await db.delete(chatReactions).where(eq(chatReactions.id, existing.id))
    return NextResponse.json({ ok: true, action: 'removed' })
  } else {
    await db.insert(chatReactions).values({ messageId, userId: session.id, emoji })
      .onConflictDoNothing()
    return NextResponse.json({ ok: true, action: 'added' })
  }
}
