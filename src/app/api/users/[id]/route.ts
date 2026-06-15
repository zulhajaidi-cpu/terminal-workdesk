import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, divisions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  const isSelf = session?.id === id
  const isAdmin = session?.role === 'super_admin'
  if (!session || (!isSelf && !isAdmin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  // Non-admin hanya boleh ubah nama, bio, dan password diri sendiri
  if (isAdmin) {
    if (body.fullName !== undefined) updates.fullName = body.fullName
    if (body.email !== undefined) updates.email = body.email.toLowerCase()
    if (body.role !== undefined) updates.role = body.role
    if (body.divisionId !== undefined) updates.divisionId = body.divisionId || null
    if (body.isActive !== undefined) updates.isActive = body.isActive
  } else {
    if (body.fullName !== undefined) updates.fullName = body.fullName
  }
  if (body.bio !== undefined) updates.bio = body.bio || null
  if (body.password) updates.passwordHash = await bcrypt.hash(body.password, 12)
  updates.updatedAt = new Date()

  const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning()
  if (!updated) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

  const divRow = updated.divisionId
    ? await db.select({ name: divisions.name }).from(divisions).where(eq(divisions.id, updated.divisionId)).limit(1)
    : []

  return NextResponse.json({
    user: {
      id: updated.id, email: updated.email, fullName: updated.fullName,
      role: updated.role, isActive: updated.isActive, avatarUrl: updated.avatarUrl,
      bio: updated.bio, divisionId: updated.divisionId,
      createdAt: updated.createdAt.toISOString(), divisionName: divRow[0]?.name ?? null,
    }
  })
}
