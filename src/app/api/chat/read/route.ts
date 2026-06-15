import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatReadStatus } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channelId } = await request.json()
  if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 })

  await db.insert(chatReadStatus)
    .values({ userId: session.id, channelId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [chatReadStatus.userId, chatReadStatus.channelId],
      set: { lastReadAt: new Date() },
    })

  return NextResponse.json({ ok: true })
}
