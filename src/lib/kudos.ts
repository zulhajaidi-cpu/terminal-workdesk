import { neon } from '@neondatabase/serverless'
import { awardExp, getRuleValue } from '@/lib/exp'

const sql = neon(process.env.DATABASE_URL!)

/* ═══════════════════ TYPES ═══════════════════ */
export interface KudosFeedItem {
  id: string; otherName: string; otherAvatar: string | null
  message: string | null; points: number; createdAt: string
}
export interface KudosStatus {
  cap: number; usedToday: number; remaining: number; pointsPerKudos: number
  received: KudosFeedItem[]   // kudos yang KAMU terima
  given: KudosFeedItem[]      // kudos yang KAMU beri
}

/* ═══════════════════ STATUS (untuk UI) ═══════════════════ */
export async function getKudosStatus(userId: string): Promise<KudosStatus> {
  const [capV, ppk, usedRows, received, given] = await Promise.all([
    getRuleValue('kudos_daily_cap'),
    getRuleValue('kudos_give'),
    sql`SELECT COUNT(*)::int AS n FROM points_ledger
        WHERE awarded_by = ${userId} AND source_type = 'kudos'
          AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date`,
    sql`SELECT pl.id, u.full_name AS "otherName", u.avatar_url AS "otherAvatar",
               pl.reason AS message, pl.points, pl.created_at AS "createdAt"
        FROM points_ledger pl
        JOIN users u ON u.id = pl.awarded_by
        WHERE pl.user_id = ${userId} AND pl.source_type = 'kudos'
        ORDER BY pl.created_at DESC LIMIT 6`,
    sql`SELECT pl.id, u.full_name AS "otherName", u.avatar_url AS "otherAvatar",
               pl.reason AS message, pl.points, pl.created_at AS "createdAt"
        FROM points_ledger pl
        JOIN users u ON u.id = pl.user_id
        WHERE pl.awarded_by = ${userId} AND pl.source_type = 'kudos'
        ORDER BY pl.created_at DESC LIMIT 6`,
  ])
  const cap = capV || 3
  const usedToday = (usedRows as { n: number }[])[0]?.n ?? 0
  return {
    cap, usedToday, remaining: Math.max(0, cap - usedToday), pointsPerKudos: ppk || 10,
    received: received as KudosFeedItem[],
    given: given as KudosFeedItem[],
  }
}

/* ═══════════════════ KIRIM KUDOS ═══════════════════ */
export interface SendKudosResult { ok: boolean; error?: string; recipientName?: string }

export async function sendKudos(giverId: string, recipientId: string, message?: string): Promise<SendKudosResult> {
  if (!recipientId) return { ok: false, error: 'Pilih rekan dulu.' }
  if (recipientId === giverId) return { ok: false, error: 'Tidak bisa memberi kudos ke diri sendiri 😅' }

  const rec = (await sql`
    SELECT full_name AS "fullName", division_id AS "divisionId"
    FROM users WHERE id = ${recipientId} AND is_active = true AND deleted_at IS NULL LIMIT 1
  `) as { fullName: string; divisionId: string | null }[]
  if (rec.length === 0) return { ok: false, error: 'Rekan tidak ditemukan / non-aktif.' }

  const [cap, alreadyRows, usedRows] = await Promise.all([
    getRuleValue('kudos_daily_cap'),
    // Sudah memberi kudos ke orang ini hari ini?
    sql`SELECT 1 FROM points_ledger
        WHERE awarded_by = ${giverId} AND user_id = ${recipientId} AND source_type = 'kudos'
          AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date
        LIMIT 1`,
    // Total kudos yang sudah diberi hari ini (kuota)
    sql`SELECT COUNT(*)::int AS n FROM points_ledger
        WHERE awarded_by = ${giverId} AND source_type = 'kudos'
          AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date`,
  ])

  if ((alreadyRows as unknown[]).length > 0) {
    return { ok: false, error: `Kamu sudah memberi kudos ke ${rec[0].fullName} hari ini.` }
  }
  const used = (usedRows as { n: number }[])[0]?.n ?? 0
  const capN = cap || 3
  if (used >= capN) return { ok: false, error: `Kuota kudos harianmu (${capN}) sudah habis. Coba lagi besok ya!` }

  const points = await getRuleValue('kudos_give')
  const cleanMsg = (message ?? '').trim().slice(0, 160) || 'Kerja bagus! 👏'

  // Award EXP ke penerima (sourceId = pemberi; dedupe none karena cek manual di atas).
  await awardExp({
    userId: recipientId, divisionId: rec[0].divisionId, sourceType: 'kudos', sourceId: giverId,
    points, reason: cleanMsg, dedupe: 'none', awardedBy: giverId,
  })

  // Notifikasi ke penerima (in-app, nama pemberi).
  const giver = (await sql`SELECT full_name AS "fullName" FROM users WHERE id = ${giverId} LIMIT 1`) as { fullName: string }[]
  const giverName = giver[0]?.fullName ?? 'Seseorang'
  await sql`
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (${recipientId}, ${'Kamu dapat Kudos! 👏'},
            ${`${giverName} memberimu kudos: "${cleanMsg}" (+${points} EXP)`}, 'gamification')
  `

  return { ok: true, recipientName: rec[0].fullName }
}
