import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { assets, divisions, projects, users } from '@/lib/db/schema'
import { isNull, eq, desc } from 'drizzle-orm'
import { AssetsContent } from './assets-content'

export const metadata = { title: 'Assets — Terminal Workdesk' }

export default async function AssetsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [assetRows, divisionRows, projectRows] = await Promise.all([
    db.select({
      id: assets.id,
      name: assets.name,
      category: assets.category,
      version: assets.version,
      status: assets.status,
      driveLink: assets.driveLink,
      description: assets.description,
      tags: assets.tags,
      createdAt: assets.createdAt,
      divisionId: assets.divisionId,
      relatedProjectId: assets.relatedProjectId,
      uploadedBy: assets.uploadedBy,
      divisionName: divisions.name,
      projectName: projects.name,
      uploaderName: users.fullName,
    })
      .from(assets)
      .leftJoin(divisions, eq(assets.divisionId, divisions.id))
      .leftJoin(projects, eq(assets.relatedProjectId, projects.id))
      .leftJoin(users, eq(assets.uploadedBy, users.id))
      .where(isNull(assets.deletedAt))
      .orderBy(desc(assets.createdAt)),
    db.select({ id: divisions.id, name: divisions.name })
      .from(divisions).where(isNull(divisions.deletedAt)),
    db.select({ id: projects.id, name: projects.name })
      .from(projects).where(isNull(projects.deletedAt)).orderBy(projects.name),
  ])

  return (
    <AssetsContent
      assets={assetRows as any[]}
      divisions={divisionRows}
      projects={projectRows}
      currentUser={{ id: session.id, role: session.role, divisionId: session.divisionId ?? null }}
    />
  )
}
