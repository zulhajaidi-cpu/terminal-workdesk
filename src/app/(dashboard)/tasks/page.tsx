import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { tasks, projects, divisions, users, taskAssignees } from '@/lib/db/schema'
import { isNull, eq, asc, inArray, or } from 'drizzle-orm'
import { TasksContent } from './tasks-content'
import { neon } from '@neondatabase/serverless'

export const metadata = { title: 'Tasks — Terminal Workdesk' }

const sql = neon(process.env.DATABASE_URL!)

export default async function TasksPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const isManager = ['super_admin', 'spv_manager', 'head_director'].includes(session.role)
  const isLeader = session.role === 'leader_divisi'

  // Get all task IDs where current user is assigned
  let taskRows: any[]

  if (isManager) {
    // Managers see all tasks
    taskRows = await sql`
      SELECT t.id, t.name, t.status, t.priority,
             t.due_date AS "dueDate", t.is_overdue AS "isOverdue",
             t.requires_approval AS "requiresApproval",
             t.description, t.output_url AS "outputUrl",
             t.completed_at AS "completedAt",
             t.pic_id AS "picId",
             p.name AS "projectName", d.name AS "divisionName",
             pic.full_name AS "picName",
             COALESCE(
               json_agg(
                 json_build_object('id', au.id, 'fullName', au.full_name, 'avatarUrl', au.avatar_url)
               ) FILTER (WHERE au.id IS NOT NULL), '[]'
             ) AS assignees
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN divisions d ON d.id = t.division_id
      LEFT JOIN users pic ON pic.id = t.pic_id
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN users au ON au.id = ta.user_id
      WHERE t.deleted_at IS NULL
      GROUP BY t.id, p.name, d.name, pic.full_name
      ORDER BY t.due_date ASC
    `
  } else {
    // Leaders see their division's tasks + their own assigned tasks
    // Staff see only their assigned tasks
    taskRows = await sql`
      SELECT t.id, t.name, t.status, t.priority,
             t.due_date AS "dueDate", t.is_overdue AS "isOverdue",
             t.requires_approval AS "requiresApproval",
             t.description, t.output_url AS "outputUrl",
             t.completed_at AS "completedAt",
             t.pic_id AS "picId",
             p.name AS "projectName", d.name AS "divisionName",
             pic.full_name AS "picName",
             COALESCE(
               json_agg(
                 json_build_object('id', au.id, 'fullName', au.full_name, 'avatarUrl', au.avatar_url)
               ) FILTER (WHERE au.id IS NOT NULL), '[]'
             ) AS assignees
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN divisions d ON d.id = t.division_id
      LEFT JOIN users pic ON pic.id = t.pic_id
      LEFT JOIN task_assignees ta2 ON ta2.task_id = t.id AND ta2.user_id = ${session.id}
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN users au ON au.id = ta.user_id
      WHERE t.deleted_at IS NULL
        AND (
          ta2.user_id = ${session.id}
          OR t.created_by = ${session.id}
          OR t.pic_id = ${session.id}
        )
      GROUP BY t.id, p.name, d.name, pic.full_name
      ORDER BY t.due_date ASC
    `
  }

  const [projectRows, divisionRows, userRows] = await Promise.all([
    db.select({ id: projects.id, name: projects.name })
      .from(projects).where(isNull(projects.deletedAt)).orderBy(asc(projects.name)),
    db.select({ id: divisions.id, name: divisions.name })
      .from(divisions).where(isNull(divisions.deletedAt)),
    db.select({ id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl, role: users.role })
      .from(users).where(eq(users.isActive, true)),
  ])

  return (
    <TasksContent
      tasks={taskRows}
      projects={projectRows}
      divisions={divisionRows}
      users={userRows}
      currentUser={{ id: session.id, role: session.role, fullName: session.fullName ?? '' }}
    />
  )
}
