import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export interface ProjectTaskStats {
  total: number
  done: number
  progress: number // 0..100
}

/**
 * Project progress is DERIVED from its tasks: progress = round(Completed / total * 100).
 * Source of truth is tasks.status = 'Completed'.
 *
 * If a project has no tasks, we leave the stored `progress` untouched (so a value set
 * manually or via Excel import for task-less projects is preserved).
 */
export async function recalcProjectProgress(projectId: string | null | undefined): Promise<ProjectTaskStats | null> {
  if (!projectId) return null
  const rows = await sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE status = 'Completed')::int AS done
    FROM tasks
    WHERE project_id = ${projectId} AND deleted_at IS NULL
  ` as { total: number; done: number }[]

  const total = rows[0]?.total ?? 0
  const done = rows[0]?.done ?? 0
  if (total === 0) return { total: 0, done: 0, progress: 0 }

  const progress = Math.round((done / total) * 100)
  await sql`UPDATE projects SET progress = ${progress}, updated_at = now() WHERE id = ${projectId}`
  return { total, done, progress }
}

/** True when a project has at least one task checked (checked = true). */
export async function allTasksChecked(projectId: string): Promise<{ ready: boolean; total: number; done: number }> {
  const rows = await sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE checked = true)::int AS done
    FROM tasks
    WHERE project_id = ${projectId} AND deleted_at IS NULL
  ` as { total: number; done: number }[]
  const total = rows[0]?.total ?? 0
  const done = rows[0]?.done ?? 0
  // Allow submission if there are no tasks, or at least one task is checked.
  return { ready: total === 0 || done >= 1, total, done }
}
