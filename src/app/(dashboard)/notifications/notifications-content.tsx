'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Bell, CheckCheck, CheckSquare, FolderKanban, ClipboardCheck,
  Target, AlertCircle, Star, FileText, Calendar, Users, Megaphone, X
} from 'lucide-react'

interface Notification {
  id: string; title: string; message: string; type: string
  relatedEntityType: string | null; relatedEntityId: string | null
  isRead: boolean; createdAt: string
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string; link?: string }> = {
  task_assigned:       { icon: <CheckSquare size={14}/>, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  label: 'Task',      link: '/tasks'        },
  deadline:            { icon: <AlertCircle size={14}/>, color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   label: 'Deadline'                          },
  overdue:             { icon: <AlertCircle size={14}/>, color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   label: 'Overdue'                           },
  approval_request:    { icon: <ClipboardCheck size={14}/>, color:'#7C3AED', bg:'rgba(124,58,237,0.12)', label: 'Approval',  link: '/approvals'    },
  approval_result:     { icon: <ClipboardCheck size={14}/>, color:'#10B981', bg:'rgba(16,185,129,0.12)', label: 'Approval'                          },
  mention:             { icon: <Megaphone size={14}/>,    color: 'var(--blue)', bg: 'rgba(74,158,255,0.12)', label: 'Mention'                           },
  kpi_reminder:        { icon: <Target size={14}/>,       color: '#FF8A4C', bg: 'rgba(255,106,26,0.12)', label: 'KPI',       link: '/kpi'           },
  asset_new:           { icon: <FileText size={14}/>,     color: '#A855F7', bg: 'rgba(168,85,247,0.12)', label: 'Asset',     link: '/assets'       },
  project_done:        { icon: <FolderKanban size={14}/>, color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Project'                           },
  revision_requested:  { icon: <ClipboardCheck size={14}/>, color:'#F59E0B', bg:'rgba(245,158,11,0.12)', label: 'Revision',  link: '/approvals'    },
  budget_exceeded:     { icon: <AlertCircle size={14}/>, color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   label: 'Budget',    link: '/budget'       },
  event_assigned:      { icon: <Calendar size={14}/>,    color: 'var(--blue)', bg: 'rgba(74,158,255,0.12)', label: 'Event',     link: '/events'       },
  gamification:        { icon: <Star size={14}/>,         color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Reward',    link: '/leaderboard'  },
}

const DEFAULT_TYPE = { icon: <Bell size={14}/>, color: 'var(--text-muted)', bg: 'rgba(107,115,133,0.12)', label: 'Info' }

function fmtAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function groupByDate(notifs: Notification[]) {
  const now = new Date(); now.setHours(0,0,0,0)
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate()-1)
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate()-7)

  const groups: { label: string; items: Notification[] }[] = [
    { label: 'Hari ini', items: [] },
    { label: 'Kemarin', items: [] },
    { label: 'Minggu ini', items: [] },
    { label: 'Lebih lama', items: [] },
  ]

  for (const n of notifs) {
    const d = new Date(n.createdAt); d.setHours(0,0,0,0)
    if (d.getTime() === now.getTime()) groups[0].items.push(n)
    else if (d.getTime() === yesterday.getTime()) groups[1].items.push(n)
    else if (d >= weekAgo) groups[2].items.push(n)
    else groups[3].items.push(n)
  }
  return groups.filter(g => g.items.length > 0)
}

export function NotificationsContent({ notifications: init }: { notifications: Notification[] }) {
  const [notifs, setNotifs]       = useState(init)
  const [typeFilter, setTypeFilter] = useState('Semua')
  const [showUnread, setShowUnread] = useState(false)

  const unreadCount = notifs.filter(n => !n.isRead).length

  const filtered = notifs.filter(n => {
    const matchType   = typeFilter === 'Semua' || (TYPE_CONFIG[n.type]?.label ?? 'Info') === typeFilter
    const matchUnread = !showUnread || !n.isRead
    return matchType && matchUnread
  })

  const groups = groupByDate(filtered)

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const typeLabels = [...new Set(Object.values(TYPE_CONFIG).map(c => c.label)), 'Info']

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-grotesk font-bold text-2xl text-[var(--text-primary)]">Notifikasi</h1>
            {unreadCount > 0 && (
              <span style={{ background: '#EF4444', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', fontFamily: "'IBM Plex Mono', monospace" }}>
                {unreadCount} baru
              </span>
            )}
          </div>
          <p className="text-[var(--text-muted)] text-sm mt-1">{notifs.length} total notifikasi</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '10px', padding: '8px 16px', cursor: 'pointer', color: '#4ADE80', fontSize: '13px', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
            <CheckCheck size={14}/> Tandai semua dibaca
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2 flex-wrap">
          {['Semua', ...typeLabels].filter((v,i,a) => a.indexOf(v)===i).slice(0,8).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{ padding: '5px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${typeFilter===t ? 'rgba(255,106,26,0.4)' : 'var(--border)'}`, background: typeFilter===t ? 'rgba(255,106,26,0.12)' : 'transparent', color: typeFilter===t ? '#FF8A4C' : 'var(--text-muted)' }}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => setShowUnread(p => !p)}
          style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${showUnread ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`, background: showUnread ? 'rgba(239,68,68,0.1)' : 'transparent', color: showUnread ? 'var(--red)' : 'var(--text-muted)' }}>
          {showUnread ? '● Belum dibaca' : '○ Belum dibaca'}
        </button>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
          <Bell size={36} style={{ color: 'var(--text-faint)', margin: '0 auto 12px' }}/>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Tidak ada notifikasi</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.label}>
              <p style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px', paddingLeft: '4px' }}>
                {group.label}
              </p>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
                {group.items.map((n, i) => {
                  const cfg = TYPE_CONFIG[n.type] ?? DEFAULT_TYPE
                  const intLink = cfg.link ?? (
                    n.relatedEntityType === 'project' ? `/projects/${n.relatedEntityId}` :
                    n.relatedEntityType === 'task' ? '/tasks' :
                    n.relatedEntityType === 'approval' ? '/approvals' : null
                  )
                  return (
                    <div key={n.id}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', borderBottom: i < group.items.length-1 ? '1px solid var(--surface-hover)' : 'none', background: n.isRead ? 'transparent' : 'rgba(255,106,26,0.03)', transition: 'background 0.1s', cursor: 'pointer' }}
                      onClick={() => { if (!n.isRead) markRead(n.id) }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-subtle)'}
                      onMouseLeave={e => e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(255,106,26,0.03)'}>

                      {/* Type icon */}
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>
                        {cfg.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: n.isRead ? 500 : 700, color: n.isRead ? 'var(--text-secondary)' : 'var(--text-primary)', marginBottom: '2px' }}>{n.title}</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{n.message}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {!n.isRead && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#FF6A1A', flexShrink: 0 }}/>}
                            <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: "'IBM Plex Mono', monospace", whiteSpace: 'nowrap' }}>{fmtAge(n.createdAt)}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                          <span style={{ fontSize: '10px', background: cfg.bg, color: cfg.color, padding: '1px 8px', borderRadius: '100px', fontWeight: 600 }}>{cfg.label}</span>
                          {intLink && (
                            <Link href={intLink} onClick={e => e.stopPropagation()}
                              style={{ fontSize: '11px', color: 'var(--blue)', textDecoration: 'none', fontWeight: 600 }}>
                              Lihat →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
