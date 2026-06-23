'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, RotateCcw, Clock, ChevronRight, AlertTriangle, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Step { stepOrder: number; role: string; action: string; note: string | null; actedAt: string | null }
interface ApprovalItem {
  id: string; status: string; currentStep: number; createdAt: string; requesterName: string | null
  canActNow: boolean
  project: { id: string; name: string | null; code: string | null; priority: string | null; deadline: string | null }
  steps: Step[]
}

interface Props {
  pendingForMe: ApprovalItem[]
  others: ApprovalItem[]
  currentUser: { id: string; role: string; step: number }
}

const STEP_ROLE_LABEL: Record<string, string> = {
  spv: 'Leader Divisi', manager: 'Manager', director: 'Direktur',
}
const ACTION_COLOR: Record<string, string> = {
  pending: 'var(--text-muted)', approve: '#4ADE80', reject: 'var(--red)', revision: '#F59E0B',
}
const ACTION_LABEL: Record<string, string> = {
  pending: 'Menunggu', approve: 'Disetujui', reject: 'Ditolak', revision: 'Perlu Revisi',
}
const PRIORITY_COLOR: Record<string, string> = {
  Low: 'var(--text-muted)', Medium: 'var(--blue)', High: '#F59E0B', Urgent: 'var(--red)',
}

export function ApprovalsContent({ pendingForMe, others, currentUser }: Props) {
  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const router = useRouter()

  const list = tab === 'pending' ? pendingForMe : others

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-grotesk font-bold text-2xl text-[var(--text-primary)]">Approvals</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Kelola persetujuan project yang membutuhkan tindakanmu</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
        {[
          { key: 'pending', label: `Perlu Aksi${pendingForMe.length > 0 ? ` (${pendingForMe.length})` : ''}` },
          { key: 'history', label: 'Semua' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{
              background: tab === t.key ? '#FF6A1A' : 'transparent',
              color: tab === t.key ? 'var(--on-accent)' : 'var(--text-muted)',
              border: 'none', borderRadius: '9px', padding: '7px 18px',
              cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600, fontSize: '13px', transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {list.length === 0 && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
          <CheckCircle size={40} style={{ color: '#4ADE80', margin: '0 auto 12px' }} />
          <p className="font-grotesk font-bold text-[var(--text-primary)] text-[15px]">
            {tab === 'pending' ? 'Tidak ada approval yang perlu ditindaklanjuti' : 'Belum ada data approval'}
          </p>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {list.map(item => (
          <ApprovalCard key={item.id} item={item} currentUser={currentUser} onAction={() => router.refresh()} />
        ))}
      </div>
    </div>
  )
}

function ApprovalCard({ item, currentUser, onAction }: { item: ApprovalItem; currentUser: { id: string; role: string; step: number }; onAction: () => void }) {
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'revision' | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Hapus approval ini secara permanen? Tindakan ini tidak bisa dibatalkan.')) return
    const res = await fetch(`/api/approvals/${item.id}`, { method: 'DELETE' })
    if (res.ok) { onAction() }
    else { const d = await res.json(); alert(d.error ?? 'Gagal menghapus approval') }
  }

  async function submitAction(action: 'approve' | 'reject' | 'revision') {
    if ((action === 'reject' || action === 'revision') && !note.trim()) {
      alert('Harap isi catatan untuk penolakan atau revisi'); return
    }
    setLoading(true)
    const res = await fetch(`/api/approvals/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    })
    setLoading(false)
    if (res.ok) { setShowNote(false); setNote(''); setActionType(null); onAction() }
  }

  const isRejected = item.status === 'Rejected'
  const isApproved = item.status === 'Approved'

  return (
    <div style={{ background: 'var(--bg-elevated)', border: `1px solid ${item.canActNow ? 'rgba(255,106,26,0.3)' : 'var(--border)'}`, borderRadius: '16px', overflow: 'hidden' }}>
      {/* Card header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          {item.canActNow && (
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF6A1A', flexShrink: 0 }} className="animate-pulse-dot" />
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <p className="font-grotesk font-bold text-[var(--text-primary)] text-[14px]">{item.project.name ?? '—'}</p>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>{item.project.code}</span>
              {item.project.priority && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: PRIORITY_COLOR[item.project.priority], background: `${PRIORITY_COLOR[item.project.priority]}18`, padding: '2px 8px', borderRadius: '100px' }}>
                  {item.project.priority}
                </span>
              )}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Diajukan oleh <span style={{ color: 'var(--text-secondary)' }}>{item.requesterName ?? '—'}</span>
              {item.project.deadline && <> · Deadline: <span style={{ color: 'var(--text-secondary)' }}>{formatDate(item.project.deadline)}</span></>}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: isApproved ? '#4ADE80' : isRejected ? 'var(--red)' : '#F59E0B', background: isApproved ? 'rgba(74,222,128,0.1)' : isRejected ? 'rgba(255,107,107,0.1)' : 'rgba(245,158,11,0.1)', padding: '4px 12px', borderRadius: '100px' }}>
            {isApproved ? 'Disetujui' : isRejected ? 'Ditolak' : `Step ${item.currentStep}/3`}
          </span>
          <button onClick={() => router.push(`/projects/${item.project.id}`)}
            style={{ background: 'var(--border)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            Detail <ChevronRight size={12} />
          </button>
          {currentUser.role === 'super_admin' && (
            <button onClick={handleDelete} title="Hapus approval ini"
              style={{ background: 'rgba(255,107,107,0.08)', border: 'none', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center' }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Approval steps timeline */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: '8px' }}>
        {item.steps.map((step, i) => {
          const color = ACTION_COLOR[step.action] ?? 'var(--text-muted)'
          return (
            <div key={i} style={{ flex: 1, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: `${color}22`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {step.action === 'approve' ? <CheckCircle size={11} style={{ color }} /> :
                    step.action === 'reject' ? <XCircle size={11} style={{ color }} /> :
                      step.action === 'revision' ? <RotateCcw size={11} style={{ color }} /> :
                        <Clock size={11} style={{ color }} />}
                </div>
                {i < item.steps.length - 1 && <div style={{ flex: 1, height: '1px', background: `${color}40` }} />}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>{STEP_ROLE_LABEL[step.role] ?? step.role}</p>
              <p style={{ fontSize: '11px', color, fontWeight: 600 }}>{ACTION_LABEL[step.action] ?? step.action}</p>
              {step.note && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>"{step.note}"</p>}
            </div>
          )
        })}
      </div>

      {/* Action buttons — hanya muncul jika giliran user ini */}
      {item.canActNow && !showNote && (
        <div style={{ padding: '12px 20px 16px', display: 'flex', gap: '8px', borderTop: '1px solid var(--surface-hover)' }}>
          <button onClick={() => submitAction('approve')} disabled={loading}
            style={{ flex: 2, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80', borderRadius: '10px', padding: '9px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <CheckCircle size={14} /> Setujui
          </button>
          <button onClick={() => { setActionType('revision'); setShowNote(true) }} disabled={loading}
            style={{ flex: 1, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B', borderRadius: '10px', padding: '9px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <RotateCcw size={13} /> Revisi
          </button>
          <button onClick={() => { setActionType('reject'); setShowNote(true) }} disabled={loading}
            style={{ flex: 1, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: 'var(--red)', borderRadius: '10px', padding: '9px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <XCircle size={13} /> Tolak
          </button>
        </div>
      )}

      {/* Note form */}
      {showNote && (
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--surface-hover)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <AlertTriangle size={13} style={{ color: actionType === 'reject' ? 'var(--red)' : '#F59E0B' }} />
            <p style={{ fontSize: '13px', fontWeight: 600, color: actionType === 'reject' ? 'var(--red)' : '#F59E0B' }}>
              {actionType === 'reject' ? 'Alasan penolakan' : 'Catatan revisi'} (wajib)
            </p>
          </div>
          <textarea
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Jelaskan alasan atau hal yang perlu diperbaiki..."
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', width: '100%', minHeight: '80px', resize: 'vertical', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={() => { setShowNote(false); setNote(''); setActionType(null) }}
              style={{ flex: 1, background: 'var(--border)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', borderRadius: '10px', padding: '8px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px' }}>
              Batal
            </button>
            <button onClick={() => actionType && submitAction(actionType)} disabled={loading}
              style={{ flex: 2, background: actionType === 'reject' ? 'rgba(255,107,107,0.2)' : 'rgba(245,158,11,0.2)', border: `1px solid ${actionType === 'reject' ? 'rgba(255,107,107,0.4)' : 'rgba(245,158,11,0.4)'}`, color: actionType === 'reject' ? 'var(--red)' : '#F59E0B', borderRadius: '10px', padding: '8px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '13px' }}>
              {loading ? 'Memproses...' : actionType === 'reject' ? 'Konfirmasi Tolak' : 'Konfirmasi Revisi'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
