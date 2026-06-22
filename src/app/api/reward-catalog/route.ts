import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canManageRewards } from '@/lib/roles'
import { db } from '@/lib/db'
import { rewardCatalog } from '@/lib/db/schema'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageRewards(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await request.json()
  if (!b.name?.trim()) return NextResponse.json({ error: 'Nama reward wajib diisi' }, { status: 400 })
  const unlockType = ['level', 'badge', 'manual'].includes(b.unlockType) ? b.unlockType : 'level'

  const [row] = await db.insert(rewardCatalog).values({
    unlockType,
    threshold: unlockType === 'level' && b.threshold ? Number(b.threshold) : null,
    badgeId: unlockType === 'badge' && b.badgeId ? b.badgeId : null,
    name: b.name.trim(),
    description: b.description?.trim() || null,
    imageUrl: b.imageUrl?.trim() || null,
    stock: b.stock != null && b.stock !== '' ? Number(b.stock) : null,
    isActive: b.isActive !== false,
    createdBy: session.id,
  }).returning()

  return NextResponse.json(row)
}
