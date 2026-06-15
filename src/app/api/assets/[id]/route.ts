import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { assets } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }
  const allowed = ['name', 'category', 'divisionId', 'driveLink', 'version', 'relatedProjectId', 'description', 'tags', 'status']
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key] ?? null
  }

  const [updated] = await db.update(assets).set(updates).where(eq(assets.id, id)).returning({ id: assets.id })
  if (!updated) return NextResponse.json({ error: 'Asset tidak ditemukan' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.update(assets).set({ deletedAt: new Date() }).where(eq(assets.id, id))
  return NextResponse.json({ ok: true })
}
