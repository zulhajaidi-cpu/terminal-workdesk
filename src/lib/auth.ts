import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { db } from './db'
import { users } from './db/schema'
import { eq } from 'drizzle-orm'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE_NAME = 'tw_session'

export type SessionUser = {
  id: string
  email: string
  fullName: string
  role: string
  divisionId: string | null
  avatarUrl: string | null
}

export async function signToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

// getSession membaca identitas dari JWT, TAPI meng-overlay role/divisi/aktif TERBARU dari DB
// (di-cache per-request via React cache → 1 query walau dipanggil banyak komponen). Ini membuat
// perubahan role oleh admin langsung berlaku tanpa user harus logout, dan user yang dinonaktifkan
// /dihapus otomatis kehilangan sesi. Field display (nama/avatar/email) tetap dari JWT.
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null

  const [fresh] = await db
    .select({ role: users.role, divisionId: users.divisionId, isActive: users.isActive, deletedAt: users.deletedAt })
    .from(users).where(eq(users.id, payload.id)).limit(1)
  if (!fresh || !fresh.isActive || fresh.deletedAt) return null

  return { ...payload, role: fresh.role, divisionId: fresh.divisionId }
})

export async function setSession(user: SessionUser): Promise<void> {
  const token = await signToken(user)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getUserFromSession(): Promise<(typeof users.$inferSelect) | null> {
  const session = await getSession()
  if (!session) return null
  const [user] = await db.select().from(users).where(eq(users.id, session.id)).limit(1)
  return user ?? null
}
