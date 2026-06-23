import { db } from '@/lib/db'
import { divisions } from '@/lib/db/schema'
import { isNull, asc } from 'drizzle-orm'
import RegisterForm from './register-form'

export const metadata = { title: 'Daftar — Terminal Workdesk' }

export default async function RegisterPage() {
  const divisionRows = await db
    .select({ id: divisions.id, name: divisions.name })
    .from(divisions)
    .where(isNull(divisions.deletedAt))
    .orderBy(asc(divisions.name))

  return <RegisterForm divisions={divisionRows} />
}
