import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

async function main() {
  const divisions = await sql`SELECT id, name FROM divisions WHERE deleted_at IS NULL`
  console.log(`Found ${divisions.length} divisions`)

  for (const div of divisions) {
    const slug = div.name.toLowerCase().replace(/\s+/g, '-')
    const result = await sql`
      INSERT INTO chat_channels (name, description, type, division_id)
      VALUES (${slug}, ${'Channel ' + div.name}, 'division', ${div.id})
      ON CONFLICT DO NOTHING
      RETURNING id, name
    `
    if (result.length > 0) console.log(`  + channel: #${result[0].name}`)
    else console.log(`  skip: #${slug} (already exists)`)
  }
  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
