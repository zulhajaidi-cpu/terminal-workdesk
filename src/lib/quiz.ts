import { neon } from '@neondatabase/serverless'
import { awardExp } from '@/lib/exp'

const sql = neon(process.env.DATABASE_URL!)

/* ═══════════════════ TYPES ═══════════════════ */
export interface QuizQuestionPublic {
  id: string
  question: string
  options: string[]
  category: string
}
export interface QuizAttemptResult {
  selectedIndex: number
  isCorrect: boolean
  correctIndex: number
  explanation: string
  expAwarded: number
}
export interface TodayQuiz {
  question: QuizQuestionPublic | null   // null = bank soal kosong
  answered: boolean
  result: QuizAttemptResult | null      // terisi bila sudah menjawab hari ini
  expReward: number                     // EXP bila benar
}

/* ═══════════════════ DAILY PICK (deterministik) ═══════════════════ */
// Tanggal hari ini di Asia/Jakarta sebagai 'YYYY-MM-DD'.
export function todayJakarta(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}
function epochDay(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 86_400_000)
}

interface RawQuestion { id: string; question: string; options: string[]; correctIndex: number; explanation: string | null; category: string; points: number }

// Kunci jawaban edukatif: pakai explanation; bila kosong, restate opsi yang benar (tanpa mengarang fakta).
function answerKey(q: RawQuestion): string {
  return q.explanation?.trim() || `Jawaban yang benar: ${q.options[q.correctIndex]}`
}

// Soal "hari ini" — sama untuk semua user, berotasi tiap hari. Server-authoritative.
async function pickTodayQuestion(dateStr: string): Promise<RawQuestion | null> {
  const rows = (await sql`
    SELECT id, question, options, correct_index AS "correctIndex", explanation, category, points
    FROM quiz_questions WHERE is_active = true ORDER BY id ASC
  `) as RawQuestion[]
  if (rows.length === 0) return null
  return rows[epochDay(dateStr) % rows.length]
}

/* ═══════════════════ READ ═══════════════════ */
export async function getTodayQuiz(userId: string): Promise<TodayQuiz> {
  const dateStr = todayJakarta()
  const q = await pickTodayQuestion(dateStr)
  if (!q) return { question: null, answered: false, result: null, expReward: 0 }
  const expReward = q.points  // EXP per-soal sesuai level

  const attempts = (await sql`
    SELECT selected_index AS "selectedIndex", is_correct AS "isCorrect", exp_awarded AS "expAwarded"
    FROM quiz_attempts WHERE user_id = ${userId} AND quiz_date = ${dateStr} LIMIT 1
  `) as { selectedIndex: number; isCorrect: boolean; expAwarded: number }[]

  const pub: QuizQuestionPublic = { id: q.id, question: q.question, options: q.options, category: q.category }

  if (attempts.length > 0) {
    const a = attempts[0]
    return {
      question: pub, answered: true, expReward,
      result: { selectedIndex: a.selectedIndex, isCorrect: a.isCorrect, correctIndex: q.correctIndex, explanation: answerKey(q), expAwarded: a.expAwarded },
    }
  }
  // Belum menjawab → JANGAN bocorkan correctIndex/explanation.
  return { question: pub, answered: false, result: null, expReward }
}

/* ═══════════════════ SUBMIT ═══════════════════ */
export interface SubmitResult {
  ok: boolean
  error?: string
  result?: QuizAttemptResult
  leveledUp?: boolean
  newLevel?: number
}

export async function submitAnswer(userId: string, questionId: string, selectedIndex: number): Promise<SubmitResult> {
  const dateStr = todayJakarta()
  const q = await pickTodayQuestion(dateStr)
  if (!q) return { ok: false, error: 'Tidak ada kuis hari ini.' }

  // Anti-cheat: hanya soal "hari ini" yang boleh dijawab untuk EXP.
  if (q.id !== questionId) return { ok: false, error: 'Soal sudah kedaluwarsa, muat ulang halaman.' }
  if (selectedIndex == null || selectedIndex < 0 || selectedIndex >= q.options.length) {
    return { ok: false, error: 'Jawaban tidak valid.' }
  }

  // Sudah menjawab hari ini? (unique index juga menjaga di level DB)
  const existing = (await sql`
    SELECT 1 FROM quiz_attempts WHERE user_id = ${userId} AND quiz_date = ${dateStr} LIMIT 1
  `) as unknown[]
  if (existing.length > 0) return { ok: false, error: 'Kamu sudah menjawab kuis hari ini.' }

  const isCorrect = selectedIndex === q.correctIndex
  let expAwarded = 0
  let leveledUp = false
  let newLevel: number | undefined

  if (isCorrect) {
    const reward = q.points  // EXP per-soal sesuai level
    const ur = (await sql`SELECT division_id AS "divisionId" FROM users WHERE id = ${userId} LIMIT 1`) as { divisionId: string | null }[]
    const res = await awardExp({
      userId, divisionId: ur[0]?.divisionId ?? null, sourceType: 'quiz', sourceId: q.id,
      points: reward, reason: 'The Daily Grind — jawaban benar', dedupe: 'once-per-day', awardedBy: userId,
    })
    if (res.awarded) expAwarded = reward
    leveledUp = res.leveledUp
    newLevel = res.newLevel
  }

  try {
    await sql`
      INSERT INTO quiz_attempts (user_id, question_id, quiz_date, selected_index, is_correct, exp_awarded)
      VALUES (${userId}, ${q.id}, ${dateStr}, ${selectedIndex}, ${isCorrect}, ${expAwarded})
    `
  } catch (e: any) {
    if (e?.code === '23505') return { ok: false, error: 'Kamu sudah menjawab kuis hari ini.' }
    throw e
  }

  return {
    ok: true,
    result: { selectedIndex, isCorrect, correctIndex: q.correctIndex, explanation: answerKey(q), expAwarded },
    leveledUp, newLevel,
  }
}

/* ═══════════════════ ADMIN (super_admin) ═══════════════════ */
export interface AdminQuestion {
  id: string; question: string; options: string[]; correctIndex: number
  explanation: string | null; category: string; points: number; isActive: boolean
}

export async function listQuestions(): Promise<AdminQuestion[]> {
  return (await sql`
    SELECT id, question, options, correct_index AS "correctIndex", explanation,
           category, points, is_active AS "isActive"
    FROM quiz_questions ORDER BY created_at DESC
  `) as AdminQuestion[]
}

export interface NewQuestion {
  question: string; options: string[]; correctIndex: number
  explanation?: string | null; category?: string; points?: number
}
export async function createQuestion(q: NewQuestion): Promise<{ ok: boolean; error?: string }> {
  const opts = (q.options ?? []).map(o => String(o ?? '').trim()).filter(o => o.length > 0)
  if (!q.question?.trim()) return { ok: false, error: 'Pertanyaan wajib diisi.' }
  if (opts.length < 2) return { ok: false, error: 'Minimal 2 pilihan jawaban.' }
  if (q.correctIndex == null || q.correctIndex < 0 || q.correctIndex >= opts.length) {
    return { ok: false, error: 'Pilih jawaban benar yang valid.' }
  }
  const points = Number.isFinite(q.points) && (q.points as number) > 0 ? Math.round(q.points as number) : 15
  await sql`
    INSERT INTO quiz_questions (question, options, correct_index, explanation, category, points)
    VALUES (${q.question.trim()}, ${JSON.stringify(opts)}, ${q.correctIndex},
            ${q.explanation?.trim() || null}, ${q.category?.trim() || 'Umum'}, ${points})
  `
  return { ok: true }
}

export async function toggleQuestion(id: string, isActive: boolean): Promise<void> {
  await sql`UPDATE quiz_questions SET is_active = ${isActive} WHERE id = ${id}`
}
