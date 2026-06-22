import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canManageRewards } from '@/lib/roles'
import { upsertMonthlyReward } from '@/lib/rewards'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageRewards(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await request.json()
  const res = await upsertMonthlyReward({
    rank: Number(b.rank), rewardName: b.rewardName, notes: b.notes, rewardImageLink: b.rewardImageLink,
    periodMonth: b.periodMonth != null ? Number(b.periodMonth) : undefined,
    periodYear: b.periodYear != null ? Number(b.periodYear) : undefined,
    adminId: session.id,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
