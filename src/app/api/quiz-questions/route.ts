import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canManageQuiz } from '@/lib/roles'
import { listQuestions, createQuestion } from '@/lib/quiz'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageQuiz(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(await listQuestions())
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageQuiz(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const res = await createQuestion({
    question: body.question,
    options: body.options,
    correctIndex: Number(body.correctIndex),
    explanation: body.explanation,
    category: body.category,
    points: body.points != null ? Number(body.points) : undefined,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
