'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import { Avatar } from '@/components/ui/avatar'
import { Heart, Send, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { KudosStatus, KudosFeedItem } from '@/lib/kudos'

interface Teammate { id: string; fullName: string; avatarUrl: string | null; divisionName: string | null }

export function KudosPanel({ status, teammates, readOnly }: { status: KudosStatus; teammates: Teammate[]; readOnly?: boolean }) {
  const router = useRouter()
  const [recipientId, setRecipientId] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const noQuota = status.remaining <= 0

  async function send() {
    if (!recipientId || busy) return
    setBusy(true); setErr(null); setOkMsg(null)
    try {
      const res = await fetch('/api/kudos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId, message }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Gagal mengirim kudos.'); return }
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.4 }, colors: ['#FF6A8A', '#F5C451', '#A78BFA'] })
      setOkMsg(`Kudos terkirim ke ${data.recipientName}! 🎉`)
      setRecipientId(''); setMessage('')
      router.refresh()
    } catch {
      setErr('Terjadi kesalahan jaringan.')
    } finally {
      setBusy(false)
    }
  }

  const input: React.CSSProperties = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 9, padding: '9px 11px',
    color: 'var(--text-primary)', fontSize: 13, width: '100%', fontFamily: "'Space Grotesk',sans-serif",
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,106,138,0.18)', borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <Heart size={15} color="#FF6A8A" />
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Kudos</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: noQuota ? 'var(--text-muted)' : 'var(--pink)', background: noQuota ? 'var(--surface-hover)' : 'rgba(255,106,138,0.12)', padding: '3px 9px', borderRadius: 100 }}>
          {status.remaining}/{status.cap} tersisa
        </span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Apresiasi rekanmu — beri +{status.pointsPerKudos} EXP 💌</p>

      {err && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: 'var(--red)', fontSize: 12, padding: '8px 12px', borderRadius: 10, marginBottom: 10 }}>{err}</div>}
      {okMsg && <div style={{ background: 'rgba(63,208,138,0.1)', border: '1px solid rgba(63,208,138,0.3)', color: 'var(--green)', fontSize: 12, padding: '8px 12px', borderRadius: 10, marginBottom: 10 }}>{okMsg}</div>}

      {readOnly ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, padding: '12px 0', background: 'var(--surface-subtle)', borderRadius: 10, marginBottom: 14 }}>
          👁️ Mode spectator: lihat saja, tidak bisa kirim kudos.
        </div>
      ) : noQuota ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, padding: '12px 0', background: 'var(--surface-subtle)', borderRadius: 10, marginBottom: 14 }}>
          Kuota kudos harianmu sudah habis. Kembali besok ya! 🌙
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <select style={{ ...input, cursor: 'pointer' }} value={recipientId} onChange={e => setRecipientId(e.target.value)}>
            <option value="">— Pilih rekan —</option>
            {teammates.map(t => (
              <option key={t.id} value={t.id}>{t.fullName}{t.divisionName ? ` · ${t.divisionName}` : ''}</option>
            ))}
          </select>
          <input style={input} placeholder="Pesan apresiasi (opsional)" maxLength={160} value={message} onChange={e => setMessage(e.target.value)} />
          <button onClick={send} disabled={!recipientId || busy}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '9px 0', borderRadius: 10, border: 'none',
              fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 13, cursor: !recipientId ? 'not-allowed' : 'pointer',
              background: !recipientId ? 'var(--border)' : 'linear-gradient(90deg,#FF6A8A,var(--pink))',
              color: !recipientId ? 'var(--text-muted)' : '#fff', opacity: busy ? 0.6 : 1,
              boxShadow: !recipientId ? 'none' : '0 0 18px rgba(255,106,138,0.4)',
            }}>
            <Send size={14} /> {busy ? 'Mengirim…' : 'Kirim Kudos'}
          </button>
        </div>
      )}

      {/* Feed */}
      {(status.received.length > 0 || status.given.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {status.received.length > 0 && (
            <KudosFeed label="Diterima" icon={<ArrowDownLeft size={12} color="var(--green)" />} items={status.received} positive />
          )}
          {status.given.length > 0 && (
            <KudosFeed label="Diberikan" icon={<ArrowUpRight size={12} color="var(--pink)" />} items={status.given} />
          )}
        </div>
      )}
    </div>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
}

function KudosFeed({ label, icon, items, positive }: { label: string; icon: React.ReactNode; items: KudosFeedItem[]; positive?: boolean }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {icon} {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(k => (
          <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 10, background: 'var(--surface-subtle)' }}>
            <Avatar name={k.otherName} imageUrl={k.otherAvatar ?? undefined} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: "'Space Grotesk',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.otherName}</div>
              {k.message && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.message}</div>}
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              {positive && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--green)', fontFamily: "'Space Grotesk',sans-serif" }}>+{k.points}</span>}
              <div style={{ fontSize: 9.5, color: 'var(--text-faint)', fontFamily: "'IBM Plex Mono',monospace" }}>{fmtDate(k.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
