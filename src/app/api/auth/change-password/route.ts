import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await request.json()
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Password lama dan password baru wajib diisi' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password baru minimal 8 karakter' }, { status: 400 })
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.id)).limit(1)
  if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) return NextResponse.json({ error: 'Password lama salah' }, { status: 401 })

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, session.id))

  return NextResponse.json({ ok: true })
}
