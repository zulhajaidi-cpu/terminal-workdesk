import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { kpiItems } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { month, year } = await request.json()

  await db.update(kpiItems)
    .set({ status: 'Reviewed', updatedAt: new Date() })
    .where(and(
      eq(kpiItems.userId, session.id),
      eq(kpiItems.periodMonth, Number(month)),
      eq(kpiItems.periodYear, Number(year)),
      eq(kpiItems.status, 'Draft'),
    ))

  return NextResponse.json({ ok: true })
}
