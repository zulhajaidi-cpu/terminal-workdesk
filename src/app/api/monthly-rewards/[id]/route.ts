import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canManageRewards } from '@/lib/roles'
import { deleteMonthlyReward } from '@/lib/rewards'

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageRewards(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const res = await deleteMonthlyReward(id)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
