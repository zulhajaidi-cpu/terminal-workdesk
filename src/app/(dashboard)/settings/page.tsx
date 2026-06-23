import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, divisions } from '@/lib/db/schema'
import { isNull, eq, asc } from 'drizzle-orm'
import { SettingsContent } from './settings-content'

export const metadata = { title: 'Settings — Terminal Workdesk' }

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [me, divisionRows, userRows] = await Promise.all([
    db.select({
      id: users.id, email: users.email, username: users.username, fullName: users.fullName,
      avatarUrl: users.avatarUrl, bio: users.bio, role: users.role,
      divisionId: users.divisionId,
    }).from(users).where(eq(users.id, session.id)).limit(1),

    db.select({ id: divisions.id, name: divisions.name })
      .from(divisions).where(isNull(divisions.deletedAt)).orderBy(asc(divisions.name)),

    // hanya super_admin yang butuh daftar semua user
    session.role === 'super_admin'
      ? db.select({
          id: users.id, email: users.email, username: users.username, fullName: users.fullName,
          role: users.role, isActive: users.isActive, avatarUrl: users.avatarUrl,
          divisionId: users.divisionId, createdAt: users.createdAt,
          divisionName: divisions.name,
        })
          .from(users)
          .leftJoin(divisions, eq(users.divisionId, divisions.id))
          .where(isNull(users.deletedAt))
          .orderBy(asc(users.fullName))
      : Promise.resolve([]),
  ])

  return (
    <SettingsContent
      me={me[0] as any}
      allUsers={userRows as any[]}
      divisions={divisionRows}
      currentUser={{ id: session.id, role: session.role }}
    />
  )
}
