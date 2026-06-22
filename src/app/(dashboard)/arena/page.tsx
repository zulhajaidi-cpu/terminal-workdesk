import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'
import { levelProgress } from '@/lib/exp'
import { getMyRewards, getAllClaims, getCatalogForAdmin, getCurrentMonthRewards } from '@/lib/rewards'
import { getTodayQuiz, listQuestions } from '@/lib/quiz'
import { getStreak } from '@/lib/streak'
import { getKudosStatus } from '@/lib/kudos'
import { getDivisionWar } from '@/lib/division-war'
import { canManageRewards, canManageQuiz } from '@/lib/roles'
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

  const [meRows, totalRows, monthRows, rankRows, leaderboard, quests, trend, activity, badgeRows, teammates] = await Promise.all([
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
    // Semua badge + status dimiliki user (untuk panel Badges)
    sql`SELECT b.id, b.name, b.icon, b.description, b.criteria_key AS "criteriaKey",
               (ub.id IS NOT NULL) AS "earned", ub.awarded_at AS "awardedAt"
        FROM badges b
        LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = ${me}
        ORDER BY (ub.id IS NOT NULL) DESC, b.name ASC`,
    // Rekan untuk picker kudos (semua user aktif kecuali diri sendiri)
    sql`SELECT u.id, u.full_name AS "fullName", u.avatar_url AS "avatarUrl", d.name AS "divisionName"
        FROM users u LEFT JOIN divisions d ON d.id = u.division_id
        WHERE u.is_active = true AND u.deleted_at IS NULL AND u.id <> ${me}
        ORDER BY u.full_name ASC`,
  ])

  const total = (totalRows as { total: number }[])[0]?.total ?? 0
  const lvl = levelProgress(total)

  // Reward / Loot Vault (dibungkus try/catch agar tak menggagalkan render Arena).
  const isAdmin = canManageRewards(session.role)
  let rewards = { eligible: [], locked: [], claimed: [] } as Awaited<ReturnType<typeof getMyRewards>>
  let adminClaims: any[] = []
  let adminCatalog: any[] = []
  try {
    const [r, ac, acat] = await Promise.all([
      getMyRewards(me),
      isAdmin ? getAllClaims() : Promise.resolve([]),
      isAdmin ? getCatalogForAdmin() : Promise.resolve([]),
    ])
    rewards = r; adminClaims = ac; adminCatalog = acat
  } catch (e) { console.error('rewards fetch failed:', e) }

  // Reward bulan ini (live standing + definisi reward per rank).
  let currentMonth = { periodMonth: month, periodYear: year, monthLabel: '', rewards: [], liveTop: [] } as Awaited<ReturnType<typeof getCurrentMonthRewards>>
  try { currentMonth = await getCurrentMonthRewards() } catch (e) { console.error('currentMonth fetch failed:', e) }

  // Streak harian (efektif; 0 bila putus).
  let streak = { currentStreak: 0, longestStreak: 0, lastActiveDate: null } as Awaited<ReturnType<typeof getStreak>>
  try { streak = await getStreak(me) } catch (e) { console.error('streak fetch failed:', e) }

  // Status kudos (kuota harian + feed beri/terima).
  let kudos = { cap: 3, usedToday: 0, remaining: 3, pointsPerKudos: 10, received: [], given: [] } as Awaited<ReturnType<typeof getKudosStatus>>
  try { kudos = await getKudosStatus(me) } catch (e) { console.error('kudos fetch failed:', e) }

  // Divisi War (agregasi EXP per divisi — minggu ini & bulan ini).
  let divisionWar = { weekly: [], monthly: [] } as Awaited<ReturnType<typeof getDivisionWar>>
  try { divisionWar = await getDivisionWar() } catch (e) { console.error('divisionWar fetch failed:', e) }

  // Kuis harian + (super_admin) daftar bank soal. Dibungkus try/catch.
  const isQuizAdmin = canManageQuiz(session.role)
  let quiz = { question: null, answered: false, result: null, expReward: 0 } as Awaited<ReturnType<typeof getTodayQuiz>>
  let quizQuestions: any[] = []
  try {
    const [tq, qs] = await Promise.all([
      getTodayQuiz(me),
      isQuizAdmin ? listQuestions() : Promise.resolve([]),
    ])
    quiz = tq; quizQuestions = qs
  } catch (e) { console.error('quiz fetch failed:', e) }

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
      rewards={rewards}
      isAdmin={isAdmin}
      adminClaims={adminClaims}
      adminCatalog={adminCatalog}
      currentMonth={currentMonth}
      streak={streak}
      badges={badgeRows as any[]}
      kudos={kudos}
      teammates={teammates as any[]}
      divisionWar={divisionWar}
      quiz={quiz}
      isQuizAdmin={isQuizAdmin}
      quizQuestions={quizQuestions}
    />
  )
}
