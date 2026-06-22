import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { claimReward } from '@/lib/rewards'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { source, refId } = await request.json()
  if ((source !== 'monthly' && source !== 'catalog') || !refId) {
    return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 })
  }

  const result = await claimReward({ userId: session.id, source, refId })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ ok: true, title: result.title })
}
