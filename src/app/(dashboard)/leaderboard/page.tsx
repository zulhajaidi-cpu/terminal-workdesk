import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { pointsLedger, users, divisions, userBadges, badges, monthlyRewards } from '@/lib/db/schema'
import { eq, desc, sql, and, notInArray } from 'drizzle-orm'
import { LeaderboardContent } from './leaderboard-content'

export const metadata = { title: 'Leaderboard — Terminal Workdesk' }

export default async function LeaderboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  const lastMonth = month === 1 ? 12 : month - 1
  const lastYear  = month === 1 ? year - 1 : year

  const [monthlyRows, allTimeRows, lastMonthRows, badgeRows, allUsers, rewardRows] = await Promise.all([
    // This month
    db.select({
      userId: pointsLedger.userId,
      totalPoints: sql<number>`cast(sum(${pointsLedger.points}) as int)`,
    })
      .from(pointsLedger)
      .where(and(eq(pointsLedger.periodMonth, month), eq(pointsLedger.periodYear, year)))
      .groupBy(pointsLedger.userId)
      .orderBy(desc(sql`sum(${pointsLedger.points})`)),

    // All time
    db.select({
      userId: pointsLedger.userId,
      totalPoints: sql<number>`cast(sum(${pointsLedger.points}) as int)`,
    })
      .from(pointsLedger)
      .groupBy(pointsLedger.userId)
      .orderBy(desc(sql`sum(${pointsLedger.points})`)),

    // Last month
    db.select({
      userId: pointsLedger.userId,
      totalPoints: sql<number>`cast(sum(${pointsLedger.points}) as int)`,
    })
      .from(pointsLedger)
      .where(and(eq(pointsLedger.periodMonth, lastMonth), eq(pointsLedger.periodYear, lastYear)))
      .groupBy(pointsLedger.userId)
      .orderBy(desc(sql`sum(${pointsLedger.points})`)),

    // Badges per user
    db.select({
      userId: userBadges.userId,
      badgeName: badges.name,
      badgeIcon: badges.icon,
      badgeId: badges.id,
    })
      .from(userBadges)
      .leftJoin(badges, eq(userBadges.badgeId, badges.id)),

    // All active users (to show even with 0 points)
    db.select({
      id: users.id,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      divisionId: users.divisionId,
      divisionName: divisions.name,
    })
      .from(users)
      .leftJoin(divisions, eq(users.divisionId, divisions.id))
      .where(and(eq(users.isActive, true), notInArray(users.role, ['super_admin', 'spv_manager', 'head_director']))),

    // Monthly rewards
    db.select({
      periodMonth: monthlyRewards.periodMonth,
      periodYear: monthlyRewards.periodYear,
      rank: monthlyRewards.rank,
      rewardName: monthlyRewards.rewardName,
      rewardImageLink: monthlyRewards.rewardImageLink,
      winnerUserId: monthlyRewards.winnerUserId,
      notes: monthlyRewards.notes,
      winnerName: users.fullName,
    })
      .from(monthlyRewards)
      .leftJoin(users, eq(monthlyRewards.winnerUserId, users.id))
      .where(and(eq(monthlyRewards.periodMonth, month), eq(monthlyRewards.periodYear, year))),
  ])

  return (
    <LeaderboardContent
      monthly={monthlyRows}
      allTime={allTimeRows}
      lastMonth={lastMonthRows}
      badgeRows={badgeRows as any[]}
      allUsers={allUsers as any[]}
      rewards={rewardRows as any[]}
      currentUser={{ id: session.id, role: session.role }}
      currentPeriod={{ month, year }}
    />
  )
}
