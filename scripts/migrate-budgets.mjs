import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

await sql`
  CREATE TABLE IF NOT EXISTS budgets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category text NOT NULL,
    planned bigint NOT NULL DEFAULT 0,
    approved bigint,
    actual bigint NOT NULL DEFAULT 0,
    vendor text,
    invoice_link text,
    reimburse_link text,
    payment_status text NOT NULL DEFAULT 'Draft',
    notes text,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  )
`
console.log('✓ budgets table ready')
