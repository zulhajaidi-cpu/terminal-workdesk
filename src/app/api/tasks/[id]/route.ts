import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { tasks, taskAssignees } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { recalcProjectProgress } from '@/lib/projects'

const MANAGER_ROLES = ['super_admin', 'spv_manager', 'head_director', 'leader_divisi']

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const updates: Record<string, unknown> = { updatedAt: new Date() }

    const allowed = ['name', 'status', 'priority', 'description', 'outputUrl', 'category', 'progressPct', 'checked']
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key] ?? null
    }
    // dueDate needs to be a proper Date object for the timestamp column
    if (body.dueDate !== undefined) {
      updates.dueDate = body.dueDate ? new Date(body.dueDate) : null
    }

    if (body.status === 'Completed') updates.completedAt = new Date()
    if (body.checked === true) updates.completedAt = new Date()

    const [updated] = await db.update(tasks).set(updates).where(eq(tasks.id, id))
      .returning({ id: tasks.id, projectId: tasks.projectId })
    if (!updated) return NextResponse.json({ error: 'Task tidak ditemukan' }, { status: 404 })

    // Sync assignees if provided (replace-all strategy)
    if (Array.isArray(body.assignees)) {
      await db.delete(taskAssignees).where(eq(taskAssignees.taskId, id))
      if ((body.assignees as string[]).length > 0) {
        await db.insert(taskAssignees).values(
          (body.assignees as string[]).map((uid: string) => ({ taskId: id, userId: uid }))
        )
      }
    }

    const stats = updated.projectId ? await recalcProjectProgress(updated.projectId) : null
    return NextResponse.json({ ok: true, progress: stats?.progress ?? null })
  } catch (e) {
    console.error('PATCH /api/tasks/[id] error:', e)
    return NextResponse.json({ error: (e as Error).message ?? 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // SPV/Manager/Director/SuperAdmin can delete any task; others only their own
  const isManager = MANAGER_ROLES.includes(session.role)
  if (!isManager) {
    const [task] = await db.select({ createdBy: tasks.createdBy }).from(tasks).where(eq(tasks.id, id))
    if (!task || task.createdBy !== session.id) {
      return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
    }
  }

  const [deleted] = await db.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, id))
    .returning({ projectId: tasks.projectId })
  if (deleted?.projectId) await recalcProjectProgress(deleted.projectId)
  return NextResponse.json({ ok: true })
}
