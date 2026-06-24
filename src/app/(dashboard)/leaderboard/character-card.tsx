'use client'

import { X } from 'lucide-react'
import { levelProgress } from '@/lib/level'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/roles'

interface BadgeLite { badgeName: string | null; badgeIcon: string | null; badgeId: string | null }
export interface CharacterUser {
  id: string; fullName: string; avatarUrl: string | null; bio: string | null
  role: string; divisionName: string | null; rank: number
  badges: BadgeLite[]
}

// Ikon + label per sumber EXP (selaras dengan Arena SOURCE_META).
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

// Warna per tier — makin tinggi makin "mewah".
const TIER_COLOR: Record<string, string> = {
  Rookie: '#8B93A6', Grinder: '#3FD08A', Hustler: '#4A9EFF',
  Veteran: '#A78BFA', Elite: '#FF8A4C', Legend: '#F5C451',
}
const MEDAL = ['', '🥇', '🥈', '🥉']

export function CharacterCard({ user, expBySource, mood, onClose }: {
  user: CharacterUser
  expBySource: Record<string, number>
  mood?: { emoji: string; label: string } | null
  onClose: () => void
}) {
  const total = Object.values(expBySource).reduce((a, b) => a + b, 0)
  const lvl = levelProgress(total)
  const tierColor = TIER_COLOR[lvl.title] ?? '#8B93A6'
  const earned = user.badges.filter(b => b.badgeId)
  const sources = Object.entries(expBySource)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  const maxSource = Math.max(1, ...sources.map(([, v]) => v))
  const roleColor = ROLE_COLORS[user.role] ?? '#8B93A6'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 py-8"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-2xl overflow-hidden animate-fade-in"
        style={{ background: 'var(--bg-elevated)', border: `1px solid ${tierColor}55`, boxShadow: `0 24px 60px -20px ${tierColor}66` }}
        onClick={e => e.stopPropagation()}>

        {/* ── HERO ── */}
        <div style={{ position: 'relative', padding: '26px 24px 20px', textAlign: 'center',
          background: `radial-gradient(120% 130% at 50% -10%, ${tierColor}33 0%, transparent 60%), var(--bg-card)` }}>
          <button onClick={onClose} aria-label="Tutup"
            style={{ position: 'absolute', top: 14, right: 14, color: 'var(--text-muted)', background: 'var(--surface-hover)', border: 'none', borderRadius: 8, padding: 5, cursor: 'pointer', display: 'flex' }}>
            <X size={16} />
          </button>

          {/* Rank ribbon */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: tierColor, background: `${tierColor}1F`, border: `1px solid ${tierColor}55`, borderRadius: 100, padding: '3px 11px', marginBottom: 14, fontFamily: "'IBM Plex Mono',monospace" }}>
            {user.rank <= 3 ? MEDAL[user.rank] : ''} PERINGKAT #{user.rank}
          </div>

          {/* Avatar + tier ring */}
          <div style={{ width: 96, height: 96, margin: '0 auto', borderRadius: '50%', padding: 3,
            background: `conic-gradient(from 180deg, ${tierColor}, #FF6A1A, ${tierColor})`, boxShadow: `0 0 26px ${tierColor}77` }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt={user.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 34, fontWeight: 800, color: tierColor, fontFamily: "'Space Grotesk',sans-serif" }}>{user.fullName.charAt(0)}</span>}
            </div>
          </div>

          {/* Level badge overlapping */}
          <div style={{ marginTop: -16, display: 'inline-flex', alignItems: 'center', gap: 6, background: tierColor, color: '#0C0F16', borderRadius: 100, padding: '3px 12px', fontWeight: 800, fontSize: 12, fontFamily: "'Space Grotesk',sans-serif", border: '2px solid var(--bg-elevated)' }}>
            LV {lvl.level} · {lvl.title}
          </div>

          <h2 style={{ marginTop: 12, fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Space Grotesk',sans-serif" }}>{user.fullName}</h2>
          <div style={{ marginTop: 6, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: roleColor, background: `${roleColor}1F`, borderRadius: 100, padding: '2px 9px' }}>{ROLE_LABELS[user.role] ?? user.role}</span>
            {user.divisionName && <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', background: 'var(--surface-hover)', borderRadius: 100, padding: '2px 9px' }}>{user.divisionName}</span>}
            {mood && <span title="Mood terakhir" style={{ fontSize: 10.5, color: 'var(--text-secondary)', background: 'var(--surface-hover)', borderRadius: 100, padding: '2px 9px' }}>{mood.emoji} {mood.label}</span>}
          </div>
          {user.bio && (
            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, fontStyle: 'italic', maxWidth: 320, marginInline: 'auto' }}>“{user.bio}”</p>
          )}
        </div>

        {/* ── LEVEL PROGRESS ── */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Space Grotesk',sans-serif" }}>{total.toLocaleString('id-ID')} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>EXP total</span></span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono',monospace" }}>{lvl.pct}% → LV {lvl.level + 1}</span>
          </div>
          <div style={{ height: 9, borderRadius: 100, background: 'var(--surface-hover)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(3, lvl.pct)}%`, borderRadius: 100, background: `linear-gradient(90deg, ${tierColor}, #FF8A4C)`, boxShadow: `0 0 10px ${tierColor}99`, transition: 'width 0.5s ease' }} />
          </div>
          <p style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 5, fontFamily: "'IBM Plex Mono',monospace" }}>{lvl.intoLevel.toLocaleString('id-ID')} / {lvl.span.toLocaleString('id-ID')} EXP di level ini</p>
        </div>

        {/* ── BADGES ── */}
        <div style={{ padding: '4px 24px 16px' }}>
          <SectionLabel text={`Badge (${earned.length})`} />
          {earned.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>Belum punya badge. Terus grinding! ⚔️</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {earned.map((b, i) => (
                <span key={i} title={b.badgeName ?? ''}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-secondary)', background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 100, padding: '4px 10px' }}>
                  <span style={{ fontSize: 14 }}>{b.badgeIcon ?? '🏅'}</span> {b.badgeName}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── EXP BREAKDOWN ── */}
        <div style={{ padding: '4px 24px 22px' }}>
          <SectionLabel text="Sumber EXP" />
          {sources.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>Belum ada EXP terkumpul.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {sources.map(([src, val]) => {
                const meta = SOURCE_META[src] ?? { icon: '•', label: src }
                return (
                  <div key={src}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, width: 18, textAlign: 'center' }}>{meta.icon}</span>
                      <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-secondary)' }}>{meta.label}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Space Grotesk',sans-serif" }}>{val.toLocaleString('id-ID')}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 100, background: 'var(--surface-hover)', overflow: 'hidden', marginLeft: 25 }}>
                      <div style={{ height: '100%', width: `${Math.max(3, (val / maxSource) * 100)}%`, borderRadius: 100, background: tierColor, opacity: 0.85 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.06em', margin: '8px 0 9px' }}>{text}</div>
  )
}
