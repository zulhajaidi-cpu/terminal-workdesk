// Util klien: crop gambar jadi persegi + kompres, lalu unggah ke Vercel Blob lewat /api/upload.
// Dengan resize di klien, file yang dikirim ~30-120KB → cepat & jauh di bawah limit body.

export function resizeToSquareBlob(file: File, size = 320, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('File bukan gambar yang valid.'))
      img.onload = () => {
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas tidak didukung browser ini.')); return }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
        canvas.toBlob(
          b => b ? resolve(b) : reject(new Error('Gagal memproses gambar.')),
          'image/jpeg', quality
        )
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

// Resize → unggah → kembalikan URL publik dari Vercel Blob (yang akan disimpan di DB sebagai teks).
export async function uploadSquareImage(file: File, folder: 'avatars' | 'rewards', size = 320): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar.')
  const blob = await resizeToSquareBlob(file, size)
  const fd = new FormData()
  fd.append('file', blob, 'image.jpg')
  fd.append('folder', folder)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Upload gagal.')
  return data.url as string
}
