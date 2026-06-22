import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

// ── reward_catalog: reward yang dikelola admin (level/badge/manual) ──────
await sql`
  CREATE TABLE IF NOT EXISTS reward_catalog (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unlock_type text NOT NULL DEFAULT 'level',   -- 'level' | 'badge' | 'manual'
    threshold integer,                            -- level minimal (unlock_type='level')
    badge_id uuid REFERENCES badges(id),          -- unlock_type='badge'
    name text NOT NULL,
    description text,
    image_url text,
    stock integer,                                -- null = unlimited
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`
console.log('✓ reward_catalog ready')

// ── reward_claims: ledger klaim (claimed → fulfilled) ────────────────────
await sql`
  CREATE TABLE IF NOT EXISTS reward_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    source text NOT NULL,                          -- 'monthly' | 'catalog'
    catalog_id uuid REFERENCES reward_catalog(id),
    monthly_reward_id uuid REFERENCES monthly_rewards(id),
    title text NOT NULL,                           -- snapshot nama reward
    image_url text,                                -- snapshot gambar
    status text NOT NULL DEFAULT 'claimed',        -- 'claimed' | 'fulfilled' | 'rejected'
    period_month smallint,
    period_year smallint,
    claimed_at timestamptz NOT NULL DEFAULT now(),
    fulfilled_at timestamptz,
    fulfilled_by uuid REFERENCES users(id),
    notes text
  )
`
console.log('✓ reward_claims ready')

// Cegah klaim ganda. COALESCE agar kolom null ikut diperhitungkan unik.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_claims_dedupe
  ON reward_claims (
    user_id, source,
    COALESCE(catalog_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(monthly_reward_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(period_month, 0),
    COALESCE(period_year, 0)
  )
`
console.log('✓ uq_reward_claims_dedupe ready')

await sql`CREATE INDEX IF NOT EXISTS idx_reward_claims_user ON reward_claims(user_id)`
await sql`CREATE INDEX IF NOT EXISTS idx_reward_claims_status ON reward_claims(status)`
console.log('✓ reward_claims indexes ready')

// ── Seed contoh: Kopi Fore @ Level 5 ─────────────────────────────────────
const kopi = await sql`SELECT id FROM reward_catalog WHERE name = 'Kopi Fore' LIMIT 1`
if (kopi.length === 0) {
  await sql`
    INSERT INTO reward_catalog (unlock_type, threshold, name, description, image_url, stock, is_active)
    VALUES ('level', 5, 'Kopi Fore',
            'Voucher Kopi Fore gratis untuk yang mencapai Level 5. Selamat ngopi, Hustler! ☕',
            null, null, true)
  `
  console.log('✓ seeded catalog: Kopi Fore (Level 5)')
} else {
  console.log('· Kopi Fore already seeded')
}

// ── Seed contoh: monthly_rewards rank 1 "Kanky Running Shoes" bulan ini ───
const now = new Date()
const m = now.getMonth() + 1
const y = now.getFullYear()
const anyAdmin = await sql`
  SELECT id FROM users WHERE role IN ('super_admin','head_director') AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1
`
const adminId = anyAdmin[0]?.id ?? null
const existingMr = await sql`
  SELECT id FROM monthly_rewards WHERE period_month = ${m} AND period_year = ${y} AND rank = 1 LIMIT 1
`
if (existingMr.length === 0 && adminId) {
  await sql`
    INSERT INTO monthly_rewards (period_month, period_year, rank, reward_name, notes, created_by)
    VALUES (${m}, ${y}, 1, 'Kanky Running Shoes', 'Hadiah juara 1 EXP bulan ini', ${adminId})
  `
  console.log(`✓ seeded monthly_rewards rank1 ${m}/${y}: Kanky Running Shoes`)
} else {
  console.log('· monthly reward rank1 this month already exists (or no admin found)')
}

console.log('\n✅ migrate-rewards done')
