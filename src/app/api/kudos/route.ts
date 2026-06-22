import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sendKudos } from '@/lib/kudos'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recipientId, message } = await request.json()
  const res = await sendKudos(session.id, recipientId, message)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })

  return NextResponse.json({ ok: true, recipientName: res.recipientName })
}
