'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { projectComments, notifications, users, projects } from '@/lib/db/schema'
import { eq, isNull, and } from 'drizzle-orm'

/* ── Mention parser ─────────────────────────────────── */
function parseMentions(content: string): string[] {
  // Match @word or @"full name" patterns
  const matches = content.matchAll(/@([\w.]+)/g)
  return [...new Set([...matches].map(m => m[1].toLowerCase()))]
}

/* ── Add comment ────────────────────────────────────── */
export async function addComment(projectId: string, content: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  const trimmed = content.trim()
  if (!trimmed) throw new Error('Komentar tidak boleh kosong')
  if (trimmed.length > 2000) throw new Error('Komentar terlalu panjang (maks 2000 karakter)')

  // Verify project exists and is not deleted
  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)
  if (!project) throw new Error('Project tidak ditemukan')

  // Insert comment
  const [comment] = await db
    .insert(projectComments)
    .values({ projectId, userId: session.id, content: trimmed })
    .returning({ id: projectComments.id, createdAt: projectComments.createdAt })

  // Parse @mentions and notify
  const mentionedNames = parseMentions(trimmed)
  if (mentionedNames.length > 0) {
    // Fetch all active users to match usernames
    const allUsers = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(eq(users.isActive, true))

    const notifValues: {
      userId: string; title: string; message: string; type: 'mention'
      relatedEntityType: string; relatedEntityId: string
    }[] = []

    for (const name of mentionedNames) {
      const matched = allUsers.find(u =>
        u.fullName.toLowerCase().replace(/\s+/g, '.') === name ||
        u.fullName.toLowerCase().replace(/\s+/g, '') === name ||
        u.fullName.toLowerCase().split(' ')[0] === name
      )
      // Don't notify the commenter themselves
      if (matched && matched.id !== session.id) {
        notifValues.push({
          userId: matched.id,
          title: 'Kamu disebut di komentar',
          message: `${session.fullName} menyebut kamu di project "${project.name}"`,
          type: 'mention',
          relatedEntityType: 'project',
          relatedEntityId: projectId,
        })
      }
    }

    if (notifValues.length > 0) {
      await db.insert(notifications).values(notifValues)
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return { id: comment.id, createdAt: comment.createdAt }
}

/* ── Delete comment ─────────────────────────────────── */
export async function deleteComment(commentId: string, projectId: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  const [comment] = await db
    .select({ userId: projectComments.userId })
    .from(projectComments)
    .where(and(eq(projectComments.id, commentId), isNull(projectComments.deletedAt)))
    .limit(1)
  if (!comment) throw new Error('Komentar tidak ditemukan')

  const canDelete =
    comment.userId === session.id ||
    ['super_admin', 'spv_manager', 'head_director'].includes(session.role)
  if (!canDelete) throw new Error('Tidak bisa menghapus komentar ini')

  await db
    .update(projectComments)
    .set({ deletedAt: new Date() })
    .where(eq(projectComments.id, commentId))

  revalidatePath(`/projects/${projectId}`)
}
