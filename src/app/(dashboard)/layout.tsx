import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <DashboardLayout user={{ full_name: session.fullName, role: session.role, avatar_url: session.avatarUrl }}>
      {children}
    </DashboardLayout>
  )
}
