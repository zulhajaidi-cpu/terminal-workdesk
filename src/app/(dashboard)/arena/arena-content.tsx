'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import confetti from 'canvas-confetti'
import { Avatar } from '@/components/ui/avatar'
import { ProgressBar } from '@/components/ui/progress-bar'
import { LootVault } from './loot-vault'
import { DailyGrind } from './daily-grind'
import { KudosPanel } from './kudos-panel'
import { DivisionWar } from './division-war'
import type { MyRewards, CurrentMonthRewards } from '@/lib/rewards'
import type { TodayQuiz } from '@/lib/quiz'
import type { KudosStatus } from '@/lib/kudos'
import type { DivisionWar as DivisionWarData } from '@/lib/division-war'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
} from 'recharts'
import {
  Swords, Flame, Trophy, Zap, Clock, CheckSquare, FolderKanban,
  TrendingUp, Sparkles, Crown, Medal, Lock,
} from 'lucide-react'

/* ═══════════════════ TYPES ═══════════════════ */
interface Me { fullName: string; avatarUrl: string | null; role: string; divisionName: string | null }
interface Exp {
  total: number; thisMonth: number; rank: number
  level: number; levelTitle: string; levelPct: number; intoLevel: number; span: number; toNext: number
}
interface LeaderRow { userId: string; fullName: string; avatarUrl: string | null; role: string; divisionName: string | null; exp: number }
interface Quest { id: string; name: string; dueDate: string; priority: string; isOverdue: boolean; projectName: string | null }
interface Activity { id: string; points: number; reason: string | null; sourceType: string; createdAt: string }
interface Streak { currentStreak: number; longestStreak: number; lastActiveDate: string | null }
interface BadgeRow { id: string; name: string; icon: string | null; description: string | null; criteriaKey: string | null; earned: boolean; awardedAt: string | null }

interface Props {
  me: Me
  exp: Exp
  leaderboard: LeaderRow[]
  quests: Quest[]
  trend: { day: string; exp: number }[]
  activity: Activity[]
  currentUserId: string
  rewards: MyRewards
  isAdmin: boolean
  adminClaims: any[]
  adminCatalog: any[]
  currentMonth: CurrentMonthRewards
  streak: Streak
  badges: BadgeRow[]
  kudos: KudosStatus
  teammates: { id: string; fullName: string; avatarUrl: string | null; divisionName: string | null }[]
  divisionWar: DivisionWarData
  quiz: TodayQuiz
  isQuizAdmin: boolean
  quizQuestions: any[]
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', head_director: 'Direktur', spv_manager: 'Manager',
  leader_divisi: 'SPV', staff: 'Staff',
}
const SOURCE_META: Record<string, { icon: string; label: string }> = {
  task:     { icon: '✓',  label: 'Task selesai' },
  project:  { icon: '🚀', label: 'Project selesai' },
  progress: { icon: '📝', label: 'Update progress' },
  quiz:     { icon: '🧠', label: 'Daily Grind' },
  streak:   { icon: '🔥', label: 'Streak harian' },
  kudos:    { icon: '👏', label: 'Kudos' },
  bonus:    { icon: '🎁', label: 'Bonus' },
  manual:   { icon: '⭐', label: 'Apresiasi' },
}

const MEDAL = ['🥇', '🥈', '🥉']
const RANK_COLOR = ['#F5C451', '#C8D0DD', '#D9893E']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
}
function dueLabel(iso: string, overdue: boolean) {
  const d = new Date(iso)
  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }))
  const due = new Date(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }))
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (overdue || days < 0) return { txt: `Telat ${Math.abs(days)}h`, color: '#FF6B6B' }
  if (days === 0) return { txt: 'Hari ini', color: '#F5C451' }
  if (days === 1) return { txt: 'Besok', color: '#FF8A4C' }
  return { txt: `${days} hari lagi`, color: '#6B7385' }
}

/* ═══════════════════ MAIN ═══════════════════ */
export function ArenaContent({ me, exp, leaderboard, quests, trend, activity, rewards, isAdmin, adminClaims, adminCatalog, currentMonth, streak, badges, kudos, teammates, divisionWar, quiz, isQuizAdmin, quizQuestions }: Props) {
  // Confetti sekali saat level user naik dibanding kunjungan terakhir.
  useEffect(() => {
    try {
      const key = 'goda_last_level'
      const prev = Number(localStorage.getItem(key) ?? '0')
      if (exp.level > prev) {
        if (prev > 0) {
          confetti({ particleCount: 140, spread: 80, origin: { y: 0.3 }, colors: ['#FF6A1A', '#F5C451', '#3FD08A', '#4A9EFF'] })
        }
        localStorage.setItem(key, String(exp.level))
      }
    } catch { /* localStorage unavailable */ }
  }, [exp.level])

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in" style={{ paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,106,26,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(255,106,26,0.25)' }}>
          <Swords size={22} color="#FF6A1A" />
        </span>
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-[#EDF0F5] leading-tight">GODA Arena</h1>
          <p className="text-[#6B7385] text-sm mt-0.5">Setiap grind dihargai. Naikkan EXP, taklukkan leaderboard. ⚔️</p>
        </div>
      </div>

      {/* ── PLAYER CARD ── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(120% 140% at 0% 0%, rgba(255,106,26,0.16) 0%, rgba(16,20,29,0) 45%), #10141d',
        border: '1px solid rgba(255,106,26,0.28)', borderRadius: 22, padding: 24,
        boxShadow: '0 0 40px rgba(255,106,26,0.12)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          {/* Avatar + neon level ring */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ borderRadius: '50%', padding: 3, background: 'conic-gradient(from 180deg, #FF6A1A, #F5C451, #FF6A1A)', boxShadow: '0 0 28px rgba(255,138,76,0.55)' }}>
              <Avatar name={me.fullName} imageUrl={me.avatarUrl ?? undefined} size="xl" />
            </div>
            <div style={{
              position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
              background: '#FF6A1A', color: '#fff', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800,
              fontSize: 12, padding: '2px 12px', borderRadius: 100, whiteSpace: 'nowrap',
              boxShadow: '0 0 16px rgba(255,106,26,0.8)', border: '2px solid #10141d',
            }}>LV {exp.level}</div>
          </div>

          {/* Name + progress */}
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 22, color: '#EDF0F5' }}>{me.fullName}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#FFB489', background: 'rgba(255,106,26,0.14)', padding: '3px 10px', borderRadius: 100, textShadow: '0 0 12px rgba(255,138,76,0.6)' }}>
                <Sparkles size={12} /> {exp.levelTitle}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6B7385', fontFamily: "'IBM Plex Mono',monospace", marginTop: 3 }}>
              {ROLE_LABEL[me.role] ?? me.role}{me.divisionName ? ` · ${me.divisionName}` : ''}
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: '#A5AEC0', fontFamily: "'IBM Plex Mono',monospace" }}>
                  {exp.intoLevel} / {exp.span} EXP
                </span>
                <span style={{ fontSize: 11, color: '#6B7385', fontFamily: "'IBM Plex Mono',monospace" }}>
                  {exp.toNext} EXP ke LV {exp.level + 1}
                </span>
              </div>
              <div style={{ borderRadius: 100, boxShadow: '0 0 16px rgba(255,106,26,0.4)' }}>
                <ProgressBar value={exp.levelPct} color="#FF6A1A" height={13} animated />
              </div>
            </div>
          </div>

          {/* Stat chips */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatChip icon={<Zap size={16} color="#F5C451" />} label="Total EXP" value={exp.total.toLocaleString('id-ID')} />
            <StatChip icon={<Flame size={16} color="#FF6A1A" />} label="Streak" value={streak.currentStreak > 0 ? `${streak.currentStreak} hari` : '—'} />
            <StatChip icon={<TrendingUp size={16} color="#3FD08A" />} label="EXP Bulan Ini" value={exp.thisMonth.toLocaleString('id-ID')} />
            <StatChip icon={<Crown size={16} color="#FF8A4C" />} label="Peringkat" value={exp.rank > 0 ? `#${exp.rank}` : '—'} />
          </div>
        </div>
      </div>

      {/* ── DAILY GRIND (kuis harian) + KUDOS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <DailyGrind quiz={quiz} isAdmin={isQuizAdmin} questions={quizQuestions} readOnly={me.role === 'spectator'} />
        <KudosPanel status={kudos} teammates={teammates} readOnly={me.role === 'spectator'} />
      </div>

      {/* ── LOOT VAULT ── */}
      <LootVault rewards={rewards} isAdmin={isAdmin} adminClaims={adminClaims} adminCatalog={adminCatalog} currentMonth={currentMonth} readOnly={me.role === 'spectator'} />

      {/* ── BADGES ── */}
      <Panel title="Koleksi Badge" subtitle={`${badges.filter(b => b.earned).length}/${badges.length} terbuka · streak terpanjang ${streak.longestStreak} hari`} icon={<Medal size={15} color="#F5C451" />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {badges.map(b => (
            <div key={b.id} title={b.description ?? ''} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12,
              background: b.earned ? 'radial-gradient(120% 120% at 0% 0%, rgba(245,196,81,0.12) 0%, rgba(16,20,29,0) 55%), #10141d' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${b.earned ? 'rgba(245,196,81,0.3)' : 'rgba(255,255,255,0.06)'}`,
              boxShadow: b.earned ? '0 0 18px rgba(245,196,81,0.12)' : 'none',
            }}>
              <span style={{ fontSize: 24, flexShrink: 0, filter: b.earned ? 'none' : 'grayscale(1)', opacity: b.earned ? 1 : 0.4 }}>{b.icon ?? '🏅'}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: b.earned ? '#EDF0F5' : '#6B7385', fontFamily: "'Space Grotesk',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
                <div style={{ fontSize: 10, color: b.earned ? '#F5C451' : '#4a5160', fontFamily: "'IBM Plex Mono',monospace", display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                  {b.earned ? <><Sparkles size={9} /> Terbuka</> : <><Lock size={9} /> Terkunci</>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── DIVISI WAR ── */}
      <DivisionWar data={divisionWar} />

      {/* ── LEADERBOARD + QUEST LOG ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* EXP Leaderboard */}
        <Panel title="EXP Leaderboard" subtitle="Top 10 · sepanjang waktu" icon={<Trophy size={15} color="#F5C451" />}>
          {leaderboard.length === 0 ? (
            <Empty>Belum ada EXP terkumpul. Selesaikan task pertamamu! ⚡</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {leaderboard.map((u, i) => {
                const isMe = u.fullName === me.fullName
                return (
                  <div key={u.userId} style={{
                    display: 'grid', gridTemplateColumns: '34px 1fr auto', alignItems: 'center', gap: 10,
                    padding: '9px 10px', borderRadius: 12,
                    background: isMe ? 'rgba(255,106,26,0.08)' : 'transparent',
                    border: isMe ? '1px solid rgba(255,106,26,0.25)' : '1px solid transparent',
                  }}>
                    <div style={{ fontSize: i < 3 ? 18 : 13, fontWeight: 800, textAlign: 'center', color: i < 3 ? RANK_COLOR[i] : '#6B7385', fontFamily: "'Space Grotesk',sans-serif" }}>
                      {i < 3 ? MEDAL[i] : i + 1}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                      <Avatar name={u.fullName} imageUrl={u.avatarUrl ?? undefined} size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#EDF0F5', fontFamily: "'Space Grotesk',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.fullName}{isMe && <span style={{ color: '#FF8A4C', fontSize: 11 }}> · kamu</span>}
                        </div>
                        <div style={{ fontSize: 10, color: '#6B7385', fontFamily: "'IBM Plex Mono',monospace" }}>{u.divisionName ?? '—'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 14, color: i < 3 ? RANK_COLOR[i] : '#A5AEC0' }}>
                      <Zap size={13} color={i < 3 ? RANK_COLOR[i] : '#6B7385'} /> {u.exp.toLocaleString('id-ID')}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        {/* Quest Log */}
        <Panel title="Quest Log" subtitle="Task harian yang menghasilkan EXP" icon={<CheckSquare size={15} color="#4A9EFF" />}>
          {quests.length === 0 ? (
            <Empty>Tidak ada quest aktif. Semua beres! 🎉</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {quests.map(q => {
                const due = dueLabel(q.dueDate, q.isOverdue)
                return (
                  <Link key={q.id} href="/tasks" style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none',
                  }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: 'rgba(74,158,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckSquare size={15} color="#4A9EFF" />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#EDF0F5', fontFamily: "'Space Grotesk',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        {q.projectName && <span style={{ fontSize: 10, color: '#6B7385', display: 'inline-flex', alignItems: 'center', gap: 3 }}><FolderKanban size={10} /> {q.projectName}</span>}
                        <span style={{ fontSize: 10, color: due.color, display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: "'IBM Plex Mono',monospace" }}><Clock size={10} /> {due.txt}</span>
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#3FD08A', background: 'rgba(63,208,138,0.12)', padding: '3px 9px', borderRadius: 100, fontFamily: "'Space Grotesk',sans-serif" }}>+20 EXP</span>
                  </Link>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── EXP TREND ── */}
      <Panel title="Tren EXP · 14 Hari" subtitle="EXP yang kamu kumpulkan per hari" icon={<Flame size={15} color="#FF6A1A" />}>
        {trend.length === 0 ? (
          <Empty>Belum ada EXP 14 hari terakhir. Ayo mulai grinding! 🔥</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6A1A" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#FF6A1A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#6B7385', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7385', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#94A3B8' }} itemStyle={{ color: '#FF8A4C' }}
                formatter={(v: any) => [`${v} EXP`, 'EXP']}
              />
              <Area type="monotone" dataKey="exp" name="EXP" stroke="#FF6A1A" strokeWidth={2.5} fill="url(#expGrad)" dot={{ fill: '#FF6A1A', r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* ── RECENT ACTIVITY ── */}
      <Panel title="Riwayat EXP" subtitle="Aktivitas terakhirmu" icon={<Zap size={15} color="#F5C451" />}>
        {activity.length === 0 ? (
          <Empty>Belum ada aktivitas EXP.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activity.map(a => {
              const meta = SOURCE_META[a.sourceType] ?? { icon: '⭐', label: a.sourceType }
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: '#EDF0F5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.reason ?? meta.label}</div>
                    <div style={{ fontSize: 10, color: '#6B7385', fontFamily: "'IBM Plex Mono',monospace" }}>{fmtDate(a.createdAt)}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontWeight: 800, fontSize: 13, color: a.points >= 0 ? '#3FD08A' : '#FF6B6B', fontFamily: "'Space Grotesk',sans-serif" }}>
                    {a.points >= 0 ? '+' : ''}{a.points}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}

/* ═══════════════════ SMALL PARTS ═══════════════════ */
function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '10px 14px', minWidth: 110 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#6B7385', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icon} {label}
      </div>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 20, color: '#EDF0F5', marginTop: 3 }}>{value}</div>
    </div>
  )
}

function Panel({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: '#161a23', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        {icon}
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: '#EDF0F5' }}>{title}</span>
      </div>
      <p style={{ fontSize: 11, color: '#6B7385', marginBottom: 14 }}>{subtitle}</p>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: 'center', color: '#6B7385', fontSize: 13, padding: '28px 0' }}>{children}</div>
}
