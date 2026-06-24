import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, divisions, users } from '@/lib/db/schema'
import { isNull, desc, eq, and, or } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { canSeeAllDivisions } from '@/lib/roles'
import { ProjectsContent } from './projects-content'

export const metadata = { title: 'Projects — Terminal Workdesk' }

const sql = neon(process.env.DATABASE_URL!)

interface TaskLite {
  id: string; projectId: string; name: string; status: string
  checked: boolean; isOverdue: boolean; assignees: string
}

export default async function ProjectsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Staff hanya lihat project divisinya sendiri (+ project tanpa divisi). Role lain lihat semua.
  const restrictToOwnDivision = !canSeeAllDivisions(session.role)
  const projectsWhere = restrictToOwnDivision
    ? and(isNull(projects.deletedAt), or(eq(projects.divisionId, session.divisionId ?? '00000000-0000-0000-0000-000000000000'), isNull(projects.divisionId)))
    : isNull(projects.deletedAt)

  const [projectRows, divisionRows, taskRows] = await Promise.all([
    db.select({
      id: projects.id, name: projects.name, projectCode: projects.projectCode,
      status: projects.status, priority: projects.priority, progress: projects.progress,
      deadline: projects.deadline, isOverdue: projects.isOverdue,
      approvalStatus: projects.approvalStatus, currentApprovalStep: projects.currentApprovalStep,
      budgetPlanned: projects.budgetPlanned, budgetActual: projects.budgetActual,
      picId: projects.picId, createdAt: projects.createdAt, updatedAt: projects.updatedAt,
      divisionName: divisions.name, picName: users.fullName,
    })
      .from(projects)
      .leftJoin(divisions, eq(projects.divisionId, divisions.id))
      .leftJoin(users, eq(projects.picId, users.id))
      .where(projectsWhere)
      .orderBy(desc(projects.updatedAt)),
    db.select({ id: divisions.id, name: divisions.name }).from(divisions).where(isNull(divisions.deletedAt)),
    sql`
      SELECT t.id, t.project_id AS "projectId", t.name, t.status::text AS status,
             t.checked, t.is_overdue AS "isOverdue",
             COALESCE((
               SELECT string_agg(split_part(u.full_name, ' ', 1), ', ')
               FROM task_assignees ta JOIN users u ON u.id = ta.user_id
               WHERE ta.task_id = t.id
             ), '') AS assignees
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL
      ORDER BY t.created_at ASC
    ` as unknown as Promise<TaskLite[]>,
  ])

  // Group tasks per project + compute derived progress
  const tasksByProject = new Map<string, TaskLite[]>()
  for (const t of taskRows) {
    const arr = tasksByProject.get(t.projectId) ?? []
    arr.push(t)
    tasksByProject.set(t.projectId, arr)
  }

  const enriched = projectRows.map(p => {
    const ts = tasksByProject.get(p.id) ?? []
    const total = ts.length
    const done = ts.filter(t => t.status === 'Completed').length
    const progress = total > 0 ? Math.round((done / total) * 100) : p.progress
    return { ...p, tasks: ts, taskStats: { total, done, progress } }
  })

  return (
    <ProjectsContent
      projects={enriched as any[]}
      divisions={divisionRows as any[]}
      currentUser={{ id: session.id, role: session.role }}
    />
  )
}
