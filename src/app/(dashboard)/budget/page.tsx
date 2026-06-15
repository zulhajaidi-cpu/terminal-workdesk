import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { budgets, projects, divisions } from '@/lib/db/schema'
import { isNull, eq, desc } from 'drizzle-orm'
import { BudgetContent } from './budget-content'

export const metadata = { title: 'Budget — Terminal Workdesk' }

export default async function BudgetPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [budgetRows, projectRows] = await Promise.all([
    db.select({
      id: budgets.id,
      category: budgets.category,
      planned: budgets.planned,
      approved: budgets.approved,
      actual: budgets.actual,
      vendor: budgets.vendor,
      invoiceLink: budgets.invoiceLink,
      reimburseLink: budgets.reimburseLink,
      paymentStatus: budgets.paymentStatus,
      notes: budgets.notes,
      createdAt: budgets.createdAt,
      projectId: projects.id,
      projectName: projects.name,
      projectCode: projects.projectCode,
      divisionName: divisions.name,
    })
      .from(budgets)
      .leftJoin(projects, eq(budgets.projectId, projects.id))
      .leftJoin(divisions, eq(projects.divisionId, divisions.id))
      .where(isNull(budgets.deletedAt))
      .orderBy(desc(budgets.createdAt)),
    db.select({ id: projects.id, name: projects.name, projectCode: projects.projectCode })
      .from(projects)
      .where(isNull(projects.deletedAt))
      .orderBy(projects.name),
  ])

  return (
    <BudgetContent
      budgets={budgetRows as any[]}
      projects={projectRows}
      currentUser={{ id: session.id, role: session.role }}
    />
  )
}
