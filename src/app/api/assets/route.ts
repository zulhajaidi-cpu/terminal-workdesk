import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { assets } from '@/lib/db/schema'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, category, divisionId, driveLink, version, relatedProjectId, description, tags } = body

  if (!name || !category || !divisionId || !driveLink) {
    return NextResponse.json({ error: 'Nama, kategori, divisi, dan link Drive wajib diisi' }, { status: 400 })
  }

  const [asset] = await db.insert(assets).values({
    name,
    category,
    divisionId,
    driveLink,
    version: version || null,
    relatedProjectId: relatedProjectId || null,
    description: description || null,
    tags: tags ?? [],
    status: 'Draft',
    uploadedBy: session.id,
  }).returning({ id: assets.id })

  return NextResponse.json({ ok: true, id: asset.id }, { status: 201 })
}
