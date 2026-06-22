import { neon } from '@neondatabase/serverless'
import { touchStreakAndBadges } from '@/lib/streak'

const sql = neon(process.env.DATABASE_URL!)

/* ═══════════════════ LEVEL MATH (pure) ═══════════════════ */
// Threshold total EXP untuk MENCAPAI level L = 50·(L-1)·L
// → L1:0, L2:100, L3:300, L4:600, L5:1000 (increment 100,200,300,400…).
export const DEFAULT_RULES: Record<string, number> = {
  task_complete: 20,
  task_early_bonus: 10,
  task_late_penalty: 10,
  progress_update: 5,
  project_complete: 100,
  kudos_give: 10,        // EXP yang diterima penerima kudos
  kudos_daily_cap: 3,    // maksimum kudos yang bisa diberi 1 user per hari
}

export function levelFromExp(total: number): number {
  if (total <= 0) return 1
  return Math.max(1, Math.floor((50 + Math.sqrt(2500 + 200 * total)) / 100))
}
export function levelFloor(level: number): number { return 50 * (level - 1) * level }
export function nextLevelExp(level: number): number { return 50 * level * (level + 1) }

const TIERS: { min: number; title: string }[] = [
  { min: 15, title: 'Legend' },
  { min: 10, title: 'Elite' },
  { min: 7,  title: 'Veteran' },
  { min: 5,  title: 'Hustler' },
  { min: 3,  title: 'Grinder' },
  { min: 1,  title: 'Rookie' },
]
export function tierTitle(level: number): string {
  return TIERS.find(t => level >= t.min)?.title ?? 'Rookie'
}

export interface LevelInfo {
  level: number; floor: number; next: number
  pct: number; title: string; intoLevel: number; span: number
}
export function levelProgress(total: number): LevelInfo {
  const level = levelFromExp(total)
  const floor = levelFloor(level)
  const next = nextLevelExp(level)
  const span = next - floor
  const intoLevel = total - floor
  const pct = span > 0 ? Math.min(100, Math.round((intoLevel / span) * 100)) : 0
  return { level, floor, next, pct, title: tierTitle(level), intoLevel, span }
}

/* ═══════════════════ RULES & TOTALS ═══════════════════ */
export async function getRuleValue(eventKey: string): Promise<number> {
  const rows = (await sql`
    SELECT points FROM gamification_rules WHERE event_key = ${eventKey} AND is_active = true LIMIT 1
  `) as { points: number }[]
  return rows[0]?.points ?? DEFAULT_RULES[eventKey] ?? 0
}

// Total EXP user (akumulasi semua periode, KECUALI sumber 'kpi' agar EXP murni proses).
export async function getUserExp(userId: string): Promise<number> {
  const rows = (await sql`
    SELECT COALESCE(SUM(points), 0)::int AS total
    FROM points_ledger WHERE user_id = ${userId} AND source_type <> 'kpi'
  `) as { total: number }[]
  return rows[0]?.total ?? 0
}

/* ═══════════════════ CORE AWARD ═══════════════════ */
type Dedupe = 'once-per-source' | 'once-per-day' | 'none'
interface AwardArgs {
  userId: string
  divisionId?: string | null
  sourceType: 'task' | 'project' | 'progress' | 'quiz' | 'streak' | 'kudos' | 'bonus' | 'manual'
  sourceId?: string | null
  points: number
  reason?: string
  dedupe?: Dedupe
  awardedBy?: string | null
}
export interface AwardResult {
  awarded: boolean; oldLevel: number; newLevel: number; leveledUp: boolean; newTotal: number
}

export async function awardExp(a: AwardArgs): Promise<AwardResult> {
  const dedupe = a.dedupe ?? 'none'
  const oldTotal = await getUserExp(a.userId)
  const oldLevel = levelFromExp(oldTotal)
  const noop = (): AwardResult => ({ awarded: false, oldLevel, newLevel: oldLevel, leveledUp: false, newTotal: oldTotal })

  if (a.points === 0) return noop()

  if (dedupe === 'once-per-source' && a.sourceId) {
    const exists = (await sql`
      SELECT 1 FROM points_ledger
      WHERE user_id = ${a.userId} AND source_type = ${a.sourceType}::point_source AND source_id = ${a.sourceId}
      LIMIT 1
    `) as unknown[]
    if (exists.length > 0) return noop()
  }
  if (dedupe === 'once-per-day' && a.sourceId) {
    const exists = (await sql`
      SELECT 1 FROM points_ledger
      WHERE user_id = ${a.userId} AND source_type = ${a.sourceType}::point_source AND source_id = ${a.sourceId}
        AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date
      LIMIT 1
    `) as unknown[]
    if (exists.length > 0) return noop()
  }

  const now = new Date()
  const periodMonth = now.getMonth() + 1
  const periodYear = now.getFullYear()
  await sql`
    INSERT INTO points_ledger (user_id, division_id, source_type, source_id, points, period_month, period_year, awarded_by, reason)
    VALUES (${a.userId}, ${a.divisionId ?? null}, ${a.sourceType}::point_source, ${a.sourceId ?? null}, ${a.points}, ${periodMonth}, ${periodYear}, ${a.awardedBy ?? null}, ${a.reason ?? null})
  `

  const newTotal = oldTotal + a.points
  const newLevel = levelFromExp(newTotal)
  const leveledUp = newLevel > oldLevel
  if (leveledUp) {
    await sql`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (${a.userId}, ${'Level Up! 🎉'}, ${`Selamat! Kamu naik ke Level ${newLevel} · ${tierTitle(newLevel)}.`}, 'gamification')
    `
  }

  // Hari aktif → update streak + evaluasi auto-badge. Jangan ganggu hasil award bila gagal.
  try { await touchStreakAndBadges(a.userId) } catch (e) { console.error('touchStreakAndBadges failed:', e) }

  return { awarded: true, oldLevel, newLevel, leveledUp, newTotal }
}

/* ═══════════════════ HIGH-LEVEL WRAPPERS ═══════════════════ */
// Dipanggil dari hook API. Selalu dibungkus try/catch di pemanggil supaya
// kegagalan EXP tak pernah menggagalkan mutasi inti (task/project tetap tersimpan).

export async function awardTaskExp(taskId: string, actorId: string): Promise<void> {
  const rows = (await sql`
    SELECT due_date AS "dueDate", division_id AS "divisionId", completed_at AS "completedAt", status, checked
    FROM tasks WHERE id = ${taskId} AND deleted_at IS NULL LIMIT 1
  `) as { dueDate: string | null; divisionId: string | null; completedAt: string | null; status: string; checked: boolean }[]
  const task = rows[0]
  if (!task) return
  if (task.status !== 'Completed' && task.checked !== true) return // hanya saat benar-benar selesai

  // Penerima: assignee task; fallback ke actor bila task tak punya assignee.
  const assignees = (await sql`SELECT user_id AS "userId" FROM task_assignees WHERE task_id = ${taskId}`) as { userId: string }[]
  const recipients = assignees.length > 0 ? assignees.map(a => a.userId) : [actorId]

  const [base, earlyBonus, latePenalty] = await Promise.all([
    getRuleValue('task_complete'), getRuleValue('task_early_bonus'), getRuleValue('task_late_penalty'),
  ])

  const completedAt = task.completedAt ? new Date(task.completedAt) : new Date()
  const due = task.dueDate ? new Date(task.dueDate) : null
  let points = base
  let speed = 'on-time'
  if (due) {
    const msEarly = due.getTime() - completedAt.getTime()
    if (msEarly >= 24 * 3600 * 1000) { points = base + earlyBonus; speed = 'early' }
    else if (msEarly >= 0)           { points = base;              speed = 'on-time' }
    else                             { points = latePenalty;       speed = 'late' }
  }
  const reason = `Task selesai (${speed})`
  for (const uid of recipients) {
    await awardExp({ userId: uid, divisionId: task.divisionId, sourceType: 'task', sourceId: taskId, points, reason, dedupe: 'once-per-source', awardedBy: actorId })
  }
}

export async function awardProjectExp(projectId: string, actorId: string): Promise<void> {
  const rows = (await sql`
    SELECT division_id AS "divisionId", pic_id AS "picId" FROM projects WHERE id = ${projectId} LIMIT 1
  `) as { divisionId: string | null; picId: string | null }[]
  const proj = rows[0]
  if (!proj) return

  const [membersRaw, reqRaw] = await Promise.all([
    sql`SELECT user_id AS "userId" FROM project_members WHERE project_id = ${projectId}`,
    sql`SELECT requested_by AS "requestedBy" FROM approval_requests WHERE related_entity_id = ${projectId} ORDER BY created_at DESC LIMIT 1`,
  ])
  const members = membersRaw as { userId: string }[]
  const reqRows = reqRaw as { requestedBy: string }[]

  const recipients = new Set<string>()
  if (proj.picId) recipients.add(proj.picId)
  if (reqRows[0]?.requestedBy) recipients.add(reqRows[0].requestedBy)
  for (const m of members) recipients.add(m.userId)

  const points = await getRuleValue('project_complete')
  for (const uid of recipients) {
    await awardExp({ userId: uid, divisionId: proj.divisionId, sourceType: 'project', sourceId: projectId, points, reason: 'Project selesai & disetujui', dedupe: 'once-per-source', awardedBy: actorId })
  }
}

export async function awardProgressExp(taskId: string, userId: string, divisionId: string | null): Promise<void> {
  const points = await getRuleValue('progress_update')
  await awardExp({ userId, divisionId, sourceType: 'progress', sourceId: taskId, points, reason: 'Update progress task', dedupe: 'once-per-day', awardedBy: userId })
}
