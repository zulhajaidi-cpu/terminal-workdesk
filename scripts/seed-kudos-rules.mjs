import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

for (const [key, points] of [['kudos_give', 10], ['kudos_daily_cap', 3]]) {
  await sql`
    INSERT INTO gamification_rules (event_key, points, is_active)
    VALUES (${key}, ${points}, true)
    ON CONFLICT (event_key) DO NOTHING
  `
  console.log(`✓ rule ${key} = ${points}`)
}
const rows = await sql`SELECT event_key, points FROM gamification_rules WHERE event_key IN ('kudos_give','kudos_daily_cap')`
console.log('Verifikasi:', rows)
console.log('\n✅ seed-kudos-rules done')
