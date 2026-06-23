import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

// Kolom penanda akun hasil daftar mandiri yang menunggu persetujuan admin.
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_approval boolean NOT NULL DEFAULT false`
console.log('✓ kolom users.pending_approval siap')

const n = await sql`SELECT COUNT(*)::int AS n FROM users WHERE pending_approval = true`
console.log(`\n✅ migrate-signup done — ${n[0].n} akun menunggu persetujuan saat ini`)
