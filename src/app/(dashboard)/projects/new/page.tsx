import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, divisions } from '@/lib/db/schema'
import { isNull, eq, asc } from 'drizzle-orm'
import { NewProjectForm } from './new-project-form'
import { canCreateProject } from '@/lib/roles'

export const metadata = { title: 'Buat Project Baru — Terminal Workdesk' }

export default async function NewProjectPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canCreateProject(session.role)) redirect('/projects')

  const [memberOptions, divisionRows] = await Promise.all([
    db.select({ id: users.id, fullName: users.fullName, role: users.role, divisionId: users.divisionId })
      .from(users).where(eq(users.isActive, true)).orderBy(asc(users.fullName)),
    db.select({ id: divisions.id, name: divisions.name })
      .from(divisions).where(isNull(divisions.deletedAt)).orderBy(asc(divisions.name)),
  ])

  return (
    <NewProjectForm
      divisions={divisionRows}
      members={memberOptions as any[]}
      currentUser={{ id: session.id, role: session.role, divisionId: session.divisionId }}
    />
  )
}
