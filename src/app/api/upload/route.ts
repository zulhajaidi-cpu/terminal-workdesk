import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getSession } from '@/lib/auth'
import { canManageRewards } from '@/lib/roles'

// Upload gambar ke Vercel Blob (storage eksternal). DB hanya menyimpan URL teks yang dikembalikan.
// File sudah di-resize kecil di klien (lihat src/lib/upload-image.ts) sehingga jauh di bawah limit body.
const MAX_BYTES = 5 * 1024 * 1024 // 5MB jaring pengaman (klien kirim ~30-120KB)
const ALLOWED_FOLDERS = ['avatars', 'rewards'] as const

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Storage belum dikonfigurasi (BLOB_READ_WRITE_TOKEN belum diset).' },
      { status: 503 }
    )
  }

  const form = await request.formData()
  const file = form.get('file')
  const folderRaw = String(form.get('folder') ?? 'avatars')
  const folder = (ALLOWED_FOLDERS as readonly string[]).includes(folderRaw) ? folderRaw : 'avatars'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File harus berupa gambar' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Ukuran gambar maksimal 5MB' }, { status: 400 })
  }
  // Foto reward hanya boleh diunggah oleh admin reward (penulisan URL ke tabel juga digate terpisah).
  if (folder === 'rewards' && !canManageRewards(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const key = `${folder}/${session.id}-${Date.now()}.${ext}`

  const blob = await put(key, file, {
    access: 'public',
    contentType: file.type,
    addRandomSuffix: true,
  })

  return NextResponse.json({ url: blob.url })
}
