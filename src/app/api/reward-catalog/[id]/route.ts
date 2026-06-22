import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canManageRewards } from '@/lib/roles'
import { db } from '@/lib/db'
import { rewardCatalog } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageRewards(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await request.json()
  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (b.name !== undefined) patch.name = String(b.name).trim()
  if (b.description !== undefined) patch.description = b.description?.trim() || null
  if (b.imageUrl !== undefined) patch.imageUrl = b.imageUrl?.trim() || null
  if (b.threshold !== undefined) patch.threshold = b.threshold === '' || b.threshold == null ? null : Number(b.threshold)
  if (b.stock !== undefined) patch.stock = b.stock === '' || b.stock == null ? null : Number(b.stock)
  if (b.isActive !== undefined) patch.isActive = !!b.isActive

  const [row] = await db.update(rewardCatalog).set(patch).where(eq(rewardCatalog.id, id)).returning()
  if (!row) return NextResponse.json({ error: 'Reward tidak ditemukan' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageRewards(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Soft-disable agar klaim historis tetap utuh (FK reward_claims.catalog_id).
  await db.update(rewardCatalog).set({ isActive: false, updatedAt: new Date() }).where(eq(rewardCatalog.id, id))
  return NextResponse.json({ ok: true })
}
