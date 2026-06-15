import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { budgets } from '@/lib/db/schema'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { projectId, category, planned, vendor, notes } = body

  if (!projectId || !category || planned === undefined) {
    return NextResponse.json({ error: 'projectId, category, dan planned wajib diisi' }, { status: 400 })
  }

  const [budget] = await db.insert(budgets).values({
    projectId,
    category,
    planned: Number(planned),
    vendor: vendor || null,
    notes: notes || null,
    paymentStatus: 'Draft',
    actual: 0,
    createdBy: session.id,
  }).returning({ id: budgets.id })

  return NextResponse.json({ ok: true, id: budget.id }, { status: 201 })
}
