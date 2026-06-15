import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { kpiItems } from '@/lib/db/schema'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { userId, periodMonth, periodYear, kpiName, weight, target, realization, maxScore, autoScore, evaluationNote, improvementPlan } = body

  if (!kpiName || !weight || !maxScore) {
    return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
  }

  const targetId = userId ?? session.id

  const [item] = await db.insert(kpiItems).values({
    userId: targetId,
    periodMonth: Number(periodMonth),
    periodYear: Number(periodYear),
    kpiName,
    weight: String(weight),
    target: target ? String(target) : null,
    realization: realization ? String(realization) : null,
    maxScore: String(maxScore),
    autoScore: autoScore !== null && autoScore !== undefined ? String(autoScore) : null,
    status: 'Draft',
    createdBy: session.id,
  }).returning()

  return NextResponse.json({ ok: true, item }, { status: 201 })
}
