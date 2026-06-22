import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { taskProgressLogs } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { awardProgressExp } from '@/lib/exp'

const sql = neon(process.env.DATABASE_URL!)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logs = await sql`
    SELECT tpl.id, tpl.note, tpl.created_at,
           u.full_name AS user_name, u.avatar_url
    FROM task_progress_logs tpl
    JOIN users u ON u.id = tpl.user_id
    WHERE tpl.task_id = ${id}
    ORDER BY tpl.created_at ASC
  `
  return NextResponse.json(logs)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { note } = await request.json()
  if (!note?.trim()) return NextResponse.json({ error: 'Catatan wajib diisi' }, { status: 400 })

  const [log] = await db.insert(taskProgressLogs).values({
    taskId: id,
    userId: session.id,
    note: note.trim(),
  }).returning()

  // Apresiasi konsistensi dokumentasi: +EXP (cap 1×/task/hari, dedup di helper).
  try {
    const tr = (await sql`SELECT division_id AS "divisionId" FROM tasks WHERE id = ${id} LIMIT 1`) as { divisionId: string | null }[]
    await awardProgressExp(id, session.id, tr[0]?.divisionId ?? null)
  } catch (e) { console.error('awardProgressExp failed:', e) }

  return NextResponse.json(log)
}
