import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

const sql = neon(process.env.DATABASE_URL!)

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  // Ambil data terbaru dari DB (bukan dari JWT) supaya foto/nama/role di header
  // langsung update tanpa harus logout-login. Plus jumlah notifikasi belum dibaca.
  const [meRows, unreadRows] = await Promise.all([
    sql`SELECT full_name AS "fullName", role, avatar_url AS "avatarUrl" FROM users WHERE id = ${session.id} LIMIT 1`,
    sql`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = ${session.id} AND is_read = false`,
  ])
  const me = (meRows as { fullName: string; role: string; avatarUrl: string | null }[])[0]
  const unreadCount = (unreadRows as { n: number }[])[0]?.n ?? 0

  return (
    <DashboardLayout
      user={{
        full_name: me?.fullName ?? session.fullName,
        role: me?.role ?? session.role,
        avatar_url: me?.avatarUrl ?? session.avatarUrl,
      }}
      unreadCount={unreadCount}
    >
      {children}
    </DashboardLayout>
  )
}
