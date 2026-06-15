import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

await sql`
  CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL DEFAULT 'mention',
    related_entity_type text,
    related_entity_id uuid,
    is_read boolean NOT NULL DEFAULT false,
    send_email boolean NOT NULL DEFAULT false,
    email_sent boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`
console.log('✓ notifications')

await sql`
  CREATE TABLE IF NOT EXISTS points_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    division_id uuid REFERENCES divisions(id),
    source_type text NOT NULL DEFAULT 'manual',
    source_id uuid,
    points integer NOT NULL,
    period_month smallint NOT NULL,
    period_year smallint NOT NULL,
    awarded_by uuid REFERENCES users(id),
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`
console.log('✓ points_ledger')

await sql`
  CREATE TABLE IF NOT EXISTS gamification_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key text NOT NULL UNIQUE,
    points integer NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    updated_by uuid REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`
console.log('✓ gamification_rules')

await sql`
  CREATE TABLE IF NOT EXISTS badges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    icon text,
    criteria_key text
  )
`
console.log('✓ badges')

await sql`
  CREATE TABLE IF NOT EXISTS user_badges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    badge_id uuid NOT NULL REFERENCES badges(id),
    awarded_at timestamptz NOT NULL DEFAULT now(),
    period text,
    UNIQUE(user_id, badge_id)
  )
`
console.log('✓ user_badges')

await sql`
  CREATE TABLE IF NOT EXISTS monthly_rewards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period_month smallint NOT NULL,
    period_year smallint NOT NULL,
    rank smallint NOT NULL DEFAULT 1,
    reward_name text NOT NULL,
    reward_image_link text,
    winner_user_id uuid REFERENCES users(id),
    notes text,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(period_month, period_year, rank)
  )
`
console.log('✓ monthly_rewards')

await sql`
  CREATE TABLE IF NOT EXISTS activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    details jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`
console.log('✓ activity_logs')
console.log('\n✅ Semua tabel selesai')
