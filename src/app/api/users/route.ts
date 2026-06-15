import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, divisions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { fullName, email, role, divisionId, password, isActive } = body

  if (!fullName || !email || !password) {
    return NextResponse.json({ error: 'Nama, email, dan password wajib diisi' }, { status: 400 })
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const [newUser] = await db.insert(users).values({
    email: email.toLowerCase(),
    fullName,
    role: role ?? 'staff',
    divisionId: divisionId || null,
    isActive: isActive ?? true,
    passwordHash,
  }).returning()

  const divRow = divisionId
    ? await db.select({ name: divisions.name }).from(divisions).where(eq(divisions.id, divisionId)).limit(1)
    : []

  return NextResponse.json({
    user: {
      id: newUser.id, email: newUser.email, fullName: newUser.fullName,
      role: newUser.role, isActive: newUser.isActive, avatarUrl: newUser.avatarUrl,
      divisionId: newUser.divisionId, createdAt: newUser.createdAt.toISOString(),
      divisionName: divRow[0]?.name ?? null,
    }
  }, { status: 201 })
}
