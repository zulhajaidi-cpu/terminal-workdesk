import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { pointsLedger, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || !['super_admin', 'head_director', 'spv_manager'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { userId, points, reason, sourceType } = body

  if (!userId || points === undefined || !reason) {
    return NextResponse.json({ error: 'userId, points, dan reason wajib diisi' }, { status: 400 })
  }

  const [user] = await db.select({ divisionId: users.divisionId })
    .from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

  const now = new Date()
  const [entry] = await db.insert(pointsLedger).values({
    userId,
    divisionId: user.divisionId ?? undefined,
    sourceType: sourceType ?? 'manual',
    points: Number(points),
    periodMonth: now.getMonth() + 1,
    periodYear: now.getFullYear(),
    awardedBy: session.id,
    reason,
  }).returning({ id: pointsLedger.id })

  return NextResponse.json({ ok: true, id: entry.id }, { status: 201 })
}
