import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { budgets } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { canEditProject } from '@/lib/roles'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditProject(session.role)) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  const allowed = ['category', 'planned', 'approved', 'actual', 'vendor', 'invoiceLink', 'reimburseLink', 'paymentStatus', 'notes']
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key] ?? null
  }

  const [updated] = await db.update(budgets).set(updates).where(eq(budgets.id, id)).returning({ id: budgets.id })
  if (!updated) return NextResponse.json({ error: 'Budget item tidak ditemukan' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || !canEditProject(session.role)) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }

  await db.update(budgets).set({ deletedAt: new Date() }).where(eq(budgets.id, id))
  return NextResponse.json({ ok: true })
}
