import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canManageQuiz } from '@/lib/roles'
import { toggleQuestion } from '@/lib/quiz'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageQuiz(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { isActive } = await request.json()
  await toggleQuestion(id, !!isActive)
  return NextResponse.json({ ok: true })
}
