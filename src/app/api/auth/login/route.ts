import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { setSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 })
  }

  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)

  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
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
