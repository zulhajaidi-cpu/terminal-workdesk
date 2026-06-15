import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { canEditProject } from '@/lib/roles'

// Status yang TIDAK boleh dihapus (sudah berjalan / selesai)
const NON_DELETEABLE = ['In Progress', 'Need Review', 'Completed']

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || !canEditProject(session.role)) {
    return NextResponse.json({ error: 'Tidak punya akses untuk menghapus project' }, { status: 403 })
  }

  const [proj] = await db.select({ status: projects.status, createdBy: projects.createdBy })
    .from(projects).where(eq(projects.id, id)).limit(1)
  if (!proj) return NextResponse.json({ error: 'Project tidak ditemukan' }, { status: 404 })

  if (NON_DELETEABLE.includes(proj.status) && session.role !== 'super_admin') {
    return NextResponse.json({ error: `Project berstatus "${proj.status}" tidak bisa dihapus` }, { status: 400 })
  }

  await db.update(projects).set({ deletedAt: new Date() }).where(eq(projects.id, id))
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || !canEditProject(session.role)) {
    return NextResponse.json({ error: 'Tidak punya akses untuk mengedit project' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  const allowed = ['name', 'objective', 'deliverables', 'startDate', 'deadline', 'priority', 'budgetPlanned', 'attachmentUrl', 'notes', 'projectType', 'status']
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key] ?? null
  }

  const [updated] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning()
  if (!updated) return NextResponse.json({ error: 'Project tidak ditemukan' }, { status: 404 })
  return NextResponse.json({ ok: true, id: updated.id })
}
