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
