'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

const CAN_POST_ROLES = ['leader_divisi', 'spv_manager', 'head_director', 'super_admin']

export async function createMadingPost(formData: FormData) {
  const session = await getSession()
  if (!session || !CAN_POST_ROLES.includes(session.role)) {
    return { error: 'Tidak diizinkan' }
  }

  const title = (formData.get('title') as string)?.trim()
  const content = (formData.get('content') as string)?.trim()
  const rawMedia = (formData.get('mediaUrl') as string)?.trim()
  const mediaUrl = rawMedia || null

  if (!title || !content) return { error: 'Judul dan isi wajib diisi' }
  if (title.length > 120) return { error: 'Judul maksimal 120 karakter' }
  if (content.length > 3000) return { error: 'Isi maksimal 3000 karakter' }
  if (mediaUrl) {
    try {
      const u = new URL(mediaUrl)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return { error: 'Link gambar harus diawali http:// atau https://' }
      }
    } catch {
      return { error: 'Link gambar tidak valid' }
    }
  }

  await sql`
    INSERT INTO mading_posts (title, content, media_url, created_by)
    VALUES (${title}, ${content}, ${mediaUrl}, ${session.id})
  `

  revalidatePath('/dashboard')
  return { success: true }
}

// Direktur & Super Admin boleh memoderasi (hapus) pengumuman siapa pun
const CAN_MODERATE_ROLES = ['head_director', 'super_admin']

export async function deleteMadingPost(id: string) {
  const session = await getSession()
  if (!session) {
    return { error: 'Tidak diizinkan' }
  }

  const rows = (await sql`
    SELECT created_by FROM mading_posts
    WHERE id = ${id} AND deleted_at IS NULL
    LIMIT 1
  `) as { created_by: string }[]

  const post = rows[0]
  if (!post) {
    return { error: 'Pengumuman tidak ditemukan' }
  }

  const canDelete =
    post.created_by === session.id ||
    CAN_MODERATE_ROLES.includes(session.role)
  if (!canDelete) {
    return { error: 'Tidak bisa menghapus pengumuman ini' }
  }

  await sql`
    UPDATE mading_posts SET deleted_at = NOW()
    WHERE id = ${id} AND deleted_at IS NULL
  `

  revalidatePath('/dashboard')
  return { success: true }
}

/* ════════════════ REACTIONS ════════════════ */
// Reaksi ala Facebook: satu reaksi per user per post. Klik emoji yang sama = batal.
const REACTION_EMOJIS = ['👍', '❤️', '😆', '😮', '😢', '😡']

export async function toggleMadingReaction(postId: string, emoji: string) {
  const session = await getSession()
  if (!session) return { error: 'Tidak diizinkan' }
  if (!REACTION_EMOJIS.includes(emoji)) return { error: 'Emoji tidak valid' }

  const existing = (await sql`
    SELECT emoji FROM mading_reactions
    WHERE post_id = ${postId} AND user_id = ${session.id}
    LIMIT 1
  `) as { emoji: string }[]

  let myReaction: string | null = emoji
  if (existing.length === 0) {
    await sql`
      INSERT INTO mading_reactions (post_id, user_id, emoji)
      VALUES (${postId}, ${session.id}, ${emoji})
    `
  } else if (existing[0].emoji === emoji) {
    await sql`DELETE FROM mading_reactions WHERE post_id = ${postId} AND user_id = ${session.id}`
    myReaction = null
  } else {
    await sql`
      UPDATE mading_reactions SET emoji = ${emoji}, created_at = NOW()
      WHERE post_id = ${postId} AND user_id = ${session.id}
    `
  }

  const counts = (await sql`
    SELECT emoji, COUNT(*)::int AS count FROM mading_reactions
    WHERE post_id = ${postId}
    GROUP BY emoji ORDER BY count DESC
  `) as { emoji: string; count: number }[]

  return { success: true, reactions: counts, myReaction }
}

/* ════════════════ COMMENTS ════════════════ */
export async function getMadingComments(postId: string) {
  const session = await getSession()
  if (!session) return { error: 'Tidak diizinkan', comments: [] }

  const rows = (await sql`
    SELECT c.id, c.content, c.created_at AS "createdAt", c.user_id AS "userId",
           u.full_name AS "userName", u.avatar_url AS "userAvatar", u.role AS "userRole"
    FROM mading_comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ${postId} AND c.deleted_at IS NULL
    ORDER BY c.created_at ASC
  `) as MadingCommentRow[]

  return { success: true, comments: rows }
}

export interface MadingCommentRow {
  id: string
  content: string
  createdAt: string
  userId: string
  userName: string | null
  userAvatar: string | null
  userRole: string | null
}

export async function addMadingComment(postId: string, content: string) {
  const session = await getSession()
  if (!session) return { error: 'Tidak diizinkan' }

  const trimmed = content?.trim()
  if (!trimmed) return { error: 'Komentar tidak boleh kosong' }
  if (trimmed.length > 1000) return { error: 'Komentar maksimal 1000 karakter' }

  const post = (await sql`
    SELECT id FROM mading_posts WHERE id = ${postId} AND deleted_at IS NULL LIMIT 1
  `) as { id: string }[]
  if (post.length === 0) return { error: 'Pengumuman tidak ditemukan' }

  const rows = (await sql`
    INSERT INTO mading_comments (post_id, user_id, content)
    VALUES (${postId}, ${session.id}, ${trimmed})
    RETURNING id, content, created_at AS "createdAt"
  `) as { id: string; content: string; createdAt: string }[]

  return {
    success: true,
    comment: {
      ...rows[0],
      userId: session.id,
      userName: session.fullName,
      userAvatar: session.avatarUrl ?? null,
      userRole: session.role,
    } as MadingCommentRow,
  }
}

export async function deleteMadingComment(commentId: string) {
  const session = await getSession()
  if (!session) return { error: 'Tidak diizinkan' }

  const rows = (await sql`
    SELECT user_id FROM mading_comments WHERE id = ${commentId} AND deleted_at IS NULL LIMIT 1
  `) as { user_id: string }[]
  if (rows.length === 0) return { error: 'Komentar tidak ditemukan' }

  const canDelete = rows[0].user_id === session.id || CAN_MODERATE_ROLES.includes(session.role)
  if (!canDelete) return { error: 'Tidak bisa menghapus komentar ini' }

  await sql`UPDATE mading_comments SET deleted_at = NOW() WHERE id = ${commentId}`
  return { success: true }
}
