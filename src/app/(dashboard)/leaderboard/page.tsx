import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { neon } from '@neondatabase/serverless'
import { pointsLedger, users, divisions, userBadges, badges, monthlyRewards } from '@/lib/db/schema'
import { eq, desc, sql, and, notInArray } from 'drizzle-orm'
import { LeaderboardContent } from './leaderboard-content'

const sqlRaw = neon(process.env.DATABASE_URL!)

export const metadata = { title: 'Leaderboard — Terminal Workdesk' }

export default async function LeaderboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  const lastMonth = month === 1 ? 12 : month - 1
  const lastYear  = month === 1 ? year - 1 : year

  const [monthlyRows, allTimeRows, lastMonthRows, badgeRows, allUsers, rewardRows, expSourceRows] = await Promise.all([
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
      bio: users.bio,
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

    // Rincian EXP per sumber (all-time, kecuali 'kpi') untuk character card
    db.select({
      userId: pointsLedger.userId,
      sourceType: pointsLedger.sourceType,
      total: sql<number>`cast(sum(${pointsLedger.points}) as int)`,
    })
      .from(pointsLedger)
      .where(sql`${pointsLedger.sourceType} <> 'kpi'`)
      .groupBy(pointsLedger.userId, pointsLedger.sourceType),
  ])

  // Susun map: userId → { sourceType: total } (EXP all-time per sumber, excl kpi).
  const expBySource: Record<string, Record<string, number>> = {}
  for (const r of expSourceRows as { userId: string; sourceType: string; total: number }[]) {
    (expBySource[r.userId] ??= {})[r.sourceType] = r.total
  }

  // Mood/feeling TERAKHIR yang dipilih tiap user (untuk character card).
  const moodRows = (await sqlRaw`
    SELECT DISTINCT ON (user_id) user_id AS "userId", mood_emoji AS emoji, mood_label AS label
    FROM user_moods ORDER BY user_id, mood_date DESC
  `) as { userId: string; emoji: string; label: string }[]
  const moodByUser: Record<string, { emoji: string; label: string }> = {}
  for (const m of moodRows) moodByUser[m.userId] = { emoji: m.emoji, label: m.label }

  return (
    <LeaderboardContent
      monthly={monthlyRows}
      allTime={allTimeRows}
      lastMonth={lastMonthRows}
      badgeRows={badgeRows as any[]}
      allUsers={allUsers as any[]}
      rewards={rewardRows as any[]}
      expBySource={expBySource}
      moodByUser={moodByUser}
      currentUser={{ id: session.id, role: session.role }}
      currentPeriod={{ month, year }}
    />
  )
}
