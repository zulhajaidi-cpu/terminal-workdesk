import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

// calendar_events
await sql`
  CREATE TABLE IF NOT EXISTS calendar_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    event_type text NOT NULL DEFAULT 'Other',
    division_id uuid REFERENCES divisions(id),
    related_project_id uuid REFERENCES projects(id),
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    all_day boolean NOT NULL DEFAULT false,
    location text,
    link text,
    reminder_rule text,
    notes text,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  )
`
console.log('✓ calendar_events table ready')

// event_participants
await sql`
  CREATE TABLE IF NOT EXISTS event_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id),
    role_in_event text,
    notified_at timestamptz,
    UNIQUE(event_id, user_id)
  )
`
console.log('✓ event_participants table ready')

// assets
await sql`
  CREATE TABLE IF NOT EXISTS assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    category text NOT NULL,
    division_id uuid NOT NULL REFERENCES divisions(id),
    drive_link text NOT NULL,
    version text,
    status text NOT NULL DEFAULT 'Draft',
    uploaded_by uuid NOT NULL REFERENCES users(id),
    related_project_id uuid REFERENCES projects(id),
    description text,
    tags text[],
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  )
`
console.log('✓ assets table ready')
