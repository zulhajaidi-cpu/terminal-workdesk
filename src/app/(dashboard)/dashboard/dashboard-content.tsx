'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { Card, StatCard } from '@/components/ui/card'
import { Badge, StatusBadge, PriorityBadge } from '@/components/ui/badge'
import { ProgressBar, getProgressColor } from '@/components/ui/progress-bar'
import { Avatar } from '@/components/ui/avatar'
import {
  TrendingUp, CheckCircle, Trophy, Star, Calendar, ArrowRight,
} from 'lucide-react'
import { MadingWidget } from './MadingWidget'
import type { MadingPost } from './MadingWidget'
import { saveMood } from './mood-actions'
import { canViewBudget } from '@/lib/roles'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, AreaChart, Area, Legend, TooltipProps,
} from 'recharts'

interface Props {
  profile: { full_name: string; role: string; avatar_url?: string | null; divisions?: { name: string } | null } | null
  stats: { totalProjects: number; overdueProjects: number; activeTasks: number; overdueTasks: number; completedThisMonth: number }
  recentProjects: Array<{ id: string; name: string; status: string; priority: string; progress: number; deadline: string; is_overdue: boolean; divisions?: { name: string } | null }>
  myTasks: Array<{ id: string; name: string; status: string; priority: string; due_date: string; is_overdue: boolean; projects?: { name: string } | null }>
  upcomingEvents: Array<{ id: string; title: string; event_type: string; start_at: string }>
  myKpi: Array<{ kpi_name: string; weight: number; realization: number | null; target: number | null; final_score: number | null; auto_score: number | null; max_score: number; status: string }>
  leaderboard: Array<{ rank: number; userId: string; name: string; division: string; total: number }>
  myPoints: number
  myRank: number
  monthlyReward: { reward_name: string; rank: number } | null
  chartData: {
    budget: { name: string; budget: number }[]
    taskStatus: { status: string; cnt: number }[]
    trend: { day: string; cnt: number }[]
  }
  divisions: { id: string; name: string }[]
  selectedDivision: string
  madingPosts: MadingPost[]
  canPostMading: boolean
  todayMood: { emoji: string; label: string } | null
}


const MOODS = [
  { emoji: '🤩', label: 'Sangat Semangat', color: '#FF6A1A' },
  { emoji: '🙂', label: 'Baik',            color: '#3FD08A' },
  { emoji: '😐', label: 'Biasa Saja',      color: '#4A9EFF' },
  { emoji: '😎', label: 'Santai / Aman',   color: '#06B6D4' },
  { emoji: '🥳', label: 'Ada Kabar Baik',  color: '#A78BFA' },
  { emoji: '😴', label: 'Mengantuk',       color: '#94A3B8' },
  { emoji: '🤯', label: 'Banyak Pikiran',  color: '#F59E0B' },
  { emoji: '😰', label: 'Dikejar Deadline',color: '#EF4444' },
  { emoji: '🤒', label: 'Kurang Fit',      color: '#78716C' },
  { emoji: '😡', label: 'Frustrasi',       color: '#FF4D6D' },
]

/* ═══════════════ STATUS COLORS ═══════════════ */
const STATUS_COLORS: Record<string, string> = {
  'Completed':   '#3FD08A',
  'In Progress': '#FF6A1A',
  'To Do':       '#6B7385',
  'Need Review': '#4A9EFF',
  'Revision':    '#F59E0B',
  'On Hold':     '#F59E0B',
}

/* Custom dark tooltip */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
      {label != null && <p style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '6px', fontFamily: "'IBM Plex Mono', monospace" }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color ?? p.payload?.color, display: 'inline-block' }} />
          <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{p.name}:</span>
          <span style={{ color: '#fff', fontWeight: 700 }}>
            {p.dataKey === 'budget' ? `Rp ${p.value} jt` : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

const CARD = 'rounded-3xl p-5'
const cardStyle: React.CSSProperties = { background: '#161a23', border: '1px solid rgba(255,255,255,0.06)' }

export function DashboardContent({ profile, stats, recentProjects, myTasks, upcomingEvents, myKpi, leaderboard, myPoints, myRank, monthlyReward, chartData, divisions, selectedDivision, madingPosts, canPostMading, todayMood }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const now = new Date()
  const monthName = now.toLocaleString('id-ID', { month: 'long', timeZone: 'Asia/Jakarta' })
  const year = now.getFullYear()
  const showBudget = canViewBudget(profile?.role ?? '')
  const isAllDivisions = selectedDivision === 'all'

  function handleDivisionChange(value: string) {
    startTransition(() => router.push(`/dashboard?division=${value}`))
  }

  // Chart-ready data from server
  const budgetChartData = chartData.budget.map(b => ({
    name: b.name.length > 18 ? b.name.slice(0, 17) + '…' : b.name,
    budget: Math.round(Number(b.budget) / 1_000_000),
  }))
  const taskStatusChartData = chartData.taskStatus.map(s => ({
    name: s.status, value: s.cnt, color: STATUS_COLORS[s.status] ?? '#475569',
  }))
  const trendChartData = chartData.trend.map(t => ({ day: t.day, selesai: t.cnt }))

  const kpiOverall = myKpi.length > 0
    ? Math.round(myKpi.reduce((sum, k) => {
        const score = k.final_score ?? k.auto_score ?? 0
        return sum + (score / k.max_score) * k.weight
      }, 0))
    : null

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">

      {/* Header greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-[#EDF0F5] leading-tight">
            Halo, {profile?.full_name?.split(' ')[0] ?? 'User'} 👋
          </h1>
          <p className="text-[#6B7385] text-sm mt-0.5">
            {profile?.divisions?.name ?? 'Department Terminal'} · {monthName} {year}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedDivision}
            onChange={e => handleDivisionChange(e.target.value)}
            disabled={isPending}
            style={{
              background: '#161a23', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
              padding: '8px 12px', color: '#EDF0F5', fontSize: '13px', fontFamily: "'Space Grotesk', sans-serif",
              cursor: 'pointer',
            }}
          >
            <option value="all">Semua Divisi</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="flex items-center gap-2 text-[#6B7385] font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-[#3FD08A] animate-pulse-dot" />
            Live data
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MadingWidget posts={madingPosts} canPost={canPostMading} />
        </div>
        <MoodTracker todayMood={todayMood} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Project Aktif" value={stats.totalProjects} sub={`${stats.overdueProjects} overdue`} />
        <StatCard label="Task Aktif" value={stats.activeTasks} />
        <StatCard label="Deadline Alert" value={stats.overdueTasks} valueColor="#FF8A4C" sub="deadline ≤ 3 hari" />
        <StatCard label={`Selesai ${monthName.slice(0, 3)}`} value={stats.completedThisMonth} valueColor="#3FD08A" />
        <div className="col-span-2 sm:col-span-1">
          <Card style={{ background: 'linear-gradient(135deg,rgba(255,106,26,0.16),rgba(255,106,26,0.04))', borderColor: 'rgba(255,106,26,0.28)' }}>
            <div className="p-3 sm:p-4">
              <div className="font-mono text-[9.5px] tracking-widest text-[#FFB489] uppercase mb-1">Poin Saya</div>
              <div className="font-grotesk font-bold text-2xl text-white">{myPoints}</div>
              {myRank > 0 && <div className="text-[11px] text-[#FF8A4C] mt-0.5">Peringkat #{myRank}</div>}
            </div>
          </Card>
        </div>
      </div>

      {/* ── CHARTS (live data) ── */}
      <div className={`grid grid-cols-1 gap-4 ${showBudget ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {/* Bar: Budget per Project */}
        {showBudget && (
          <div className={CARD} style={cardStyle}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={15} className="text-[#3FD08A]" />
              <span className="font-grotesk font-semibold text-[14px] text-[#EDF0F5]">Budget Project</span>
            </div>
            <p className="text-[11px] text-[#6B7385] mb-4">{isAllDivisions ? 'Semua divisi · ' : ''}Rp juta</p>
            {budgetChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[210px] text-[#6B7385] text-sm">Belum ada data budget</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={budgetChartData} margin={{ top: 4, right: 4, left: -12, bottom: 40 }}>
                  <XAxis dataKey="name" tick={{ fill: '#6B7385', fontSize: 9 }} axisLine={false} tickLine={false}
                    interval={0} angle={-35} textAnchor="end" />
                  <YAxis tick={{ fill: '#6B7385', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="budget" name="Budget (juta)" fill="#FF6A1A" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Donut: Task status breakdown */}
        <div className={CARD} style={cardStyle}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={15} className="text-[#4A9EFF]" />
            <span className="font-grotesk font-semibold text-[14px] text-[#EDF0F5]">Status Task</span>
          </div>
          <p className="text-[11px] text-[#6B7385] mb-2">{isAllDivisions ? 'Semua divisi' : 'Divisi terpilih'}</p>
          {taskStatusChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[210px] text-[#6B7385] text-sm">Belum ada task</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={taskStatusChartData} dataKey="value" nameKey="name" cx="50%" cy="48%"
                  innerRadius={50} outerRadius={78} paddingAngle={3} stroke="none">
                  {taskStatusChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend verticalAlign="bottom" height={28}
                  formatter={(v) => <span style={{ color: '#A5AEC0', fontSize: 10 }}>{v}</span>}
                  iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Area: Task completion trend */}
        <div className={CARD} style={cardStyle}>
          <div className="flex items-center gap-2 mb-1">
            <Star size={15} className="text-[#FF6A1A]" />
            <span className="font-grotesk font-semibold text-[14px] text-[#EDF0F5]">Tren Penyelesaian · 14 Hari</span>
          </div>
          <p className="text-[11px] text-[#6B7385] mb-4">Task selesai per hari</p>
          {trendChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[210px] text-[#6B7385] text-sm">Belum ada task selesai 14 hari ini</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={trendChartData} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3FD08A" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#3FD08A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: '#6B7385', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7385', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#3FD08A', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="selesai" name="Task Selesai" stroke="#3FD08A" strokeWidth={2.5}
                  fill="url(#trendGrad)" dot={{ fill: '#3FD08A', r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Existing real-data layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* My Tasks */}
          <Card>
            <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-[#FF8A4C]" />
                <span className="font-grotesk font-semibold text-[15px] text-[#EDF0F5]">Tugas Saya</span>
              </div>
              <Link href="/tasks" className="text-[12px] text-[#FF8A4C] hover:underline flex items-center gap-1">
                Lihat semua <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {myTasks.length === 0 ? (
                <div className="p-8 text-center text-[#6B7385] text-sm">
                  Tidak ada task aktif. Kerja bagus! 🎉
                </div>
              ) : myTasks.map(task => (
                <Link key={task.id} href={`/tasks?id=${task.id}`}
                  className="flex items-start gap-3 p-4 hover:bg-white/[0.02] transition-colors group">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                    style={{ background: task.is_overdue ? '#FF6B6B' : task.status === 'In Progress' ? '#FF8A4C' : '#6B7385' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-[#EDF0F5] font-medium truncate group-hover:text-white">{task.name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {task.projects?.name && (
                        <span className="font-mono text-[9.5px] text-[#6B7385] bg-white/5 px-1.5 py-0.5 rounded">{task.projects.name}</span>
                      )}
                      <span className="font-mono text-[10px] text-[#6B7385]">
                        {formatDate(task.due_date, { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.is_overdue ? 'Overdue' : task.status} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Recent Projects */}
          <Card>
            <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-[#FF8A4C]" />
                <span className="font-grotesk font-semibold text-[15px] text-[#EDF0F5]">Project Aktif</span>
              </div>
              <Link href="/projects" className="text-[12px] text-[#FF8A4C] hover:underline flex items-center gap-1">
                Lihat semua <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {recentProjects.length === 0 ? (
                <div className="p-8 text-center text-[#6B7385] text-sm">Belum ada project aktif.</div>
              ) : recentProjects.map(p => (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13.5px] text-[#EDF0F5] font-medium truncate group-hover:text-white">{p.name}</span>
                      {p.is_overdue && <Badge variant="red">Overdue</Badge>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[#6B7385]">{(p.divisions as { name?: string } | null)?.name ?? '—'}</span>
                      <span className="font-mono text-[10px] text-[#6B7385]">Deadline {formatDate(p.deadline, { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <ProgressBar value={p.progress} className="mt-2" color={getProgressColor(p.progress)} height={5} showLabel />
                  </div>
                  <div className="flex-shrink-0">
                    <StatusBadge status={p.status} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* KPI card */}
          {myKpi.length > 0 && (
            <Card>
              <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-[#FF8A4C]" />
                  <span className="font-grotesk font-semibold text-[14px] text-[#EDF0F5]">KPI {monthName}</span>
                </div>
                {kpiOverall !== null && (
                  <span className="font-grotesk font-bold text-lg" style={{ color: getProgressColor(kpiOverall) }}>
                    {kpiOverall}%
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3">
                {myKpi.slice(0, 4).map((k, i) => {
                  const score = k.final_score ?? k.auto_score ?? 0
                  const pct = k.max_score > 0 ? Math.round((score / k.max_score) * 100) : 0
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-[11px] text-[#A5AEC0] mb-1">
                        <span className="truncate max-w-[60%]">{k.kpi_name}</span>
                        <span className="font-mono text-[#EDF0F5]">{pct}%</span>
                      </div>
                      <ProgressBar value={pct} color={getProgressColor(pct)} height={5} animated={false} />
                    </div>
                  )
                })}
                <Link href="/kpi" className="block text-center text-[12px] text-[#FF8A4C] hover:underline mt-2">
                  Detail KPI →
                </Link>
              </div>
            </Card>
          )}

          {/* Leaderboard */}
          <Card>
            <div className="p-4 border-b border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-[#FF8A4C]" />
                <span className="font-grotesk font-semibold text-[14px] text-[#EDF0F5]">Leaderboard</span>
              </div>
            </div>
            {monthlyReward && (
              <div className="mx-4 mt-4 p-3 rounded-xl"
                style={{ background: 'linear-gradient(135deg,#1a130c,#120d08)', border: '1px solid rgba(255,106,26,0.28)' }}>
                <div className="font-mono text-[9.5px] tracking-widest text-[#FFB489] uppercase">Hadiah Bulan Ini</div>
                <div className="font-grotesk font-bold text-[14px] text-white mt-1">{monthlyReward.reward_name}</div>
              </div>
            )}
            <div className="p-4 space-y-2">
              {leaderboard.length === 0 ? (
                <div className="text-center text-[#6B7385] text-sm py-4">Belum ada data poin bulan ini.</div>
              ) : leaderboard.map((l) => (
                <div key={l.userId} className="flex items-center gap-3 py-1.5">
                  <span className="font-grotesk font-bold text-[13px] w-5 flex-shrink-0"
                    style={{ color: l.rank === 1 ? '#FF8A4C' : l.rank === 2 ? '#A5AEC0' : l.rank === 3 ? '#C08040' : '#6B7385' }}>
                    {l.rank}
                  </span>
                  <Avatar name={l.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[#EDF0F5] font-medium truncate">{l.name}</div>
                    <div className="font-mono text-[10px] text-[#6B7385]">{l.division}</div>
                  </div>
                  <span className="font-grotesk font-bold text-[13px] text-white flex-shrink-0">{l.total}</span>
                </div>
              ))}
              <Link href="/leaderboard" className="block text-center text-[12px] text-[#FF8A4C] hover:underline pt-1">
                Lihat semua →
              </Link>
            </div>
          </Card>

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <Card>
              <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-[#FF8A4C]" />
                  <span className="font-grotesk font-semibold text-[14px] text-[#EDF0F5]">Agenda</span>
                </div>
                <Link href="/calendar" className="text-[12px] text-[#FF8A4C] hover:underline">Lihat →</Link>
              </div>
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {upcomingEvents.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 p-3.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#FF8A4C' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] text-[#EDF0F5] font-medium truncate">{ev.title}</div>
                      <div className="font-mono text-[10px] text-[#6B7385] mt-0.5">
                        {formatDate(ev.start_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}
                      </div>
                    </div>
                    <Badge variant="ghost">{ev.event_type}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ MOOD TRACKER ═══════════════ */
function MoodTracker({ todayMood }: { todayMood: { emoji: string; label: string } | null }) {
  const initIdx = todayMood ? MOODS.findIndex(m => m.emoji === todayMood.emoji) : -1
  const [selected, setSelected] = useState<number | null>(initIdx >= 0 ? initIdx : null)
  const [, startMoodTransition] = useTransition()

  function pick(i: number) {
    setSelected(i)
    startMoodTransition(async () => {
      await saveMood(MOODS[i].emoji, MOODS[i].label)
    })
  }

  return (
    <div className={CARD} style={cardStyle}>
      <p className="font-grotesk font-semibold text-[14px] text-[#EDF0F5]">How are you feeling today?</p>
      <p className="text-[11px] text-[#6B7385] mt-0.5 mb-4">Pilih mood-mu hari ini</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {MOODS.map((m, i) => {
          const active = selected === i
          return (
            <button key={i} onClick={() => pick(i)} title={m.label}
              className="flex flex-col items-center gap-1.5 transition-all"
              style={{ flex: 1 }}>
              <span style={{
                fontSize: '26px', lineHeight: 1, padding: '8px', borderRadius: '14px',
                transition: 'all 0.2s',
                transform: active ? 'scale(1.12)' : 'scale(1)',
                border: active ? `2px solid ${m.color}` : '2px solid transparent',
                background: active ? `${m.color}1a` : 'transparent',
                boxShadow: active ? `0 0 18px ${m.color}66` : 'none',
                filter: active ? 'none' : 'grayscale(0.4) opacity(0.7)',
              }}>
                {m.emoji}
              </span>
              <span style={{ fontSize: '9px', textAlign: 'center', lineHeight: 1.2, color: active ? m.color : '#6B7385', fontWeight: active ? 700 : 500 }}>
                {m.label}
              </span>
            </button>
          )
        })}
      </div>
      {selected !== null && (
        <p className="text-center text-[11px] mt-4" style={{ color: MOODS[selected].color }}>
          Mood tersimpan: {MOODS[selected].emoji} {MOODS[selected].label}
        </p>
      )}
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span className="text-[11px] text-[#A5AEC0]">{label}</span>
    </div>
  )
}
