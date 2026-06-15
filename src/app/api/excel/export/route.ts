import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { neon } from '@neondatabase/serverless'
import { getSession } from '@/lib/auth'
import { canBulkData } from '@/lib/roles'
import { EXCEL_CONFIGS, ExcelEntity } from '@/lib/excel-config'

const sql = neon(process.env.DATABASE_URL!)

function ymd(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function fmt(v: unknown): string | number {
  if (v == null) return ''
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : ymd(v)
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) { const d = new Date(v); return isNaN(d.getTime()) ? v : ymd(d) }
    return v
  }
  if (typeof v === 'number') return v
  return String(v)
}

async function fetchRows(type: ExcelEntity): Promise<Record<string, unknown>[]> {
  if (type === 'projects') {
    return await sql`
      SELECT p.project_code AS "projectCode", p.name, d.name AS division,
             p.project_type AS "projectType", u.full_name AS pic, p.priority,
             p.objective, p.deliverables, p.start_date AS "startDate",
             p.deadline, p.budget_planned AS "budgetPlanned",
             COALESCE((
               SELECT string_agg(mu.full_name, ', ' ORDER BY mu.full_name)
               FROM project_members pm
               JOIN users mu ON mu.id = pm.user_id
               WHERE pm.project_id = p.id AND pm.user_id <> p.pic_id
             ), '') AS support,
             p.status, p.progress, p.attachment_url AS "attachmentUrl", p.notes
      FROM projects p
      LEFT JOIN divisions d ON d.id = p.division_id
      LEFT JOIN users u ON u.id = p.pic_id
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at DESC` as Record<string, unknown>[]
  }
  if (type === 'tasks') {
    return await sql`
      SELECT t.name, d.name AS division, p.project_code AS "projectCode",
             t.status, t.priority, t.due_date AS "dueDate",
             t.description, t.output_url AS "outputUrl",
             COALESCE((
               SELECT string_agg(u.full_name, ', ' ORDER BY u.full_name)
               FROM task_assignees ta JOIN users u ON u.id = ta.user_id
               WHERE ta.task_id = t.id
             ), '') AS assignee
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN divisions d ON d.id = t.division_id
      WHERE t.deleted_at IS NULL
      ORDER BY t.created_at DESC` as Record<string, unknown>[]
  }
  return await sql`
    SELECT u.full_name AS "user", k.period_month AS "periodMonth",
           k.period_year AS "periodYear", k.kpi_name AS "kpiName", k.weight,
           k.target, k.realization, k.max_score AS "maxScore",
           k.auto_score AS "autoScore", k.final_score AS "finalScore", k.status,
           k.evaluation_note AS "evaluationNote", k.improvement_plan AS "improvementPlan"
    FROM kpi_items k
    LEFT JOIN users u ON u.id = k.user_id
    WHERE k.deleted_at IS NULL
    ORDER BY k.period_year DESC, k.period_month DESC` as Record<string, unknown>[]
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canBulkData(session.role)) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })

  const type = request.nextUrl.searchParams.get('type') as ExcelEntity
  const config = EXCEL_CONFIGS[type]
  if (!config) return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 })

  const rows = await fetchRows(type)
  const headers = config.columns.map(c => c.header)
  const aoa = [headers, ...rows.map(r => config.columns.map(c => fmt(r[c.key])))]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = config.columns.map(c => ({ wch: Math.max(c.header.length + 4, 16) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, config.sheetName)
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${config.fileName}-${today}.xlsx"`,
    },
  })
}
