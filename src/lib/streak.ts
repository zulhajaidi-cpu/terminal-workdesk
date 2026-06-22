import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

/* ═══════════════════ DATE HELPERS ═══════════════════ */
function jakartaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}
function epochDay(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 86_400_000)
}

/* ═══════════════════ STREAK ═══════════════════ */
export interface StreakInfo { currentStreak: number; longestStreak: number; lastActiveDate: string | null }

// Dipanggil tiap user MENDAPAT EXP (= hari aktif). Idempotent per hari.
export async function touchStreak(userId: string): Promise<StreakInfo> {
  const today = jakartaToday()
  const rows = (await sql`
    SELECT current_streak AS "currentStreak", longest_streak AS "longestStreak",
           last_active_date::text AS "lastActiveDate"
    FROM user_game_stats WHERE user_id = ${userId} LIMIT 1
  `) as { currentStreak: number; longestStreak: number; lastActiveDate: string | null }[]

  const row = rows[0]
  if (!row) {
    await sql`
      INSERT INTO user_game_stats (user_id, current_streak, longest_streak, last_active_date)
      VALUES (${userId}, 1, 1, ${today})
      ON CONFLICT (user_id) DO NOTHING
    `
    return { currentStreak: 1, longestStreak: 1, lastActiveDate: today }
  }

  // Sudah aktif hari ini → tak berubah.
  if (row.lastActiveDate && epochDay(row.lastActiveDate) === epochDay(today)) {
    return { currentStreak: row.currentStreak, longestStreak: row.longestStreak, lastActiveDate: row.lastActiveDate }
  }

  const diff = row.lastActiveDate ? epochDay(today) - epochDay(row.lastActiveDate) : Infinity
  const newStreak = diff === 1 ? row.currentStreak + 1 : 1
  const newLongest = Math.max(row.longestStreak, newStreak)

  await sql`
    UPDATE user_game_stats
    SET current_streak = ${newStreak}, longest_streak = ${newLongest}, last_active_date = ${today}, updated_at = now()
    WHERE user_id = ${userId}
  `
  return { currentStreak: newStreak, longestStreak: newLongest, lastActiveDate: today }
}

export async function getStreak(userId: string): Promise<StreakInfo> {
  const rows = (await sql`
    SELECT current_streak AS "currentStreak", longest_streak AS "longestStreak",
           last_active_date::text AS "lastActiveDate"
    FROM user_game_stats WHERE user_id = ${userId} LIMIT 1
  `) as { currentStreak: number; longestStreak: number; lastActiveDate: string | null }[]
  // Streak dianggap "putus" bila hari aktif terakhir bukan hari ini / kemarin.
  const row = rows[0]
  if (!row) return { currentStreak: 0, longestStreak: 0, lastActiveDate: null }
  if (row.lastActiveDate) {
    const diff = epochDay(jakartaToday()) - epochDay(row.lastActiveDate)
    if (diff > 1) return { currentStreak: 0, longestStreak: row.longestStreak, lastActiveDate: row.lastActiveDate }
  }
  return row
}

/* ═══════════════════ AUTO-BADGE ═══════════════════ */
interface BadgeStats {
  anyExp: boolean; currentStreak: number; earlyTasks: number; projectsDone: number; kudos: number
}

// Pemetaan criteria_key → syarat. Badge dgn key di luar map dilewati (award manual).
const CRITERIA: Record<string, (s: BadgeStats) => boolean> = {
  first_blood:       s => s.anyExp,
  streak_7:          s => s.currentStreak >= 7,
  streak_30:         s => s.currentStreak >= 30,
  task_early_10:     s => s.earlyTasks >= 10,
  project_5:         s => s.projectsDone >= 5,
  kudos_received_20: s => s.kudos >= 20,
}

export async function evaluateBadges(userId: string): Promise<string[]> {
  const [statRows, earlyRows, projRows, kudosRows, streakRows, badges, owned] = await Promise.all([
    sql`SELECT EXISTS(SELECT 1 FROM points_ledger WHERE user_id = ${userId} AND source_type <> 'kpi') AS "anyExp"`,
    sql`SELECT COUNT(*)::int AS n FROM points_ledger WHERE user_id = ${userId} AND source_type = 'task' AND reason ILIKE '%early%'`,
    sql`SELECT COUNT(DISTINCT source_id)::int AS n FROM points_ledger WHERE user_id = ${userId} AND source_type = 'project'`,
    sql`SELECT COUNT(*)::int AS n FROM points_ledger WHERE user_id = ${userId} AND source_type = 'kudos'`,
    sql`SELECT current_streak AS "currentStreak", last_active_date::text AS "lastActiveDate" FROM user_game_stats WHERE user_id = ${userId} LIMIT 1`,
    sql`SELECT id, name, icon, criteria_key AS "criteriaKey" FROM badges WHERE criteria_key IS NOT NULL`,
    sql`SELECT badge_id AS "badgeId" FROM user_badges WHERE user_id = ${userId}`,
  ])

  const streakRow = (streakRows as { currentStreak: number; lastActiveDate: string | null }[])[0]
  // Streak efektif (putus bila gap > 1 hari)
  let currentStreak = streakRow?.currentStreak ?? 0
  if (streakRow?.lastActiveDate && epochDay(jakartaToday()) - epochDay(streakRow.lastActiveDate) > 1) currentStreak = 0

  const stats: BadgeStats = {
    anyExp: (statRows as { anyExp: boolean }[])[0]?.anyExp ?? false,
    currentStreak,
    earlyTasks: (earlyRows as { n: number }[])[0]?.n ?? 0,
    projectsDone: (projRows as { n: number }[])[0]?.n ?? 0,
    kudos: (kudosRows as { n: number }[])[0]?.n ?? 0,
  }

  const ownedSet = new Set((owned as { badgeId: string }[]).map(o => o.badgeId))
  const newlyAwarded: string[] = []

  for (const b of badges as { id: string; name: string; icon: string | null; criteriaKey: string }[]) {
    if (ownedSet.has(b.id)) continue
    const check = CRITERIA[b.criteriaKey]
    if (!check || !check(stats)) continue

    const ins = (await sql`
      INSERT INTO user_badges (user_id, badge_id) VALUES (${userId}, ${b.id})
      ON CONFLICT (user_id, badge_id) DO NOTHING
      RETURNING id
    `) as { id: string }[]
    if (ins.length > 0) {
      newlyAwarded.push(b.name)
      await sql`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (${userId}, ${`Badge baru: ${b.name} ${b.icon ?? '🏅'}`},
                ${`Selamat! Kamu membuka badge "${b.name}". Cek koleksimu di GODA Arena.`}, 'gamification')
      `
    }
  }
  return newlyAwarded
}

// Dipanggil dari awardExp() setelah EXP berhasil ditambahkan.
export async function touchStreakAndBadges(userId: string): Promise<void> {
  await touchStreak(userId)
  await evaluateBadges(userId)
}
