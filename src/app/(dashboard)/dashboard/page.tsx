import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { neon } from '@neondatabase/serverless'
import { projects, tasks, calendarEvents, kpiItems, pointsLedger, monthlyRewards, taskAssignees, users, divisions, madingPosts, userMoods } from '@/lib/db/schema'
import { eq, and, ne, isNull, gte, lte, desc, asc, sql } from 'drizzle-orm'
import { DashboardContent } from './dashboard-content'

const sqlRaw = neon(process.env.DATABASE_URL!)

export const metadata = { title: 'Dashboard — Terminal Workdesk' }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ division?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const sp = await searchParams
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const monthStart = new Date(year, now.getMonth(), 1)

  // Division filter — defaults to the user's own division; 'all' shows every division.
  const selectedDivision = sp.division ?? session.divisionId ?? 'all'
  const divId = selectedDivision === 'all' ? null : selectedDivision

  const [
    allDivisions,
    totalProjectsRows,
    overdueProjectsRows,
    activeTasksRows,
    overdueTasksRows,
    completedTasksRows,
    projectsDoneRows,
    projectsTotalRows,
    tasksDoneRows,
    tasksTotalRows,
    recentProjects,
    myTasks,
    upcomingEvents,
    myKpi,
    leaderboardRaw,
    myPointsRaw,
    monthlyRewardRow,
    madingRows,
    todayMoodRows,
  ] = await Promise.all([
    db.select({ id: divisions.id, name: divisions.name }).from(divisions).orderBy(asc(divisions.name)),
    db.select({ count: sql<number>`count(*)` }).from(projects)
      .where(and(isNull(projects.deletedAt), ne(projects.status, 'Cancelled'), ne(projects.status, 'Completed'), ...(divId ? [eq(projects.divisionId, divId)] : []))),
    db.select({ count: sql<number>`count(*)` }).from(projects)
      .where(and(isNull(projects.deletedAt), eq(projects.isOverdue, true), ...(divId ? [eq(projects.divisionId, divId)] : []))),
    db.select({ count: sql<number>`count(*)` }).from(tasks)
      .where(and(isNull(tasks.deletedAt), ne(tasks.status, 'Completed'), ne(tasks.status, 'Cancelled'), ...(divId ? [eq(tasks.divisionId, divId)] : []))),
    db.select({ count: sql<number>`count(*)` }).from(tasks)
      .where(and(
        isNull(tasks.deletedAt),
        ne(tasks.status, 'Completed'),
        ne(tasks.status, 'Cancelled'),
        lte(tasks.dueDate, sql`NOW() + INTERVAL '3 days'`),
        ...(divId ? [eq(tasks.divisionId, divId)] : []),
      )),
    db.select({ count: sql<number>`count(*)` }).from(tasks)
      .where(and(isNull(tasks.deletedAt), eq(tasks.status, 'Completed'), gte(tasks.completedAt, monthStart), ...(divId ? [eq(tasks.divisionId, divId)] : []))),
    // Project completion progress (Completed vs all non-cancelled)
    db.select({ count: sql<number>`count(*)` }).from(projects)
      .where(and(isNull(projects.deletedAt), eq(projects.status, 'Completed'), ...(divId ? [eq(projects.divisionId, divId)] : []))),
    db.select({ count: sql<number>`count(*)` }).from(projects)
      .where(and(isNull(projects.deletedAt), ne(projects.status, 'Cancelled'), ...(divId ? [eq(projects.divisionId, divId)] : []))),
    // Task completion progress (Completed vs all non-cancelled)
    db.select({ count: sql<number>`count(*)` }).from(tasks)
      .where(and(isNull(tasks.deletedAt), eq(tasks.status, 'Completed'), ...(divId ? [eq(tasks.divisionId, divId)] : []))),
    db.select({ count: sql<number>`count(*)` }).from(tasks)
      .where(and(isNull(tasks.deletedAt), ne(tasks.status, 'Cancelled'), ...(divId ? [eq(tasks.divisionId, divId)] : []))),
    db.select({
      id: projects.id, name: projects.name, status: projects.status,
      priority: projects.priority, progress: projects.progress,
      deadline: projects.deadline, isOverdue: projects.isOverdue,
      divisionName: divisions.name,
    })
      .from(projects).leftJoin(divisions, eq(projects.divisionId, divisions.id))
      .where(and(isNull(projects.deletedAt), ne(projects.status, 'Cancelled'), ...(divId ? [eq(projects.divisionId, divId)] : [])))
      .orderBy(desc(projects.updatedAt)).limit(5),
    db.select({
      id: tasks.id, name: tasks.name, status: tasks.status,
      priority: tasks.priority, dueDate: tasks.dueDate, isOverdue: tasks.isOverdue,
    })
      .from(tasks).innerJoin(taskAssignees, eq(tasks.id, taskAssignees.taskId))
      .where(and(isNull(tasks.deletedAt), eq(taskAssignees.userId, session.id), ne(tasks.status, 'Completed'), ne(tasks.status, 'Cancelled')))
      .orderBy(tasks.dueDate).limit(5),
    db.select({ id: calendarEvents.id, title: calendarEvents.title, eventType: calendarEvents.eventType, startAt: calendarEvents.startAt, endAt: calendarEvents.endAt })
      .from(calendarEvents)
      .where(and(isNull(calendarEvents.deletedAt), gte(calendarEvents.startAt, now)))
      .orderBy(calendarEvents.startAt).limit(5),
    db.select().from(kpiItems)
      .where(and(isNull(kpiItems.deletedAt), eq(kpiItems.userId, session.id), eq(kpiItems.periodMonth, month), eq(kpiItems.periodYear, year))),
    db.select({
      userId: pointsLedger.userId, points: pointsLedger.points,
      userName: users.fullName, divisionName: divisions.name,
    })
      .from(pointsLedger).leftJoin(users, eq(pointsLedger.userId, users.id))
      .leftJoin(divisions, eq(pointsLedger.divisionId, divisions.id))
      .where(and(eq(pointsLedger.periodMonth, month), eq(pointsLedger.periodYear, year), ...(divId ? [eq(pointsLedger.divisionId, divId)] : [])))
      .limit(200),
    db.select({ points: pointsLedger.points })
      .from(pointsLedger)
      .where(and(eq(pointsLedger.userId, session.id), eq(pointsLedger.periodMonth, month), eq(pointsLedger.periodYear, year))),
    db.select().from(monthlyRewards)
      .where(and(eq(monthlyRewards.periodMonth, month), eq(monthlyRewards.periodYear, year), eq(monthlyRewards.rank, 1)))
      .limit(1),
    db.select({
      id: madingPosts.id, title: madingPosts.title, content: madingPosts.content,
      mediaUrl: madingPosts.mediaUrl, createdAt: madingPosts.createdAt,
      creatorName: users.fullName, creatorAvatar: users.avatarUrl, creatorRole: users.role,
    })
      .from(madingPosts)
      .leftJoin(users, eq(madingPosts.createdBy, users.id))
      .where(isNull(madingPosts.deletedAt))
      .orderBy(desc(madingPosts.createdAt))
      .limit(20),
    db.select({ moodEmoji: userMoods.moodEmoji, moodLabel: userMoods.moodLabel })
      .from(userMoods)
      .where(and(
        eq(userMoods.userId, session.id),
        eq(userMoods.moodDate, sql`(CURRENT_DATE AT TIME ZONE 'Asia/Jakarta')::date`),
      ))
      .limit(1),
  ])

  const myTotalPoints = myPointsRaw.reduce((sum, r) => sum + (r.points ?? 0), 0)

  let taskStatusData: { status: string; cnt: number }[]
  let trendData: { day: string; cnt: number }[]

  if (divId) {
    ;[taskStatusData, trendData] = (await Promise.all([
      sqlRaw`SELECT status, COUNT(*)::int AS cnt FROM tasks WHERE deleted_at IS NULL AND division_id = ${divId} AND status NOT IN ('Cancelled') GROUP BY status ORDER BY cnt DESC`,
      sqlRaw`SELECT TO_CHAR(completed_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon') AS day, COUNT(*)::int AS cnt FROM tasks WHERE deleted_at IS NULL AND status = 'Completed' AND completed_at IS NOT NULL AND completed_at >= NOW() - INTERVAL '14 days' AND division_id = ${divId} GROUP BY DATE(completed_at AT TIME ZONE 'Asia/Jakarta'), TO_CHAR(completed_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon') ORDER BY DATE(completed_at AT TIME ZONE 'Asia/Jakarta')`,
    ])) as unknown as [typeof taskStatusData, typeof trendData]
  } else {
    ;[taskStatusData, trendData] = (await Promise.all([
      sqlRaw`SELECT status, COUNT(*)::int AS cnt FROM tasks WHERE deleted_at IS NULL AND status NOT IN ('Cancelled') GROUP BY status ORDER BY cnt DESC`,
      sqlRaw`SELECT TO_CHAR(completed_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon') AS day, COUNT(*)::int AS cnt FROM tasks WHERE deleted_at IS NULL AND status = 'Completed' AND completed_at IS NOT NULL AND completed_at >= NOW() - INTERVAL '14 days' GROUP BY DATE(completed_at AT TIME ZONE 'Asia/Jakarta'), TO_CHAR(completed_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon') ORDER BY DATE(completed_at AT TIME ZONE 'Asia/Jakarta')`,
    ])) as unknown as [typeof taskStatusData, typeof trendData]
  }

  const pointsMap: Record<string, { name: string; division: string; total: number }> = {}
  for (const row of leaderboardRaw) {
    const uid = row.userId
    if (!pointsMap[uid]) {
      pointsMap[uid] = { name: row.userName ?? '—', division: row.divisionName ?? '—', total: 0 }
    }
    pointsMap[uid].total += row.points ?? 0
  }
  const leaderboardList = Object.entries(pointsMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([uid, v], i) => ({ rank: i + 1, userId: uid, ...v }))
  const myRank = leaderboardList.findIndex(l => l.userId === session.id) + 1

  // Mading reactions & comment counts
  const madingIds = madingRows.map(r => r.id)
  let reactionCountRows: { post_id: string; emoji: string; cnt: number }[] = []
  let myReactionRows: { post_id: string; emoji: string }[] = []
  let commentCountRows: { post_id: string; cnt: number }[] = []
  if (madingIds.length > 0) {
    ;[reactionCountRows, myReactionRows, commentCountRows] = (await Promise.all([
      sqlRaw`SELECT post_id, emoji, COUNT(*)::int AS cnt FROM mading_reactions WHERE post_id = ANY(${madingIds}) GROUP BY post_id, emoji ORDER BY cnt DESC`,
      sqlRaw`SELECT post_id, emoji FROM mading_reactions WHERE user_id = ${session.id} AND post_id = ANY(${madingIds})`,
      sqlRaw`SELECT post_id, COUNT(*)::int AS cnt FROM mading_comments WHERE deleted_at IS NULL AND post_id = ANY(${madingIds}) GROUP BY post_id`,
    ])) as unknown as [typeof reactionCountRows, typeof myReactionRows, typeof commentCountRows]
  }
  const reactionsByPost: Record<string, { emoji: string; count: number }[]> = {}
  for (const r of reactionCountRows) {
    ;(reactionsByPost[r.post_id] ??= []).push({ emoji: r.emoji, count: r.cnt })
  }
  const myReactionByPost: Record<string, string> = {}
  for (const r of myReactionRows) myReactionByPost[r.post_id] = r.emoji
  const commentCountByPost: Record<string, number> = {}
  for (const r of commentCountRows) commentCountByPost[r.post_id] = r.cnt

  return (
    <DashboardContent
      profile={{ full_name: session.fullName, role: session.role, avatar_url: session.avatarUrl } as any}
      stats={{
        totalProjects: Number(totalProjectsRows[0]?.count ?? 0),
        overdueProjects: Number(overdueProjectsRows[0]?.count ?? 0),
        activeTasks: Number(activeTasksRows[0]?.count ?? 0),
        overdueTasks: Number(overdueTasksRows[0]?.count ?? 0),
        completedThisMonth: Number(completedTasksRows[0]?.count ?? 0),
      }}
      recentProjects={recentProjects as any[]}
      myTasks={myTasks as any[]}
      upcomingEvents={upcomingEvents as any[]}
      myKpi={myKpi as any[]}
      leaderboard={leaderboardList}
      myPoints={myTotalPoints}
      myRank={myRank}
      monthlyReward={monthlyRewardRow[0] as any ?? null}
      chartData={{ taskStatus: taskStatusData, trend: trendData }}
      progress={{
        projectsDone: Number(projectsDoneRows[0]?.count ?? 0),
        projectsTotal: Number(projectsTotalRows[0]?.count ?? 0),
        tasksDone: Number(tasksDoneRows[0]?.count ?? 0),
        tasksTotal: Number(tasksTotalRows[0]?.count ?? 0),
      }}
      divisions={allDivisions}
      selectedDivision={selectedDivision}
      madingPosts={madingRows.map(r => ({
        id: r.id,
        title: r.title,
        content: r.content,
        mediaUrl: r.mediaUrl ?? null,
        createdAt: new Date(r.createdAt as any).toISOString(),
        creatorName: r.creatorName ?? 'Unknown',
        creatorAvatar: r.creatorAvatar ?? null,
        creatorRole: r.creatorRole ?? 'staff',
        reactions: reactionsByPost[r.id] ?? [],
        myReaction: myReactionByPost[r.id] ?? null,
        commentCount: commentCountByPost[r.id] ?? 0,
      }))}
      currentUserId={session.id}
      canPostMading={['leader_divisi', 'spv_manager', 'head_director', 'super_admin'].includes(session.role)}
      canModerateMading={['head_director', 'super_admin'].includes(session.role)}
      todayMood={todayMoodRows[0] ? { emoji: todayMoodRows[0].moodEmoji, label: todayMoodRows[0].moodLabel } : null}
    />
  )
}
