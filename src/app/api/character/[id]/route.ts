import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// Role "di atas arena" — tidak ikut leaderboard/EXP, dapat kartu prestige khusus.
const PRESTIGE_ROLES = ['super_admin', 'spv_manager', 'head_director']

// Data untuk Character Card (dipakai di Leaderboard & Mading). Bisa dilihat semua user login.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const userRows = (await sql`
    SELECT u.id, u.full_name AS "fullName", u.avatar_url AS "avatarUrl", u.bio, u.role, d.name AS "divisionName"
    FROM users u LEFT JOIN divisions d ON d.id = u.division_id
    WHERE u.id = ${id} AND u.deleted_at IS NULL LIMIT 1
  `) as { id: string; fullName: string; avatarUrl: string | null; bio: string | null; role: string; divisionName: string | null }[]
  const u = userRows[0]
  if (!u) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

  const moodRows = (await sql`
    SELECT mood_emoji AS emoji, mood_label AS label FROM user_moods
    WHERE user_id = ${id} ORDER BY mood_date DESC LIMIT 1
  `) as { emoji: string; label: string }[]
  const mood = moodRows[0] ?? null

  const prestige = PRESTIGE_ROLES.includes(u.role)
  if (prestige) {
    return NextResponse.json({ ...u, mood, prestige: true })
  }

  // Pemain biasa (staff / SPV / spectator): EXP per sumber, badge, dan rank all-time.
  const [sourceRows, badgeRows, rankRows] = await Promise.all([
    sql`SELECT source_type AS "sourceType", SUM(points)::int AS total
        FROM points_ledger WHERE user_id = ${id} AND source_type <> 'kpi' GROUP BY source_type`,
    sql`SELECT b.name AS "badgeName", b.icon AS "badgeIcon", b.id AS "badgeId"
        FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = ${id}`,
    sql`
      WITH totals AS (
        SELECT pl.user_id, SUM(pl.points)::int AS tot
        FROM points_ledger pl JOIN users uu ON uu.id = pl.user_id
        WHERE pl.source_type <> 'kpi' AND uu.deleted_at IS NULL
          AND uu.role NOT IN ('super_admin','spv_manager','head_director')
        GROUP BY pl.user_id
      )
      SELECT (SELECT COUNT(*) FROM totals t2 WHERE t2.tot > t1.tot) + 1 AS rank
      FROM totals t1 WHERE t1.user_id = ${id}
    `,
  ])

  const expBySource: Record<string, number> = {}
  for (const r of sourceRows as { sourceType: string; total: number }[]) expBySource[r.sourceType] = r.total

  return NextResponse.json({
    ...u, mood, prestige: false,
    expBySource,
    badges: badgeRows,
    rank: (rankRows as { rank: number }[])[0]?.rank ?? null,
  })
}
