import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTodayQuiz } from '@/lib/quiz'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quiz = await getTodayQuiz(session.id)
  return NextResponse.json(quiz)
}
