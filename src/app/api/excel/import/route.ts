import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { neon } from '@neondatabase/serverless'
import { getSession } from '@/lib/auth'
import { canBulkData } from '@/lib/roles'
import { EXCEL_CONFIGS, ExcelEntity, VALID } from '@/lib/excel-config'
import { recalcProjectProgress } from '@/lib/projects'

const sql = neon(process.env.DATABASE_URL!)

/* ── value parsers ── */
function ymdLocal(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : ymdLocal(v)
  if (typeof v === 'number') {
    // Excel serial date → UTC midnight of that calendar day
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    if (isNaN(d.getTime())) return null
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : ymdLocal(d)
}
function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? null : n
}
function str(v: unknown): string { return v == null ? '' : String(v).trim() }
function enumOr(v: unknown, valid: string[], fallback: string): string {
  const s = str(v)
  const hit = valid.find(x => x.toLowerCase() === s.toLowerCase())
  return hit ?? fallback
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canBulkData(session.role)) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })

  const formData = await request.formData()
  const type = formData.get('type') as ExcelEntity
  const file = formData.get('file') as File | null
  const config = EXCEL_CONFIGS[type]
  if (!config) return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 })
  if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })

  // Parse workbook (first sheet)
  const buf = Buffer.from(await file.arrayBuffer())
  let aoa: unknown[][]
  try {
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][]
  } catch {
    return NextResponse.json({ error: 'Gagal membaca file Excel' }, { status: 400 })
  }
  if (aoa.length < 2) return NextResponse.json({ error: 'File kosong / tidak ada data' }, { status: 400 })

  // Map headers → keys
  const normH = (s: unknown) => String(s ?? '').replace(/\*/g, '').trim().toLowerCase()
  const headerToKey: Record<string, string> = {}
  for (const c of config.columns) headerToKey[normH(c.header)] = c.key
  const headerRow = (aoa[0] as unknown[]).map(normH)

  const records = aoa.slice(1)
    .filter(r => r.some(c => c != null && String(c).trim() !== ''))
    .map(r => {
      const o: Record<string, unknown> = {}
      headerRow.forEach((h, i) => { const k = headerToKey[h]; if (k) o[k] = r[i] })
      return o
    })

  // Lookup maps
  const [divsRaw, usrsRaw] = await Promise.all([
    sql`SELECT id, name FROM divisions WHERE deleted_at IS NULL`,
    sql`SELECT id, full_name FROM users WHERE is_active = true`,
  ])
  const divs = divsRaw as { id: string; name: string }[]
  const usrs = usrsRaw as { id: string; full_name: string }[]
  const divMap = new Map(divs.map(d => [d.name.toLowerCase(), d.id]))
  const findUser = (name: string): string | null => {
    const n = name.trim().toLowerCase()
    if (!n) return null
    const exact = usrs.find(u => u.full_name.toLowerCase() === n)
    if (exact) return exact.id
    const partial = usrs.find(u => u.full_name.toLowerCase().includes(n) || n.includes(u.full_name.toLowerCase().split(' ')[0]))
    return partial?.id ?? null
  }
  // Resolve a list of names ("Nanda, Siswanto" / "Nanda; Siswanto" / newline) → user IDs
  const findUsers = (raw: string): { ids: string[]; missing: string[] } => {
    const ids: string[] = [], missing: string[] = []
    const names = raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
    for (const nm of names) {
      const id = findUser(nm)
      if (id) { if (!ids.includes(id)) ids.push(id) }
      else missing.push(nm)
    }
    return { ids, missing }
  }

  const errors: { row: number; message: string }[] = []
  let inserted = 0, updated = 0, skipped = 0

  /* ───────── PROJECTS ───────── */
  if (type === 'projects') {
    for (let i = 0; i < records.length; i++) {
      const r = records[i]; const rowNo = i + 2
      const code = str(r.projectCode), name = str(r.name)
      if (!code || !name) { skipped++; errors.push({ row: rowNo, message: 'Kode & Nama project wajib diisi' }); continue }
      const divId = divMap.get(str(r.division).toLowerCase())
      if (!divId) { skipped++; errors.push({ row: rowNo, message: `Divisi "${str(r.division)}" tidak ditemukan` }); continue }
      const picId = findUser(str(r.pic)) ?? session.id
      const start = parseDate(r.startDate), deadline = parseDate(r.deadline)
      if (!start || !deadline) { skipped++; errors.push({ row: rowNo, message: 'Tanggal Mulai / Deadline tidak valid' }); continue }
      const status = enumOr(r.status, VALID.projectStatus, 'Draft')
      const priority = enumOr(r.priority, VALID.priority, 'Medium')
      const progress = Math.min(100, Math.max(0, num(r.progress) ?? 0))
      // Resolve "Tim Support" — comma/semicolon/newline separated names
      const { ids: supportIds, missing } = findUsers(str(r.support))
      try {
        const attachUrl = str(r.attachmentUrl) || null
        const res = await sql`
          INSERT INTO projects (project_code, name, division_id, project_type, pic_id, objective, deliverables,
                                start_date, deadline, status, priority, progress, budget_planned,
                                attachment_url, notes, created_by)
          VALUES (${code}, ${name}, ${divId}, ${str(r.projectType) || 'General'}, ${picId},
                  ${str(r.objective) || '-'}, ${str(r.deliverables) || '-'}, ${start}, ${deadline},
                  ${status}, ${priority}, ${progress}, ${num(r.budgetPlanned)},
                  ${attachUrl}, ${str(r.notes) || null}, ${session.id})
          ON CONFLICT (project_code) DO UPDATE SET
            name = EXCLUDED.name, division_id = EXCLUDED.division_id, project_type = EXCLUDED.project_type,
            pic_id = EXCLUDED.pic_id, objective = EXCLUDED.objective, deliverables = EXCLUDED.deliverables,
            start_date = EXCLUDED.start_date, deadline = EXCLUDED.deadline, status = EXCLUDED.status,
            priority = EXCLUDED.priority, progress = EXCLUDED.progress, budget_planned = EXCLUDED.budget_planned,
            attachment_url = EXCLUDED.attachment_url, notes = EXCLUDED.notes, updated_at = now()
          RETURNING id, (xmax = 0) AS inserted` as { id: string; inserted: boolean }[]
        const projectId = res[0]?.id
        res[0]?.inserted ? inserted++ : updated++

        // Sync project_members = PIC + Tim Support (sheet is the source of truth)
        if (projectId) {
          const memberIds = Array.from(new Set([picId, ...supportIds]))
          await sql`DELETE FROM project_members WHERE project_id = ${projectId}`
          for (const uid of memberIds) {
            await sql`INSERT INTO project_members (project_id, user_id) VALUES (${projectId}, ${uid})
                      ON CONFLICT (project_id, user_id) DO NOTHING`
          }
        }
        if (missing.length > 0) {
          errors.push({ row: rowNo, message: `Tim support tidak ditemukan & dilewati: ${missing.join(', ')}` })
        }
      } catch (e) {
        skipped++; errors.push({ row: rowNo, message: (e as Error).message.slice(0, 120) })
      }
    }
  }

  /* ───────── TASKS ───────── */
  else if (type === 'tasks') {
    const projs = await sql`SELECT id, project_code FROM projects WHERE deleted_at IS NULL` as { id: string; project_code: string }[]
    const projMap = new Map(projs.map(p => [p.project_code.toLowerCase(), p.id]))
    for (let i = 0; i < records.length; i++) {
      const r = records[i]; const rowNo = i + 2
      const name = str(r.name)
      if (!name) { skipped++; errors.push({ row: rowNo, message: 'Nama task wajib diisi' }); continue }
      const divId = divMap.get(str(r.division).toLowerCase())
      if (!divId) { skipped++; errors.push({ row: rowNo, message: `Divisi "${str(r.division)}" tidak ditemukan` }); continue }
      const due = parseDate(r.dueDate)
      if (!due) { skipped++; errors.push({ row: rowNo, message: 'Due Date tidak valid' }); continue }
      // projectCode is optional — skip silently if blank or not found
      const rawCode = str(r.projectCode)
      const projId = rawCode ? (projMap.get(rawCode.toLowerCase()) ?? null) : null
      if (rawCode && !projId) {
        errors.push({ row: rowNo, message: `Kode project "${rawCode}" tidak ditemukan — task dibuat tanpa project` })
      }
      // Assignee bisa lebih dari satu — dipisah koma/titik-koma/baris (mis. "Raihan, Awan, Nanda").
      const { ids: assigneeIds, missing: missAssignee } = findUsers(str(r.assignee))
      const status = enumOr(r.status, VALID.taskStatus, 'To Do')
      const priority = enumOr(r.priority, VALID.priority, 'Medium')
      const outputUrl = str(r.outputUrl) || null
      try {
        const res = await sql`
          INSERT INTO tasks (name, project_id, division_id, status, priority, due_date,
                             description, output_url, created_by, requires_approval, is_overdue)
          VALUES (${name}, ${projId}, ${divId}, ${status}, ${priority}, ${due},
                  ${str(r.description) || null}, ${outputUrl}, ${session.id}, false, false)
          RETURNING id` as { id: string }[]
        if (res[0]) {
          for (const uid of assigneeIds) {
            await sql`INSERT INTO task_assignees (task_id, user_id) VALUES (${res[0].id}, ${uid})
                      ON CONFLICT (task_id, user_id) DO NOTHING`
          }
        }
        if (missAssignee.length > 0) {
          errors.push({ row: rowNo, message: `Assignee tidak ditemukan & dilewati: ${missAssignee.join(', ')}` })
        }
        if (projId && res[0]) await recalcProjectProgress(projId)
        inserted++
      } catch (e) {
        skipped++; errors.push({ row: rowNo, message: (e as Error).message.slice(0, 120) })
      }
    }
  }

  /* ───────── KPI ───────── */
  else if (type === 'kpi') {
    for (let i = 0; i < records.length; i++) {
      const r = records[i]; const rowNo = i + 2
      const userId = findUser(str(r.user))
      if (!userId) { skipped++; errors.push({ row: rowNo, message: `User "${str(r.user)}" tidak ditemukan` }); continue }
      const month = num(r.periodMonth), year = num(r.periodYear)
      if (!month || !year || month < 1 || month > 12) { skipped++; errors.push({ row: rowNo, message: 'Bulan/Tahun tidak valid' }); continue }
      const kpiName = str(r.kpiName)
      if (!kpiName) { skipped++; errors.push({ row: rowNo, message: 'Nama KPI wajib diisi' }); continue }
      const weight = num(r.weight), maxScore = num(r.maxScore)
      if (weight == null || maxScore == null) { skipped++; errors.push({ row: rowNo, message: 'Bobot & Skor Maksimal wajib diisi' }); continue }
      const status = enumOr(r.status, VALID.kpiStatus, 'Draft')
      try {
        await sql`
          INSERT INTO kpi_items (user_id, period_month, period_year, kpi_name, weight, target, realization,
                                max_score, auto_score, final_score, status, evaluation_note, improvement_plan, created_by)
          VALUES (${userId}, ${month}, ${year}, ${kpiName}, ${weight}, ${num(r.target)}, ${num(r.realization)},
                  ${maxScore}, ${num(r.autoScore)}, ${num(r.finalScore)}, ${status},
                  ${str(r.evaluationNote) || null}, ${str(r.improvementPlan) || null}, ${session.id})`
        inserted++
      } catch (e) {
        skipped++; errors.push({ row: rowNo, message: (e as Error).message.slice(0, 120) })
      }
    }
  }

  return NextResponse.json({
    ok: true, type, inserted, updated, skipped,
    total: records.length,
    errors: errors.slice(0, 20),
  })
}
