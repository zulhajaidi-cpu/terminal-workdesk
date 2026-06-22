import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'
import { levelProgress } from '@/lib/exp'
import { ArenaContent } from './arena-content'

const sql = neon(process.env.DATABASE_URL!)

export const metadata = { title: 'GODA Arena — Terminal Workdesk' }

export default async function ArenaPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const me = session.id

  const [meRows, totalRows, monthRows, rankRows, leaderboard, quests, trend, activity] = await Promise.all([
    // Profil singkat
    sql`SELECT u.full_name AS "fullName", u.avatar_url AS "avatarUrl", u.role, d.name AS "divisionName"
        FROM users u LEFT JOIN divisions d ON d.id = u.division_id WHERE u.id = ${me} LIMIT 1`,
    // Total EXP all-time (excl. kpi)
    sql`SELECT COALESCE(SUM(points),0)::int AS total FROM points_ledger WHERE user_id = ${me} AND source_type <> 'kpi'`,
    // EXP bulan ini
    sql`SELECT COALESCE(SUM(points),0)::int AS total FROM points_ledger
        WHERE user_id = ${me} AND source_type <> 'kpi' AND period_month = ${month} AND period_year = ${year}`,
    // Rank saya = jumlah user dengan EXP lebih tinggi + 1
    sql`SELECT COUNT(*)+1 AS rank FROM (
          SELECT user_id, SUM(points) tot FROM points_ledger WHERE source_type <> 'kpi'
          GROUP BY user_id HAVING SUM(points) > (
            SELECT COALESCE(SUM(points),0) FROM points_ledger WHERE user_id = ${me} AND source_type <> 'kpi'
          )
        ) x`,
    // Leaderboard EXP top 10
    sql`SELECT pl.user_id AS "userId", u.full_name AS "fullName", u.avatar_url AS "avatarUrl",
               u.role, d.name AS "divisionName", SUM(pl.points)::int AS exp
        FROM points_ledger pl
        JOIN users u ON u.id = pl.user_id
        LEFT JOIN divisions d ON d.id = u.division_id
        WHERE pl.source_type <> 'kpi'
        GROUP BY pl.user_id, u.full_name, u.avatar_url, u.role, d.name
        ORDER BY exp DESC LIMIT 10`,
    // Quest Log: task open milik saya
    sql`SELECT t.id, t.name, t.due_date AS "dueDate", t.priority, t.is_overdue AS "isOverdue", p.name AS "projectName"
        FROM tasks t
        JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = ${me}
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.deleted_at IS NULL AND t.status NOT IN ('Completed','Cancelled')
        ORDER BY t.due_date ASC LIMIT 8`,
    // Tren EXP 14 hari
    sql`SELECT TO_CHAR((created_at AT TIME ZONE 'Asia/Jakarta')::date, 'DD Mon') AS day,
               (created_at AT TIME ZONE 'Asia/Jakarta')::date AS d,
               SUM(points)::int AS exp
        FROM points_ledger
        WHERE user_id = ${me} AND source_type <> 'kpi' AND created_at >= now() - INTERVAL '14 days'
        GROUP BY d, day ORDER BY d`,
    // Feed aktivitas EXP terakhir
    sql`SELECT id, points, reason, source_type AS "sourceType", created_at AS "createdAt"
        FROM points_ledger
        WHERE user_id = ${me} AND source_type <> 'kpi'
        ORDER BY created_at DESC LIMIT 8`,
  ])

  const total = (totalRows as { total: number }[])[0]?.total ?? 0
  const lvl = levelProgress(total)

  return (
    <ArenaContent
      me={{
        fullName: (meRows as any[])[0]?.fullName ?? session.fullName,
        avatarUrl: (meRows as any[])[0]?.avatarUrl ?? session.avatarUrl ?? null,
        role: (meRows as any[])[0]?.role ?? session.role,
        divisionName: (meRows as any[])[0]?.divisionName ?? null,
      }}
      exp={{
        total,
        thisMonth: (monthRows as { total: number }[])[0]?.total ?? 0,
        rank: Number((rankRows as { rank: number }[])[0]?.rank ?? 0),
        level: lvl.level,
        levelTitle: lvl.title,
        levelPct: lvl.pct,
        intoLevel: lvl.intoLevel,
        span: lvl.span,
        toNext: Math.max(0, lvl.next - total),
      }}
      leaderboard={leaderboard as any[]}
      quests={quests as any[]}
      trend={(trend as any[]).map(t => ({ day: t.day, exp: t.exp }))}
      activity={activity as any[]}
      currentUserId={me}
    />
  )
}
