import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'

const sql = neon(process.env.DATABASE_URL)

async function main() {
  console.log('Seeding database...')

  // 1. Divisions
  await sql`
    INSERT INTO divisions (id, name, description) VALUES
      ('11111111-1111-1111-1111-111111111111', 'Branding', 'Divisi Branding & Visual Identity'),
      ('22222222-2222-2222-2222-222222222222', 'Creative Marketing', 'Divisi Creative Marketing & Campaign'),
      ('33333333-3333-3333-3333-333333333333', 'Retail', 'Divisi Retail & Sales Support')
    ON CONFLICT DO NOTHING
  `
  console.log('✓ Divisions created')

  // 2. Super Admin user
  const hash = await bcrypt.hash('Admin@2026!', 12)
  await sql`
    INSERT INTO users (id, email, full_name, role, division_id, is_active, password_hash)
    VALUES (
      gen_random_uuid(),
      'superadmin@goda.id',
      'Super Admin GODA',
      'super_admin',
      NULL,
      true,
      ${hash}
    )
    ON CONFLICT (email) DO NOTHING
  `
  console.log('✓ Super Admin created  →  superadmin@goda.id / Admin@2026!')

  // 3. Gamification rules
  await sql`
    INSERT INTO gamification_rules (event_key, points) VALUES
      ('task_completed', 10),
      ('task_early_completion', 5),
      ('project_completed', 50),
      ('kpi_achieved', 30),
      ('kudos_given', 2),
      ('kudos_received', 5),
      ('no_overdue_week', 15),
      ('approval_fast', 5)
    ON CONFLICT (event_key) DO NOTHING
  `
  console.log('✓ Gamification rules created')

  // 4. Badges
  await sql`
    INSERT INTO badges (id, name, description, icon, criteria_key) VALUES
      (gen_random_uuid(), 'Fast Finisher', 'Menyelesaikan 10 task lebih awal dari deadline', '⚡', 'task_early_10'),
      (gen_random_uuid(), 'No Overdue', 'Tidak ada task overdue selama 1 bulan penuh', '🛡️', 'no_overdue_month'),
      (gen_random_uuid(), 'Project Hero', 'Menyelesaikan 5 project', '🏆', 'project_5'),
      (gen_random_uuid(), 'KPI Champion', 'Mencapai KPI 100% selama 3 bulan berturut', '🎯', 'kpi_100_3months'),
      (gen_random_uuid(), 'Team Player', 'Menerima 20 kudos dari rekan', '🤝', 'kudos_received_20')
    ON CONFLICT DO NOTHING
  `
  console.log('✓ Badges created')

  console.log('\n✅ Seed complete!')
  console.log('Login: superadmin@goda.id')
  console.log('Password: Admin@2026!')
}

main().catch(e => { console.error(e); process.exit(1) })
