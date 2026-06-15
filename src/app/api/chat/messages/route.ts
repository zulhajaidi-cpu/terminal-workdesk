import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatMessages, chatReactions, users } from '@/lib/db/schema'
import { eq, isNull, desc, lt, and, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const channelId = searchParams.get('channelId')
  const before    = searchParams.get('before')   // cursor: createdAt ISO
  const after     = searchParams.get('after')    // for polling: only newer than this
  const limit     = Math.min(Number(searchParams.get('limit') ?? 50), 100)

  if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 })

  const conditions = [
    eq(chatMessages.channelId, channelId),
    isNull(chatMessages.deletedAt),
  ]
  if (before) conditions.push(lt(chatMessages.createdAt, new Date(before)))
  if (after) {
    const { gt } = await import('drizzle-orm')
    conditions.push(gt(chatMessages.createdAt, new Date(after)))
  }

  const rows = await db.select({
    id:             chatMessages.id,
    channelId:      chatMessages.channelId,
    userId:         chatMessages.userId,
    content:        chatMessages.content,
    replyToId:      chatMessages.replyToId,
    attachmentUrl:  chatMessages.attachmentUrl,
    attachmentName: chatMessages.attachmentName,
    isEdited:       chatMessages.isEdited,
    createdAt:      chatMessages.createdAt,
    userName:       users.fullName,
    userAvatar:     users.avatarUrl,
    userRole:       users.role,
  })
    .from(chatMessages)
    .leftJoin(users, eq(chatMessages.userId, users.id))
    .where(and(...conditions))
    .orderBy(after ? chatMessages.createdAt : desc(chatMessages.createdAt))
    .limit(limit)

  // For initial/cursor load, reverse so oldest first
  const messages = after ? rows : rows.reverse()

  // Fetch reactions for these messages
  const ids = messages.map(m => m.id)
  let reactions: { messageId: string; emoji: string; userId: string }[] = []
  if (ids.length > 0) {
    reactions = await db.select({
      messageId: chatReactions.messageId,
      emoji:     chatReactions.emoji,
      userId:    chatReactions.userId,
    })
      .from(chatReactions)
      .where(sql`${chatReactions.messageId} = ANY(${ids})`)
  }

  // Attach reactions to messages
  const reactionMap = new Map<string, typeof reactions>()
  for (const r of reactions) {
    if (!reactionMap.has(r.messageId)) reactionMap.set(r.messageId, [])
    reactionMap.get(r.messageId)!.push(r)
  }

  const messagesWithReactions = messages.map(m => ({
    ...m,
    reactions: reactionMap.get(m.id) ?? [],
  }))

  return NextResponse.json({ messages: messagesWithReactions, hasMore: rows.length === limit })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { channelId, content, replyToId, attachmentUrl, attachmentName } = body

  if (!channelId || !content?.trim()) {
    return NextResponse.json({ error: 'channelId dan content wajib diisi' }, { status: 400 })
  }

  const [msg] = await db.insert(chatMessages).values({
    channelId,
    userId: session.id,
    content: content.trim(),
    replyToId: replyToId || null,
    attachmentUrl: attachmentUrl || null,
    attachmentName: attachmentName || null,
  }).returning({
    id: chatMessages.id,
    channelId: chatMessages.channelId,
    userId: chatMessages.userId,
    content: chatMessages.content,
    replyToId: chatMessages.replyToId,
    attachmentUrl: chatMessages.attachmentUrl,
    attachmentName: chatMessages.attachmentName,
    isEdited: chatMessages.isEdited,
    createdAt: chatMessages.createdAt,
  })

  return NextResponse.json({
    ok: true,
    message: {
      ...msg,
      userName: session.fullName,
      userAvatar: session.avatarUrl ?? null,
      userRole: session.role,
      reactions: [],
    }
  }, { status: 201 })
}
