import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { setSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const identifier = (body.identifier ?? body.email ?? '').trim().toLowerCase()
  const password = body.password

  if (!identifier || !password) {
    return NextResponse.json({ error: 'Username/email dan password wajib diisi' }, { status: 400 })
  }

  const [user] = await db.select().from(users)
    .where(or(eq(users.email, identifier), eq(users.username, identifier)))
    .limit(1)

  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'Username/email atau password salah' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Username/email atau password salah' }, { status: 401 })
  }

  await setSession({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    divisionId: user.divisionId,
    avatarUrl: user.avatarUrl,
  })

  return NextResponse.json({ ok: true, role: user.role })
}
