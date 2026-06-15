import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text`
console.log('✓ bio column added to users')
