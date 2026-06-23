import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

const sql = neon(process.env.DATABASE_URL!)

// Jabatan yang boleh dipilih saat daftar (super_admin & spectator TIDAK boleh diminta sendiri).
const ALLOWED_ROLES = ['staff', 'leader_divisi', 'spv_manager', 'head_director']

// Daftar mandiri tim internal. Akun dibuat NONAKTIF + pending → menunggu persetujuan Super Admin.
export async function POST(request: NextRequest) {
  const body = await request.json()
  const fullName = (body.fullName ?? '').trim()
  const username = (body.username ?? '').toLowerCase().trim()
  const password = body.password ?? ''
  const role = ALLOWED_ROLES.includes(body.role) ? body.role : 'staff'
  const divisionId = body.divisionId || null

  if (!fullName || !username || !password) {
    return NextResponse.json({ error: 'Nama, username, dan password wajib diisi' }, { status: 400 })
  }
  if (!/^[a-z0-9._]{3,20}$/.test(username)) {
    return NextResponse.json({ error: 'Username 3-20 karakter: huruf kecil, angka, titik, underscore' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
  }

  const dup = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
  if (dup.length > 0) {
    return NextResponse.json({ error: 'Username sudah dipakai, coba yang lain' }, { status: 409 })
  }

  const email = `${username}@internal.goda`
  const dupEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (dupEmail.length > 0) {
    return NextResponse.json({ error: 'Username sudah dipakai, coba yang lain' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const [newUser] = await db.insert(users).values({
    email, username, fullName,
    role,
    divisionId,
    isActive: false,
    pendingApproval: true,
    passwordHash,
  }).returning({ id: users.id })

  // Notifikasi ke semua Super Admin agar tahu ada yang menunggu persetujuan (in-app, tanpa email).
  const roleLabel = ({ staff: 'Staff', leader_divisi: 'SPV', spv_manager: 'Manager', head_director: 'Direktur' } as Record<string, string>)[role] ?? role
  try {
    await sql`
      INSERT INTO notifications (user_id, title, message, type)
      SELECT id, ${'Pendaftaran baru 📝'},
             ${`${fullName} (@${username}) mendaftar sebagai ${roleLabel} dan menunggu persetujuan.`}, 'approval_request'
      FROM users WHERE role = 'super_admin' AND deleted_at IS NULL
    `
  } catch (e) { console.error('notify admins (register) failed:', e) }

  return NextResponse.json({ ok: true, id: newUser.id }, { status: 201 })
}
