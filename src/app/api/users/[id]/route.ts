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
    if (body.username !== undefined) {
      const username = String(body.username).toLowerCase().trim()
      if (!/^[a-z0-9._]{3,20}$/.test(username)) {
        return NextResponse.json({ error: 'Username 3-20 karakter: huruf kecil, angka, titik, underscore' }, { status: 400 })
      }
      const dup = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
      if (dup.length > 0 && dup[0].id !== id) {
        return NextResponse.json({ error: 'Username sudah dipakai' }, { status: 409 })
      }
      updates.username = username
    }
  } else {
    if (body.fullName !== undefined) updates.fullName = body.fullName
  }
  // Foto profil boleh diubah sendiri (atau admin utk user lain). Nilai = URL teks dari Vercel Blob.
  if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl || null
  if (body.bio !== undefined) updates.bio = body.bio || null
  // Password hanya bisa diset admin lewat sini. Ganti password sendiri wajib lewat
  // POST /api/auth/change-password (butuh verifikasi password lama).
  if (isAdmin && body.password) updates.passwordHash = await bcrypt.hash(body.password, 12)
  updates.updatedAt = new Date()

  const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning()
  if (!updated) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

  const divRow = updated.divisionId
    ? await db.select({ name: divisions.name }).from(divisions).where(eq(divisions.id, updated.divisionId)).limit(1)
    : []

  return NextResponse.json({
    user: {
      id: updated.id, email: updated.email, username: updated.username, fullName: updated.fullName,
      role: updated.role, isActive: updated.isActive, avatarUrl: updated.avatarUrl,
      bio: updated.bio, divisionId: updated.divisionId,
      createdAt: updated.createdAt.toISOString(), divisionName: divRow[0]?.name ?? null,
    }
  })
}
