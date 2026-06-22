import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canManageRewards } from '@/lib/roles'
import { fulfillClaim } from '@/lib/rewards'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageRewards(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { notes } = await request.json().catch(() => ({}))
  const result = await fulfillClaim(id, session.id, notes)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ ok: true })
}
