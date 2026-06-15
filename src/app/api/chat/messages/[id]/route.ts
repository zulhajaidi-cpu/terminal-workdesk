import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatMessages } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [msg] = await db.select({ userId: chatMessages.userId })
    .from(chatMessages).where(eq(chatMessages.id, id)).limit(1)
  if (!msg) return NextResponse.json({ error: 'Pesan tidak ditemukan' }, { status: 404 })
  if (msg.userId !== session.id) return NextResponse.json({ error: 'Bukan pesan kamu' }, { status: 403 })

  const { content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Content kosong' }, { status: 400 })

  await db.update(chatMessages).set({
    content: content.trim(),
    isEdited: true,
    editedAt: new Date(),
  }).where(eq(chatMessages.id, id))

  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [msg] = await db.select({ userId: chatMessages.userId })
    .from(chatMessages).where(eq(chatMessages.id, id)).limit(1)
  if (!msg) return NextResponse.json({ error: 'Pesan tidak ditemukan' }, { status: 404 })

  const canDelete = msg.userId === session.id || ['super_admin','spv_manager','head_director'].includes(session.role)
  if (!canDelete) return NextResponse.json({ error: 'Tidak bisa menghapus pesan ini' }, { status: 403 })

  await db.update(chatMessages).set({ deletedAt: new Date() }).where(eq(chatMessages.id, id))
  return NextResponse.json({ ok: true })
}
