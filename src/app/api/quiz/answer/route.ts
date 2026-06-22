import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { submitAnswer } from '@/lib/quiz'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { questionId, selectedIndex } = await request.json()
  if (!questionId || typeof selectedIndex !== 'number') {
    return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 })
  }

  const res = await submitAnswer(session.id, questionId, selectedIndex)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })

  return NextResponse.json(res)
}
