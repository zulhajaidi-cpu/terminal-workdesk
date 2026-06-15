'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export async function saveMood(emoji: string, label: string) {
  const session = await getSession()
  if (!session) return { error: 'Not authenticated' }

  // Date in WIB (Asia/Jakarta) timezone — YYYY-MM-DD
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  await sql`
    INSERT INTO user_moods (user_id, mood_emoji, mood_label, mood_date)
    VALUES (${session.id}, ${emoji}, ${label}, ${today})
    ON CONFLICT (user_id, mood_date) DO UPDATE SET
      mood_emoji = EXCLUDED.mood_emoji,
      mood_label = EXCLUDED.mood_label
  `

  revalidatePath('/dashboard')
  return { success: true }
}
