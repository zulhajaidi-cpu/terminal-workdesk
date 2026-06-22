import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export interface DivisionStanding {
  divisionId: string | null
  divisionName: string
  totalExp: number
  memberCount: number
  avgExp: number   // total / member — metrik "kontribusi rata-rata", lebih fair utk divisi kecil vs besar
}
export interface DivisionWar {
  weekly: DivisionStanding[]   // rolling 7 hari terakhir — "Divisi terkuat minggu ini"
  monthly: DivisionStanding[]  // periode bulan berjalan (period_month/year, konsisten dgn panel lain)
}

export async function getDivisionWar(): Promise<DivisionWar> {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [weeklyRows, monthlyRows, memberCounts] = await Promise.all([
    sql`
      SELECT pl.division_id AS "divisionId", COALESCE(d.name, 'Tanpa Divisi') AS "divisionName",
             SUM(pl.points)::int AS "totalExp"
      FROM points_ledger pl
      LEFT JOIN divisions d ON d.id = pl.division_id
      WHERE pl.source_type <> 'kpi' AND pl.created_at >= now() - INTERVAL '7 days'
      GROUP BY pl.division_id, d.name
      ORDER BY "totalExp" DESC
    `,
    sql`
      SELECT pl.division_id AS "divisionId", COALESCE(d.name, 'Tanpa Divisi') AS "divisionName",
             SUM(pl.points)::int AS "totalExp"
      FROM points_ledger pl
      LEFT JOIN divisions d ON d.id = pl.division_id
      WHERE pl.source_type <> 'kpi' AND pl.period_month = ${month} AND pl.period_year = ${year}
      GROUP BY pl.division_id, d.name
      ORDER BY "totalExp" DESC
    `,
    sql`
      SELECT division_id AS "divisionId", COUNT(*)::int AS n
      FROM users WHERE is_active = true AND deleted_at IS NULL
      GROUP BY division_id
    `,
  ])

  const memberMap = new Map((memberCounts as { divisionId: string | null; n: number }[]).map(m => [m.divisionId, m.n]))

  function attach(rows: { divisionId: string | null; divisionName: string; totalExp: number }[]): DivisionStanding[] {
    return rows.map(r => {
      const memberCount = memberMap.get(r.divisionId) ?? 0
      return { ...r, memberCount, avgExp: memberCount > 0 ? Math.round(r.totalExp / memberCount) : 0 }
    })
  }

  return { weekly: attach(weeklyRows as any[]), monthly: attach(monthlyRows as any[]) }
}
