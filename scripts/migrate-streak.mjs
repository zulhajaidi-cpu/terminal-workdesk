import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

// ── user_game_stats: streak harian per user ──────────────────────────────
await sql`
  CREATE TABLE IF NOT EXISTS user_game_stats (
    user_id uuid PRIMARY KEY REFERENCES users(id),
    current_streak integer NOT NULL DEFAULT 0,
    longest_streak integer NOT NULL DEFAULT 0,
    last_active_date date,
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`
console.log('✓ user_game_stats ready')

// ── Badge baru utk Phase 3 (idempotent via cek criteria_key) ─────────────
const NEW = [
  { key: 'first_blood', name: 'First Blood',      icon: '🩸', desc: 'Mendapatkan EXP pertamamu di GODA Arena' },
  { key: 'streak_7',    name: 'Streak 7 Hari',    icon: '🔥', desc: 'Aktif mengumpulkan EXP 7 hari berturut-turut' },
  { key: 'streak_30',   name: 'Tak Terhentikan',  icon: '💎', desc: 'Aktif mengumpulkan EXP 30 hari berturut-turut' },
]
for (const b of NEW) {
  const ex = await sql`SELECT 1 FROM badges WHERE criteria_key = ${b.key} LIMIT 1`
  if (ex.length === 0) {
    await sql`INSERT INTO badges (name, description, icon, criteria_key) VALUES (${b.name}, ${b.desc}, ${b.icon}, ${b.key})`
    console.log(`✓ badge "${b.name}" (${b.key}) ditambahkan`)
  } else {
    console.log(`· badge ${b.key} sudah ada`)
  }
}

const all = await sql`SELECT name, criteria_key AS k, icon FROM badges ORDER BY name`
console.log('\nSemua badge:', all.map(b => `${b.icon} ${b.name} [${b.k}]`).join('  '))
console.log('\n✅ migrate-streak done')
