import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

async function main() {
  console.log('Upgrading calendar_events...')

  // Add new enum values (ALTER TYPE doesn't support $1 params — use raw strings)
  await sql`ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'Event Internal'`
  await sql`ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'Event External'`
  await sql`ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'Photoshoot'`
  await sql`ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'Training'`
  await sql`ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'Lainnya'`
  console.log('  + enum values added')

  // Add event_name column
  await sql`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS event_name TEXT`
  console.log('  + column: event_name')

  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
