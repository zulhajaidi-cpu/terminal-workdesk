import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { kpiItems, users, divisions } from '@/lib/db/schema'
import { eq, and, isNull, asc } from 'drizzle-orm'
import { KpiContent } from './kpi-content'
import { canViewOthersKpi } from '@/lib/roles'

export const metadata = { title: 'KPI Individu — Terminal Workdesk' }

export default async function KpiPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string; uid?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const sp = await searchParams
  const now = new Date()
  const month = Number(sp.month ?? now.getMonth() + 1)
  const year = Number(sp.year ?? now.getFullYear())

  const canView = canViewOthersKpi(session.role)

  // SPV (leader_divisi) hanya lihat divisinya, super_admin/manager/direktur lihat semua
  const canViewAll = ['super_admin', 'spv_manager', 'head_director'].includes(session.role)

  // Tentukan target user yang dilihat
  const targetUserId = canView && sp.uid ? sp.uid : session.id

  // Ambil daftar user yang bisa dilihat KPI-nya
  let viewableUsers: any[] = []
  if (canViewAll) {
    viewableUsers = await db.select({
      id: users.id, fullName: users.fullName, role: users.role,
      divisionId: users.divisionId, divisionName: divisions.name,
    }).from(users).leftJoin(divisions, eq(users.divisionId, divisions.id))
      .where(and(eq(users.isActive, true), isNull(users.deletedAt))).orderBy(asc(users.fullName))
  } else if (session.role === 'leader_divisi' && session.divisionId) {
    // SPV hanya lihat anggota divisinya
    viewableUsers = await db.select({
      id: users.id, fullName: users.fullName, role: users.role,
      divisionId: users.divisionId, divisionName: divisions.name,
    }).from(users).leftJoin(divisions, eq(users.divisionId, divisions.id))
      .where(and(eq(users.isActive, true), isNull(users.deletedAt), eq(users.divisionId, session.divisionId)))
      .orderBy(asc(users.fullName))
  }

  const myKpi = await db.select().from(kpiItems)
    .where(and(
      isNull(kpiItems.deletedAt),
      eq(kpiItems.userId, targetUserId),
      eq(kpiItems.periodMonth, month),
      eq(kpiItems.periodYear, year),
    )).orderBy(asc(kpiItems.createdAt))

  const totalWeight = myKpi.reduce((s, k) => s + Number(k.weight), 0)
  const totalFinal = myKpi.reduce((s, k) => s + Number(k.finalScore ?? k.autoScore ?? 0), 0)

  return (
    <KpiContent
      kpiItems={myKpi as any[]}
      viewableUsers={viewableUsers}
      month={month} year={year}
      targetUserId={targetUserId}
      currentUser={{ id: session.id, role: session.role }}
      totalWeight={totalWeight}
      totalFinal={totalFinal}
      canViewOthers={canView}
    />
  )
}
