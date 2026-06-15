import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { kpiItems } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.kpiName !== undefined) updates.kpiName = body.kpiName
  if (body.weight !== undefined) updates.weight = String(body.weight)
  if (body.target !== undefined) updates.target = body.target ? String(body.target) : null
  if (body.realization !== undefined) updates.realization = body.realization ? String(body.realization) : null
  if (body.maxScore !== undefined) updates.maxScore = String(body.maxScore)
  if (body.autoScore !== undefined) updates.autoScore = body.autoScore !== null ? String(body.autoScore) : null
  if (body.finalScore !== undefined) updates.finalScore = body.finalScore !== null ? String(body.finalScore) : null
  if (body.evaluationNote !== undefined) updates.evaluationNote = body.evaluationNote || null
  if (body.improvementPlan !== undefined) updates.improvementPlan = body.improvementPlan || null
  if (body.status !== undefined) updates.status = body.status

  const [updated] = await db.update(kpiItems).set(updates).where(eq(kpiItems.id, id)).returning()
  if (!updated) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

  return NextResponse.json({ ok: true, item: updated })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.update(kpiItems).set({ deletedAt: new Date() }).where(eq(kpiItems.id, id))
  return NextResponse.json({ ok: true })
}
