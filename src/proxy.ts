import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

// Endpoint mutasi yang tetap boleh diakses spectator (login/logout/ganti password sendiri).
const SPECTATOR_ALLOW = ['/api/auth/login', '/api/auth/logout', '/api/auth/change-password']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (isPublic) {
    // Jika sudah login, redirect ke dashboard
    const token = request.cookies.get('tw_session')?.value
    const session = token ? await verifyToken(token) : null
    if (session && pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  const token = request.cookies.get('tw_session')?.value
  const session = token ? await verifyToken(token) : null

  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Akun spectator: lihat saja, semua mutasi diblokir. Mutasi nyata = POST/PATCH/PUT/DELETE
  // ke /api/* ATAU Next.js Server Action (header `Next-Action`, di-POST ke route halaman).
  const method = request.method
  const isMutation = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
  if (isMutation && session.role === 'spectator' && !SPECTATOR_ALLOW.includes(pathname)) {
    const isApi = pathname.startsWith('/api/')
    const isServerAction = request.headers.has('next-action')
    if (isApi || isServerAction) {
      return NextResponse.json(
        { error: 'Akun spectator hanya bisa melihat, tidak bisa mengubah data.' },
        { status: 403 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
