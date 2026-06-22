import { neon } from '@neondatabase/serverless'
import { levelFromExp, getUserExp } from '@/lib/exp'

const sql = neon(process.env.DATABASE_URL!)

/* ═══════════════════ TYPES ═══════════════════ */
export interface EligibleReward {
  key: string                       // id unik untuk React key + payload klaim
  source: 'monthly' | 'catalog'
  refId: string                     // catalog.id atau monthly_rewards.id
  title: string
  description: string | null
  imageUrl: string | null
  reason: string                    // "Juara 1 EXP Mei 2026" / "Capai Level 5"
  periodMonth: number | null
  periodYear: number | null
  soldOut: boolean
}
export interface LockedReward {
  key: string
  title: string
  description: string | null
  imageUrl: string | null
  requirement: string               // "Capai Level 5"
}
export interface ClaimedReward {
  id: string
  source: string
  title: string
  imageUrl: string | null
  status: string                    // 'claimed' | 'fulfilled' | 'rejected'
  claimedAt: string
  fulfilledAt: string | null
  notes: string | null
}
export interface MyRewards {
  eligible: EligibleReward[]
  locked: LockedReward[]
  claimed: ClaimedReward[]
}

const MONTHS_ID = ['', 'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember']

/* ═══════════════════ HELPERS ═══════════════════ */
// Rank user (1-based) berdasarkan SUM EXP pada periode tertentu (excl. kpi).
async function userRankInPeriod(userId: string, month: number, year: number): Promise<number | null> {
  const rows = (await sql`
    WITH totals AS (
      SELECT user_id, SUM(points)::int AS tot
      FROM points_ledger
      WHERE source_type <> 'kpi' AND period_month = ${month} AND period_year = ${year}
      GROUP BY user_id
    )
    SELECT (SELECT COUNT(*) FROM totals t2 WHERE t2.tot > t1.tot) + 1 AS rank
    FROM totals t1 WHERE t1.user_id = ${userId}
  `) as { rank: number }[]
  return rows[0]?.rank ?? null
}

/* ═══════════════════ ELIGIBILITY ═══════════════════ */
// Reward bulanan: hanya periode yang SUDAH SELESAI (bukan bulan berjalan) & user masuk rank.
export async function getMonthlyEligible(userId: string): Promise<EligibleReward[]> {
  const now = new Date()
  const curM = now.getMonth() + 1
  const curY = now.getFullYear()

  const rewards = (await sql`
    SELECT id, period_month AS "periodMonth", period_year AS "periodYear",
           rank, reward_name AS "rewardName", reward_image_link AS "rewardImageLink", notes
    FROM monthly_rewards
    WHERE (period_year < ${curY}) OR (period_year = ${curY} AND period_month < ${curM})
    ORDER BY period_year DESC, period_month DESC, rank ASC
  `) as { id: string; periodMonth: number; periodYear: number; rank: number;
          rewardName: string; rewardImageLink: string | null; notes: string | null }[]

  if (rewards.length === 0) return []

  // Klaim monthly yang sudah ada untuk user ini.
  const claimed = (await sql`
    SELECT monthly_reward_id AS "mrId" FROM reward_claims
    WHERE user_id = ${userId} AND source = 'monthly' AND monthly_reward_id IS NOT NULL
  `) as { mrId: string }[]
  const claimedSet = new Set(claimed.map(c => c.mrId))

  const out: EligibleReward[] = []
  for (const r of rewards) {
    if (claimedSet.has(r.id)) continue
    const rank = await userRankInPeriod(userId, r.periodMonth, r.periodYear)
    if (rank === null || rank > r.rank) continue
    out.push({
      key: `monthly:${r.id}`,
      source: 'monthly',
      refId: r.id,
      title: r.rewardName,
      description: r.notes,
      imageUrl: r.rewardImageLink,
      reason: `Juara ${r.rank} EXP ${MONTHS_ID[r.periodMonth]} ${r.periodYear}`,
      periodMonth: r.periodMonth,
      periodYear: r.periodYear,
      soldOut: false,
    })
  }
  return out
}

// Reward katalog (level/badge). Mengembalikan eligible & locked terpisah.
export async function getCatalogRewards(userId: string): Promise<{ eligible: EligibleReward[]; locked: LockedReward[] }> {
  const catalog = (await sql`
    SELECT id, unlock_type AS "unlockType", threshold, badge_id AS "badgeId",
           name, description, image_url AS "imageUrl", stock
    FROM reward_catalog
    WHERE is_active = true
    ORDER BY COALESCE(threshold, 0) ASC, name ASC
  `) as { id: string; unlockType: string; threshold: number | null; badgeId: string | null;
          name: string; description: string | null; imageUrl: string | null; stock: number | null }[]

  if (catalog.length === 0) return { eligible: [], locked: [] }

  const [expTotal, myClaims, myBadges, claimCounts] = await Promise.all([
    getUserExp(userId),
    sql`SELECT catalog_id AS "catalogId" FROM reward_claims WHERE user_id = ${userId} AND source = 'catalog' AND catalog_id IS NOT NULL`,
    sql`SELECT badge_id AS "badgeId" FROM user_badges WHERE user_id = ${userId}`,
    sql`SELECT catalog_id AS "catalogId", COUNT(*)::int AS n FROM reward_claims WHERE source = 'catalog' AND catalog_id IS NOT NULL GROUP BY catalog_id`,
  ])
  const myLevel = levelFromExp(expTotal)
  const claimedSet = new Set((myClaims as { catalogId: string }[]).map(c => c.catalogId))
  const badgeSet = new Set((myBadges as { badgeId: string }[]).map(b => b.badgeId))
  const countMap = new Map((claimCounts as { catalogId: string; n: number }[]).map(c => [c.catalogId, c.n]))

  const eligible: EligibleReward[] = []
  const locked: LockedReward[] = []

  for (const c of catalog) {
    if (claimedSet.has(c.id)) continue // sudah diklaim → muncul di daftar claimed, bukan di sini

    let meets = false
    let requirement = ''
    if (c.unlockType === 'level') {
      meets = c.threshold != null && myLevel >= c.threshold
      requirement = `Capai Level ${c.threshold ?? '?'}`
    } else if (c.unlockType === 'badge') {
      meets = c.badgeId != null && badgeSet.has(c.badgeId)
      requirement = 'Dapatkan badge khusus'
    } else {
      // 'manual' → tidak otomatis eligible; hanya admin yang memberi (dilewati di UI user).
      continue
    }

    if (meets) {
      const used = countMap.get(c.id) ?? 0
      const soldOut = c.stock != null && used >= c.stock
      eligible.push({
        key: `catalog:${c.id}`,
        source: 'catalog',
        refId: c.id,
        title: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        reason: requirement,
        periodMonth: null,
        periodYear: null,
        soldOut,
      })
    } else {
      locked.push({
        key: `catalog:${c.id}`,
        title: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        requirement,
      })
    }
  }
  return { eligible, locked }
}

export async function getMyRewards(userId: string): Promise<MyRewards> {
  const [monthly, cat, claimedRows] = await Promise.all([
    getMonthlyEligible(userId),
    getCatalogRewards(userId),
    sql`
      SELECT id, source, title, image_url AS "imageUrl", status,
             claimed_at AS "claimedAt", fulfilled_at AS "fulfilledAt", notes
      FROM reward_claims
      WHERE user_id = ${userId}
      ORDER BY claimed_at DESC
    `,
  ])
  return {
    eligible: [...monthly, ...cat.eligible],
    locked: cat.locked,
    claimed: claimedRows as ClaimedReward[],
  }
}

/* ═══════════════════ CLAIM ═══════════════════ */
export interface ClaimArgs {
  userId: string
  source: 'monthly' | 'catalog'
  refId: string
}
export interface ClaimResult { ok: boolean; error?: string; title?: string }

async function notifyAdmins(title: string, message: string) {
  await sql`
    INSERT INTO notifications (user_id, title, message, type)
    SELECT id, ${title}, ${message}, 'gamification'
    FROM users WHERE role IN ('super_admin','head_director') AND deleted_at IS NULL
  `
}

// Validasi ulang eligibility di server (anti-tamper) lalu catat klaim.
export async function claimReward(a: ClaimArgs): Promise<ClaimResult> {
  // Cari reward yang benar-benar eligible untuk user ini.
  const my = await getMyRewards(a.userId)
  const match = my.eligible.find(e => e.source === a.source && e.refId === a.refId)
  if (!match) return { ok: false, error: 'Reward ini belum bisa kamu klaim.' }
  if (match.soldOut) return { ok: false, error: 'Stok reward ini sudah habis.' }

  const userRow = (await sql`SELECT full_name AS "fullName" FROM users WHERE id = ${a.userId} LIMIT 1`) as { fullName: string }[]
  const fullName = userRow[0]?.fullName ?? 'Seseorang'

  try {
    await sql`
      INSERT INTO reward_claims (user_id, source, catalog_id, monthly_reward_id, title, image_url, status, period_month, period_year)
      VALUES (
        ${a.userId}, ${a.source},
        ${a.source === 'catalog' ? a.refId : null},
        ${a.source === 'monthly' ? a.refId : null},
        ${match.title}, ${match.imageUrl}, 'claimed',
        ${match.periodMonth}, ${match.periodYear}
      )
    `
  } catch (e: any) {
    // Unique violation = sudah diklaim sebelumnya.
    if (String(e?.message ?? '').includes('uq_reward_claims_dedupe') || e?.code === '23505') {
      return { ok: false, error: 'Reward ini sudah pernah kamu klaim.' }
    }
    throw e
  }

  // Notif ke user + admin (in-app, tanpa email).
  await sql`
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (${a.userId}, ${'Reward diklaim 🎁'},
            ${`Kamu mengklaim "${match.title}". Tunggu serah-terima dari admin ya!`}, 'gamification')
  `
  await notifyAdmins('Klaim reward baru 📦', `${fullName} mengklaim "${match.title}". Siapkan serah-terimanya.`)

  return { ok: true, title: match.title }
}

/* ═══════════════════ FULFILL (admin) ═══════════════════ */
export interface FulfillResult { ok: boolean; error?: string }

export async function fulfillClaim(claimId: string, adminId: string, notes?: string): Promise<FulfillResult> {
  const rows = (await sql`
    SELECT user_id AS "userId", title, status FROM reward_claims WHERE id = ${claimId} LIMIT 1
  `) as { userId: string; title: string; status: string }[]
  const claim = rows[0]
  if (!claim) return { ok: false, error: 'Klaim tidak ditemukan.' }
  if (claim.status === 'fulfilled') return { ok: false, error: 'Klaim ini sudah diserahkan.' }

  await sql`
    UPDATE reward_claims
    SET status = 'fulfilled', fulfilled_at = now(), fulfilled_by = ${adminId},
        notes = ${notes?.trim() || null}
    WHERE id = ${claimId}
  `
  await sql`
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (${claim.userId}, ${'Reward siap diterima ✅'},
            ${`Reward "${claim.title}" sudah ditandai diserahkan oleh admin.`}, 'gamification')
  `
  return { ok: true }
}

/* ═══════════════════ ADMIN QUERIES ═══════════════════ */
export async function getAllClaims(): Promise<any[]> {
  return (await sql`
    SELECT rc.id, rc.source, rc.title, rc.status, rc.claimed_at AS "claimedAt",
           rc.fulfilled_at AS "fulfilledAt", rc.notes,
           u.full_name AS "userName", u.avatar_url AS "userAvatar"
    FROM reward_claims rc
    JOIN users u ON u.id = rc.user_id
    ORDER BY (rc.status = 'claimed') DESC, rc.claimed_at DESC
    LIMIT 100
  `) as any[]
}

export async function getCatalogForAdmin(): Promise<any[]> {
  return (await sql`
    SELECT rc.id, rc.unlock_type AS "unlockType", rc.threshold, rc.badge_id AS "badgeId",
           rc.name, rc.description, rc.image_url AS "imageUrl", rc.stock, rc.is_active AS "isActive",
           (SELECT COUNT(*)::int FROM reward_claims c WHERE c.catalog_id = rc.id) AS "claimedCount"
    FROM reward_catalog rc
    ORDER BY rc.created_at DESC
  `) as any[]
}

/* ═══════════════════ REWARD BULAN INI (live standings + admin) ═══════════════════ */
export interface MonthlyStanding { rank: number; userId: string; fullName: string; avatarUrl: string | null; exp: number }
export interface MonthlyRewardRow {
  id: string; periodMonth: number; periodYear: number; rank: number
  rewardName: string; rewardImageLink: string | null; notes: string | null
  standing: MonthlyStanding | null   // siapa yg saat ini ada di posisi rank ini (live, bisa berubah)
}
export interface CurrentMonthRewards {
  periodMonth: number; periodYear: number; monthLabel: string
  rewards: MonthlyRewardRow[]
  liveTop: MonthlyStanding[]   // top 3 EXP bulan ini, ditampilkan walau reward belum didefinisikan admin
}

// Hadiah bulan berjalan + "juara sementara" (live, dihitung dari EXP bulan ini — bisa berubah sampai bulan selesai).
export async function getCurrentMonthRewards(): Promise<CurrentMonthRewards> {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [rewards, standingsRows] = await Promise.all([
    sql`
      SELECT id, period_month AS "periodMonth", period_year AS "periodYear", rank,
             reward_name AS "rewardName", reward_image_link AS "rewardImageLink", notes
      FROM monthly_rewards
      WHERE period_month = ${month} AND period_year = ${year}
      ORDER BY rank ASC
    `,
    sql`
      SELECT u.id AS "userId", u.full_name AS "fullName", u.avatar_url AS "avatarUrl",
             SUM(pl.points)::int AS exp
      FROM points_ledger pl
      JOIN users u ON u.id = pl.user_id
      WHERE pl.source_type <> 'kpi' AND pl.period_month = ${month} AND pl.period_year = ${year}
      GROUP BY u.id, u.full_name, u.avatar_url
      ORDER BY exp DESC
      LIMIT 10
    `,
  ])

  const standings = (standingsRows as { userId: string; fullName: string; avatarUrl: string | null; exp: number }[])
    .map((s, i) => ({ rank: i + 1, ...s }))

  const rows = (rewards as { id: string; periodMonth: number; periodYear: number; rank: number;
    rewardName: string; rewardImageLink: string | null; notes: string | null }[]).map(r => ({
    ...r,
    standing: standings.find(s => s.rank === r.rank) ?? null,
  }))

  return { periodMonth: month, periodYear: year, monthLabel: `${MONTHS_ID[month]} ${year}`, rewards: rows, liveTop: standings.slice(0, 3) }
}

export interface UpsertMonthlyRewardArgs {
  rank: number; rewardName: string; notes?: string | null; rewardImageLink?: string | null
  periodMonth?: number; periodYear?: number; adminId: string
}
export interface MonthlyRewardMutResult { ok: boolean; error?: string }

// Upsert per (periodMonth, periodYear, rank) — admin "edit hadiah rank ini bulan ini" tanpa duplikat.
export async function upsertMonthlyReward(a: UpsertMonthlyRewardArgs): Promise<MonthlyRewardMutResult> {
  if (!a.rewardName?.trim()) return { ok: false, error: 'Nama hadiah wajib diisi.' }
  if (!a.rank || a.rank < 1) return { ok: false, error: 'Rank tidak valid.' }
  const now = new Date()
  const month = a.periodMonth ?? now.getMonth() + 1
  const year = a.periodYear ?? now.getFullYear()

  await sql`
    INSERT INTO monthly_rewards (period_month, period_year, rank, reward_name, reward_image_link, notes, created_by)
    VALUES (${month}, ${year}, ${a.rank}, ${a.rewardName.trim()}, ${a.rewardImageLink?.trim() || null}, ${a.notes?.trim() || null}, ${a.adminId})
    ON CONFLICT (period_month, period_year, rank)
    DO UPDATE SET reward_name = EXCLUDED.reward_name, reward_image_link = EXCLUDED.reward_image_link,
                  notes = EXCLUDED.notes, updated_at = now()
  `
  return { ok: true }
}

export async function deleteMonthlyReward(id: string): Promise<MonthlyRewardMutResult> {
  try {
    await sql`DELETE FROM monthly_rewards WHERE id = ${id}`
    return { ok: true }
  } catch (e: any) {
    if (e?.code === '23503') return { ok: false, error: 'Hadiah ini sudah ada yang mengklaim, tidak bisa dihapus.' }
    throw e
  }
}
