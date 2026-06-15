/**
 * Seed script: Import Creative Marketing data from Excel
 * Projects, KPIs, Tasks + create missing users
 */

const { neon } = require('@neondatabase/serverless')
const bcrypt = require('bcryptjs')
const XLSX = require('xlsx')
const { randomUUID } = require('crypto')

const DB = 'postgresql://neondb_owner:npg_Jr9pXARs8eGu@ep-super-glitter-ao6myy3q-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
const sql = neon(DB)

const DIVISION_CM = '22222222-2222-2222-2222-222222222222'
const EXCEL_PATH = 'C:/Users/AXIOO PONGO 725/Downloads/KPI Tim Creative Marketing 2026.xlsx'

// ── Map progress text → task_status enum ───────────────────────────────────
function toTaskStatus(s) {
  if (!s) return 'To Do'
  const v = s.toLowerCase()
  if (v.includes('selesai')) return 'Completed'
  if (v.includes('proses') || v.includes('progress')) return 'In Progress'
  return 'To Do'
}

// ── Split PIC string → array of name tokens ────────────────────────────────
function splitPIC(pic) {
  return (pic || '').split(/[+,&]/).map(s => s.trim()).filter(Boolean)
}

// ── Normalise name for lookup ───────────────────────────────────────────────
function norm(n) {
  return n.toLowerCase()
    .replace('rayhan', 'raihan')   // typo in Excel
    .replace('tim terminal', '')
    .trim()
}

async function main() {
  const wb = XLSX.readFile(EXCEL_PATH)

  // ── 1. Parse Projects ───────────────────────────────────────────────────
  const projRows = XLSX.utils.sheet_to_json(wb.Sheets['Projects Utama Juni'], { header: 1 })
  const projects = []
  for (let i = 2; i < projRows.length; i++) {
    const r = projRows[i]
    if (!r[0] || !r[1]) break
    projects.push({ no: r[0], name: r[1], ownerName: r[2], supportName: r[3], notes: r[4] || '' })
  }

  // ── 2. Parse KPIs (multiple users in one sheet) ─────────────────────────
  const kpiRows = XLSX.utils.sheet_to_json(wb.Sheets['KPI Individu Juni'], { header: 1 })
  const kpiBlocks = []
  let curUser = null, curKPIs = []
  for (const row of kpiRows) {
    if (!row || !row[0]) continue
    const cell = String(row[0])
    if (cell.startsWith('KPI Juni 2026 —')) {
      if (curUser) kpiBlocks.push({ user: curUser, kpis: curKPIs })
      curUser = cell.replace('KPI Juni 2026 —', '').trim()
      curKPIs = []
    } else if (typeof row[0] === 'number' && row[2]) {
      curKPIs.push({ no: row[0], objective: row[1], kpiName: row[2], weight: Math.round(Number(row[3]) * 100) })
    }
  }
  if (curUser) kpiBlocks.push({ user: curUser, kpis: curKPIs })

  // ── 3. Parse Tasks ──────────────────────────────────────────────────────
  const taskRows = XLSX.utils.sheet_to_json(wb.Sheets['Mission Board Juni'], { header: 1 })
  const tasks = []
  for (let i = 2; i < taskRows.length; i++) {
    const r = taskRows[i]
    if (!r[0] || !r[2] || !r[3]) break
    let deadline = '2026-06-30'
    if (typeof r[4] === 'number') {
      deadline = new Date((r[4] - 25569) * 86400 * 1000).toISOString().slice(0, 10)
    } else if (r[4]) {
      deadline = String(r[4]).slice(0, 10)
    }
    tasks.push({
      no: r[0], picRaw: r[1], projectName: r[2], name: r[3],
      deadline, target: r[5] || '', progress: r[6], notes: r[7] || ''
    })
  }

  // ── 4. Collect unique names from Excel ─────────────────────────────────
  const nameSet = new Set()
  projects.forEach(p => { if (p.ownerName) nameSet.add(p.ownerName.trim()); if (p.supportName && p.supportName !== '-') nameSet.add(p.supportName.trim()) })
  kpiBlocks.forEach(b => nameSet.add(b.user.split(' ')[0])) // first name only for lookup
  tasks.forEach(t => splitPIC(t.picRaw).forEach(n => nameSet.add(n)))
  // remove "Tim Terminal" token
  nameSet.delete('Tim Terminal')

  // ── 5. Fetch existing users ─────────────────────────────────────────────
  const existingUsers = await sql`SELECT id, full_name, email FROM users WHERE deleted_at IS NULL`
  const userByNorm = new Map()
  existingUsers.forEach(u => {
    userByNorm.set(norm(u.full_name), u)
    userByNorm.set(norm(u.full_name.split(' ')[0]), u)
  })

  // ── 6. Create missing users ─────────────────────────────────────────────
  const defaultPwHash = await bcrypt.hash('Goda2026!', 10)
  const newUsers = []

  // All names from Excel that aren't in DB yet
  const excelNames = {
    'Roro':     { full: 'Roro', email: 'roro@goda.id', role: 'staff' },
    'Septian':  { full: 'Septian', email: 'septian@goda.id', role: 'staff' },
    'Nanda':    { full: 'Nanda', email: 'nanda@goda.id', role: 'staff' },
    'Siswanto': { full: 'Siswanto', email: 'siswanto@goda.id', role: 'staff' },
    'Awan':     { full: 'Awan', email: 'awan@goda.id', role: 'staff' },
  }

  for (const [name, info] of Object.entries(excelNames)) {
    if (!userByNorm.has(norm(name))) {
      const id = randomUUID()
      await sql`
        INSERT INTO users (id, email, full_name, role, division_id, is_active, password_hash, created_at, updated_at)
        VALUES (${id}, ${info.email}, ${info.full}, ${info.role}, ${DIVISION_CM}, true, ${defaultPwHash}, NOW(), NOW())
        ON CONFLICT (email) DO NOTHING
      `
      const u = { id, full_name: info.full, email: info.email }
      newUsers.push(u)
      userByNorm.set(norm(name), u)
      userByNorm.set(norm(info.full), u)
      console.log('  Created user:', info.full, info.email)
    }
  }

  // ── Helper: resolve name → user ─────────────────────────────────────────
  function resolveUser(name) {
    if (!name || name === '-') return null
    const n = norm(name)
    return userByNorm.get(n) || userByNorm.get(n.split(' ')[0]) || null
  }

  const zulhaj = resolveUser('Zulhaj')
  if (!zulhaj) throw new Error('Zulhaj not found in DB')
  console.log('\nLeader (created_by):', zulhaj.full_name)

  // ── 7. Create Projects ──────────────────────────────────────────────────
  console.log('\n=== Creating Projects ===')
  const projectMap = new Map() // project name → id

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i]
    const owner = resolveUser(p.ownerName)
    const support = resolveUser(p.supportName)

    if (!owner) { console.warn('  SKIP project (owner not found):', p.ownerName, p.name.slice(0,40)); continue }

    const id = randomUUID()
    const code = 'CM-' + String(i + 1).padStart(3, '0')

    await sql`
      INSERT INTO projects (
        id, project_code, name, division_id, project_type,
        pic_id, objective, deliverables,
        start_date, deadline, status, priority, progress,
        budget_actual, is_overdue, notes,
        created_by, created_at, updated_at
      ) VALUES (
        ${id}, ${code}, ${p.name}, ${DIVISION_CM}, 'Internal',
        ${owner.id}, ${p.name}, ${p.notes || p.name},
        '2026-06-01', '2026-06-30', 'In Progress', 'High', 0,
        0, false, ${p.notes || ''},
        ${zulhaj.id}, NOW(), NOW()
      )
    `

    // Add owner as project member
    await sql`
      INSERT INTO project_members (id, project_id, user_id, added_at)
      VALUES (${randomUUID()}, ${id}, ${owner.id}, NOW())
      ON CONFLICT DO NOTHING
    `
    // Add support as project member
    if (support) {
      await sql`
        INSERT INTO project_members (id, project_id, user_id, added_at)
        VALUES (${randomUUID()}, ${id}, ${support.id}, NOW())
        ON CONFLICT DO NOTHING
      `
    }

    projectMap.set(p.name.toLowerCase().slice(0, 30), id)
    console.log('  ✓ Project', code, ':', p.name.slice(0, 55))
  }

  // ── 8. Create KPI Items ─────────────────────────────────────────────────
  console.log('\n=== Creating KPI Items ===')
  for (const block of kpiBlocks) {
    const user = resolveUser(block.user.split(' ')[0])
    if (!user) { console.warn('  SKIP KPI user not found:', block.user); continue }

    for (const kpi of block.kpis) {
      await sql`
        INSERT INTO kpi_items (
          id, user_id, period_month, period_year,
          kpi_name, weight, max_score, status,
          created_by, created_at, updated_at
        ) VALUES (
          ${randomUUID()}, ${user.id}, 6, 2026,
          ${kpi.kpiName}, ${kpi.weight}, 100, 'Draft',
          ${zulhaj.id}, NOW(), NOW()
        )
      `
    }
    console.log('  ✓ KPI', block.user, '—', block.kpis.length, 'items')
  }

  // ── 9. Create Tasks ─────────────────────────────────────────────────────
  console.log('\n=== Creating Tasks ===')

  // Build project lookup by matching project name prefix
  function findProjectId(projectName) {
    const needle = projectName.toLowerCase().slice(0, 30)
    for (const [key, id] of projectMap.entries()) {
      if (key.startsWith(needle.slice(0, 20)) || needle.startsWith(key.slice(0, 20))) return id
    }
    return null
  }

  for (const t of tasks) {
    const pics = splitPIC(t.picRaw).map(n => resolveUser(n)).filter(Boolean)
    const primaryPIC = pics[0] || zulhaj
    const status = toTaskStatus(t.progress)
    const projId = findProjectId(t.projectName)
    const taskId = randomUUID()

    const description = [t.target && `Target: ${t.target}`, t.notes && `Keterangan: ${t.notes}`].filter(Boolean).join('\n')

    await sql`
      INSERT INTO tasks (
        id, name, project_id, division_id, created_by,
        due_date, priority, status, description,
        is_overdue, requires_approval, created_at, updated_at
      ) VALUES (
        ${taskId}, ${t.name}, ${projId}, ${DIVISION_CM}, ${zulhaj.id},
        ${t.deadline + 'T23:59:00+07:00'}, 'High', ${status}, ${description},
        false, false, NOW(), NOW()
      )
    `

    // Assign all PICs
    for (const u of pics) {
      await sql`
        INSERT INTO task_assignees (id, task_id, user_id, assigned_at)
        VALUES (${randomUUID()}, ${taskId}, ${u.id}, NOW())
        ON CONFLICT DO NOTHING
      `
    }

    console.log('  ✓ Task', t.no, '[' + status + ']', t.name.slice(0, 50))
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n✅ DONE')
  console.log('  New users created:', newUsers.length)
  console.log('  Projects:', projects.length)
  console.log('  KPI blocks:', kpiBlocks.length, '/ total items:', kpiBlocks.reduce((s, b) => s + b.kpis.length, 0))
  console.log('  Tasks:', tasks.length)
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
