import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { approvalRequests, approvalSteps, projects, users } from '@/lib/db/schema'
import { eq, and, desc, or } from 'drizzle-orm'
import { ApprovalsContent } from './approvals-content'
import { canApprove } from '@/lib/roles'

export const metadata = { title: 'Approvals — Terminal Workdesk' }

const ROLE_STEP: Record<string, number> = {
  leader_divisi: 1,
  spv_manager: 2,
  head_director: 3,
  super_admin: 3,
}

export default async function ApprovalsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const myStep = ROLE_STEP[session.role]

  // Ambil semua approval requests
  const rows = await db
    .select({
      requestId: approvalRequests.id,
      requestStatus: approvalRequests.status,
      currentStep: approvalRequests.currentStep,
      requestedBy: approvalRequests.requestedBy,
      createdAt: approvalRequests.createdAt,
      projectId: projects.id,
      projectName: projects.name,
      projectCode: projects.projectCode,
      projectPriority: projects.priority,
      projectDeadline: projects.deadline,
      projectDivisionId: projects.divisionId,
      requesterName: users.fullName,
      stepOrder: approvalSteps.stepOrder,
      stepRole: approvalSteps.approverRole,
      stepAction: approvalSteps.action,
      stepNote: approvalSteps.note,
      stepActedAt: approvalSteps.actedAt,
    })
    .from(approvalRequests)
    .leftJoin(projects, eq(approvalRequests.relatedEntityId, projects.id))
    .leftJoin(users, eq(approvalRequests.requestedBy, users.id))
    .leftJoin(approvalSteps, eq(approvalSteps.approvalRequestId, approvalRequests.id))
    .orderBy(desc(approvalRequests.createdAt))

  // Group per request
  const map = new Map<string, any>()
  for (const row of rows) {
    if (!map.has(row.requestId)) {
      map.set(row.requestId, {
        id: row.requestId,
        status: row.requestStatus,
        currentStep: row.currentStep,
        createdAt: row.createdAt,
        requesterName: row.requesterName,
        requestedBy: row.requestedBy,
        projectDivisionId: row.projectDivisionId,
        project: {
          id: row.projectId, name: row.projectName,
          code: row.projectCode, priority: row.projectPriority, deadline: row.projectDeadline,
        },
        steps: [],
      })
    }
    if (row.stepOrder !== null) {
      map.get(row.requestId).steps.push({
        stepOrder: row.stepOrder, role: row.stepRole,
        action: row.stepAction, note: row.stepNote, actedAt: row.stepActedAt,
      })
    }
  }

  const allApprovals = Array.from(map.values()).map(r => ({
    ...r,
    steps: r.steps.sort((a: any, b: any) => a.stepOrder - b.stepOrder),
  }))

  // Filter visibilitas:
  // - super_admin / head_director / spv_manager: lihat semua (tidak terikat divisi)
  // - leader_divisi (SPV): lihat divisinya + yang dia ajukan sendiri
  // - staff: hanya yang dia ajukan sendiri
  const visibleApprovals = allApprovals.filter(a => {
    if (['super_admin', 'head_director', 'spv_manager'].includes(session.role)) return true
    if (session.role === 'leader_divisi') {
      return a.projectDivisionId === session.divisionId || a.requestedBy === session.id
    }
    return a.requestedBy === session.id
  })

  const approvalList = visibleApprovals.map(r => ({
    ...r,
    canActNow: canApprove(session.role) && r.status === 'Pending' && r.currentStep === myStep,
  }))

  const pendingForMe = approvalList.filter(a => a.canActNow)
  const others = approvalList.filter(a => !a.canActNow)

  return (
    <ApprovalsContent
      pendingForMe={pendingForMe}
      others={others}
      currentUser={{ id: session.id, role: session.role, step: myStep ?? 0 }}
    />
  )
}
