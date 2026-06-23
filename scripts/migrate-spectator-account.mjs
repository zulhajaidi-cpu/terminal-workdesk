import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

// ── 1. Tambah value 'spectator' ke enum user_role (idempotent) ──────────
const enumExists = await sql`
  SELECT 1 FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'user_role' AND e.enumlabel = 'spectator'
  LIMIT 1
`
if (enumExists.length === 0) {
  await sql`ALTER TYPE user_role ADD VALUE 'spectator'`
  console.log("✓ enum user_role: 'spectator' ditambahkan")
} else {
  console.log("· enum user_role: 'spectator' sudah ada")
}

// ── 2. Kolom username (nullable, unique case-insensitive) ───────────────
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS username text`
console.log('✓ kolom users.username siap')

await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users (lower(username))`
console.log('✓ unique index uq_users_username siap')

// ── 3. Backfill username untuk user lama yang belum punya ───────────────
const pending = await sql`SELECT id, email FROM users WHERE username IS NULL ORDER BY created_at ASC`
const taken = new Set(
  (await sql`SELECT lower(username) AS u FROM users WHERE username IS NOT NULL`).map(r => r.u)
)

function slugify(local) {
  const base = local.toLowerCase().replace(/[^a-z0-9._]/g, '')
  return base || 'user'
}

for (const u of pending) {
  const local = u.email.split('@')[0]
  let candidate = slugify(local)
  let n = 2
  while (taken.has(candidate)) {
    candidate = `${slugify(local)}${n}`
    n++
  }
  taken.add(candidate)
  await sql`UPDATE users SET username = ${candidate} WHERE id = ${u.id}`
  console.log(`✓ backfill username "${candidate}" untuk ${u.email}`)
}

if (pending.length === 0) console.log('· tidak ada user yang perlu backfill username')

const total = await sql`SELECT COUNT(*)::int AS n FROM users WHERE username IS NOT NULL`
console.log(`\n✅ migrate-spectator-account done — ${total[0].n} user punya username`)
