'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Target, Info } from 'lucide-react'
import { canManageKpi, canBulkData } from '@/lib/roles'
import { ExcelToolbar } from '@/components/excel-toolbar'

interface KpiItem {
  id: string; kpiName: string; weight: string; target: string | null
  realization: string | null; maxScore: string; autoScore: string | null
  finalScore: string | null; evaluationNote: string | null
  improvementPlan: string | null; status: string; userId: string
}

interface RecapRow { userId: string; fullName: string; divisionName: string | null; count: number; totalWeight: number; totalFinal: number; status: string }
interface Props {
  kpiItems: KpiItem[]
  viewableUsers: { id: string; fullName: string; role: string; divisionId: string | null; divisionName: string | null }[]
  month: number; year: number
  targetUserId: string
  currentUser: { id: string; role: string }
  totalWeight: number; totalFinal: number
  canViewOthers: boolean
  recap?: RecapRow[]
}

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const STATUS_COLOR: Record<string, string> = { Draft: 'var(--text-muted)', Reviewed: 'var(--blue)', Final: '#4ADE80' }

const inputS: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '9px',
  padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', width: '100%',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
}
const labelS: React.CSSProperties = {
  fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace",
  letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '4px',
}

function calcAutoScore(target: string, realization: string, maxScore: string): number {
  const t = Number(target), r = Number(realization), m = Number(maxScore)
  if (!t || !m) return 0
  return Math.min(Math.round((r / t) * m * 100) / 100, m)
}

export function KpiContent({ kpiItems, viewableUsers, month, year, targetUserId, currentUser, totalWeight, totalFinal, canViewOthers, recap = [] }: Props) {
  const isAllMode = targetUserId === 'all'
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<KpiItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [metricModal, setMetricModal] = useState<null | 'kpi' | 'bobot' | 'skor' | 'status'>(null)

  // Hanya SPV ke atas yang bisa tambah/edit KPI (untuk anggotanya atau diri sendiri)
  const canEdit = canManageKpi(currentUser.role)
  const canFinalize = ['super_admin', 'spv_manager', 'head_director'].includes(currentUser.role)
  const allDraft = kpiItems.every(k => k.status === 'Draft')
  const anyFinal = kpiItems.some(k => k.status === 'Final')

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(params)
    startTransition(() => router.push(`/kpi?${sp.toString()}`))
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus KPI item ini?')) return
    await fetch(`/api/kpi/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  async function handleSubmitForReview() {
    setSaving(true)
    await fetch('/api/kpi/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, year }) })
    setSaving(false)
    router.refresh()
  }

  async function handleFinalize(id: string) {
    setSaving(true)
    await fetch(`/api/kpi/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Final' }) })
    setSaving(false)
    router.refresh()
  }

  const totalWeightPct = Math.round(totalWeight)
  const weightOk = Math.abs(totalWeightPct - 100) < 1
  const targetUser = viewableUsers.find(u => u.id === targetUserId)

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-[var(--text-primary)]">KPI Individu</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {isAllMode ? `Recap semua orang (${recap.length})` : targetUserId === currentUser.id ? 'KPI kamu' : `KPI ${targetUser?.fullName ?? '—'}`} · {MONTHS[month - 1]} {year}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Period picker */}
          <select value={month} onChange={e => navigate({ month: e.target.value, year: String(year), uid: targetUserId })}
            style={{ ...inputS, width: 'auto', padding: '8px 12px' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => navigate({ month: String(month), year: e.target.value, uid: targetUserId })}
            style={{ ...inputS, width: 'auto', padding: '8px 12px' }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* User picker (untuk manager/admin) — termasuk opsi "Semua Orang" (#9) */}
          {canViewOthers && viewableUsers.length > 0 && (
            <select value={targetUserId} onChange={e => navigate({ month: String(month), year: String(year), uid: e.target.value })}
              style={{ ...inputS, width: 'auto', padding: '8px 12px', maxWidth: '200px' }}>
              <option value="all">👥 Semua Orang</option>
              {viewableUsers.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          )}

          {!isAllMode && canEdit && !anyFinal && (
            <button onClick={() => { setEditItem(null); setShowForm(true) }}
              style={{ background: '#FF6A1A', color: 'var(--on-accent)', border: 'none', borderRadius: '10px', padding: '9px 16px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Plus size={14} /> Tambah KPI
            </button>
          )}
        </div>
      </div>

      {/* Excel import/export — SPV/Manager/Direktur */}
      {canBulkData(currentUser.role) && (
        <div className="flex justify-end">
          <ExcelToolbar type="kpi" label="KPI" />
        </div>
      )}

      {/* Recap mode (#9): tabel semua orang */}
      {isAllMode && <RecapTable recap={recap} onPick={uid => navigate({ month: String(month), year: String(year), uid })} />}

      {/* Stats — bisa diklik untuk rincian (#10) */}
      {!isAllMode && (<>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { key: 'kpi' as const, label: 'Total KPI', value: kpiItems.length, unit: 'item' },
          { key: 'bobot' as const, label: 'Total Bobot', value: `${totalWeightPct}%`, unit: '', warn: !weightOk && kpiItems.length > 0 },
          { key: 'skor' as const, label: 'Skor Akhir', value: totalFinal.toFixed(1), unit: 'poin' },
          { key: 'status' as const, label: 'Status', value: anyFinal ? 'Final' : kpiItems.some(k => k.status === 'Reviewed') ? 'Reviewed' : 'Draft', unit: '' },
        ]).map(s => (
          <button key={s.label} onClick={() => kpiItems.length > 0 && setMetricModal(s.key)} disabled={kpiItems.length === 0}
            style={{ textAlign: 'left', background: 'var(--bg-elevated)', border: `1px solid ${s.warn ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`, borderRadius: '14px', padding: '16px 18px', cursor: kpiItems.length > 0 ? 'pointer' : 'default', transition: 'border-color 0.15s' }}
            onMouseEnter={e => { if (kpiItems.length > 0) e.currentTarget.style.borderColor = 'rgba(255,106,26,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = s.warn ? 'rgba(245,158,11,0.4)' : 'var(--border)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>{s.label}</p>
            <p className="font-grotesk font-bold text-2xl" style={{ color: s.warn ? '#F59E0B' : 'var(--text-primary)' }}>{s.value}</p>
            {s.unit && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.unit}</p>}
          </button>
        ))}
      </div>

      {/* Weight warning */}
      {!weightOk && kpiItems.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Info size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />
          <p style={{ fontSize: '13px', color: '#F59E0B' }}>Total bobot harus 100%. Saat ini {totalWeightPct}%. Sesuaikan bobot tiap KPI.</p>
        </div>
      )}

      {/* KPI Table */}
      {kpiItems.length === 0 ? (
        <div style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
          <Target size={36} style={{ color: 'var(--text-faint)', margin: '0 auto 12px' }} />
          <p className="font-grotesk font-bold text-[var(--text-muted)]">Belum ada KPI untuk periode ini</p>
          {canEdit && <p style={{ fontSize: '13px', color: 'var(--text-faint)', marginTop: '6px' }}>Klik "+ Tambah KPI" untuk mulai mengisi</p>}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-subtle)' }}>
                  {['KPI / Indikator', 'Bobot', 'Target', 'Realisasi', 'Skor Auto', 'Skor Final', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kpiItems.map(item => {
                  const auto = item.autoScore ? Number(item.autoScore) : (item.realization && item.target ? calcAutoScore(item.target, item.realization, item.maxScore) : null)
                  const final = item.finalScore ? Number(item.finalScore) : auto
                  const pct = item.target && item.realization ? Math.round((Number(item.realization) / Number(item.target)) * 100) : null

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--surface-hover)' }}>
                      <td style={{ padding: '12px 14px', maxWidth: '220px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.kpiName}</p>
                        {item.evaluationNote && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>"{item.evaluationNote}"</p>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#FF8A4C' }}>{Number(item.weight)}%</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {item.target ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: pct !== null ? (pct >= 100 ? '#4ADE80' : pct >= 80 ? '#F59E0B' : 'var(--red)') : 'var(--text-muted)' }}>
                            {item.realization ?? '—'}
                          </span>
                          {pct !== null && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>({pct}%)</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {auto !== null ? auto.toFixed(1) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {final !== null ? final.toFixed(1) : '—'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/{Number(item.maxScore)}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: STATUS_COLOR[item.status], background: `${STATUS_COLOR[item.status]}18`, padding: '3px 9px', borderRadius: '100px' }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {canEdit && item.status === 'Draft' && (
                            <>
                              <button onClick={() => { setEditItem(item); setShowForm(true) }}
                                style={{ background: 'var(--border)', border: 'none', borderRadius: '7px', padding: '5px 7px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => handleDelete(item.id)}
                                style={{ background: 'rgba(255,107,107,0.08)', border: 'none', borderRadius: '7px', padding: '5px 7px', cursor: 'pointer', color: 'var(--red)', display: 'flex' }}>
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                          {canFinalize && item.status === 'Reviewed' && (
                            <button onClick={() => handleFinalize(item.id)} disabled={saving}
                              style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '7px', padding: '5px 9px', cursor: 'pointer', color: '#4ADE80', fontSize: '11px', fontWeight: 600 }}>
                              Final
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Total row */}
              <tfoot>
                <tr style={{ background: 'var(--surface-subtle)', borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>TOTAL</td>
                  <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 700, color: weightOk ? '#4ADE80' : '#F59E0B' }}>{totalWeightPct}%</td>
                  <td colSpan={3} />
                  <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 700, color: '#FF6A1A' }}>{totalFinal.toFixed(1)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      {kpiItems.length > 0 && canEdit && allDraft && weightOk && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <p className="font-grotesk font-bold text-[14px] text-[var(--text-primary)]">Kirim KPI untuk Review</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Semua item akan berubah status menjadi "Reviewed" dan dikirim ke Manager untuk evaluasi</p>
          </div>
          <button onClick={handleSubmitForReview} disabled={saving}
            style={{ background: '#FF6A1A', border: 'none', color: 'var(--on-accent)', borderRadius: '10px', padding: '10px 20px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap' }}>
            {saving ? 'Mengirim...' : 'Kirim untuk Review →'}
          </button>
        </div>
      )}
      </>)}

      {/* Form Modal */}
      {showForm && (
        <KpiFormModal
          item={editItem}
          month={month} year={year} targetUserId={targetUserId}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          onSaved={() => { setShowForm(false); setEditItem(null); router.refresh() }}
        />
      )}

      {/* Metric detail modal (#10) */}
      {metricModal && (
        <KpiMetricModal kind={metricModal} items={kpiItems} totalWeightPct={totalWeightPct} totalFinal={totalFinal} onClose={() => setMetricModal(null)} />
      )}
    </div>
  )
}

/* ═══════════════ RECAP "SEMUA ORANG" (#9) ═══════════════ */
function RecapTable({ recap, onPick }: { recap: RecapRow[]; onPick: (uid: string) => void }) {
  if (recap.length === 0) {
    return <div style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)', borderRadius: 16, padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Tidak ada user untuk ditampilkan.</div>
  }
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 90px', gap: 10, padding: '10px 16px', background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)' }}>
        {['Anggota', 'KPI', 'Bobot', 'Skor'].map(h => (
          <div key={h} style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: h === 'Anggota' ? 'left' : 'right' }}>{h}</div>
        ))}
      </div>
      {recap.map((r, i) => {
        const weightOk = Math.abs(r.totalWeight - 100) < 1
        return (
          <div key={r.userId} onClick={() => onPick(r.userId)} title={`Lihat KPI ${r.fullName}`}
            style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 90px', gap: 10, padding: '11px 16px', alignItems: 'center', borderBottom: i < recap.length - 1 ? '1px solid var(--surface-hover)' : 'none', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.fullName}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{r.divisionName ?? '—'} · {r.status}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: r.count > 0 ? 'var(--text-primary)' : 'var(--text-faint)' }}>{r.count}</div>
            <div style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: r.count === 0 ? 'var(--text-faint)' : weightOk ? 'var(--green)' : '#F59E0B' }}>{r.count > 0 ? `${r.totalWeight}%` : '—'}</div>
            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: r.count > 0 ? '#FF8A4C' : 'var(--text-faint)', fontFamily: "'Space Grotesk',sans-serif" }}>{r.count > 0 ? r.totalFinal.toFixed(1) : '—'}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════ METRIC DETAIL MODAL (#10) ═══════════════ */
const METRIC_TITLE: Record<string, string> = {
  kpi: 'Rincian Total KPI', bobot: 'Distribusi Bobot', skor: 'Kontribusi Skor Akhir', status: 'Status per KPI',
}
function KpiMetricModal({ kind, items, totalWeightPct, totalFinal, onClose }: {
  kind: 'kpi' | 'bobot' | 'skor' | 'status'; items: KpiItem[]; totalWeightPct: number; totalFinal: number; onClose: () => void
}) {
  const maxW = Math.max(1, ...items.map(k => Number(k.weight)))
  function scoreOf(k: KpiItem) { return Number(k.finalScore ?? k.autoScore ?? 0) }
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 py-8" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl flex flex-col max-h-[85vh]" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 className="font-grotesk font-bold text-[15px] text-[var(--text-primary)]">{METRIC_TITLE[kind]}</h2>
          <button onClick={onClose} aria-label="Tutup" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>&times;</button>
        </div>
        <div style={{ padding: '12px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {kind === 'bobot' && (
            <div style={{ fontSize: 12, color: Math.abs(totalWeightPct - 100) < 1 ? 'var(--green)' : '#F59E0B', marginBottom: 2 }}>
              Total bobot {totalWeightPct}% {Math.abs(totalWeightPct - 100) < 1 ? '✓ pas 100%' : '· idealnya 100%'}
            </div>
          )}
          {kind === 'skor' && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Skor akhir total: <strong style={{ color: 'var(--text-primary)' }}>{totalFinal.toFixed(1)} poin</strong></div>
          )}
          {items.map(k => {
            const w = Number(k.weight)
            return (
              <div key={k.id} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 600 }}>{k.kpiName}</span>
                  {kind === 'status'
                    ? <span style={{ fontSize: 10.5, fontWeight: 700, color: STATUS_COLOR[k.status] ?? 'var(--text-muted)', background: `${STATUS_COLOR[k.status] ?? '#888'}1F`, borderRadius: 100, padding: '2px 9px' }}>{k.status}</span>
                    : kind === 'skor'
                    ? <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Space Grotesk',sans-serif" }}>{scoreOf(k).toFixed(1)}</span>
                    : <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Space Grotesk',sans-serif" }}>{w}%</span>}
                </div>
                {(kind === 'kpi' || kind === 'bobot') && (
                  <div style={{ height: 6, borderRadius: 100, background: 'var(--surface-hover)', overflow: 'hidden', marginTop: 6 }}>
                    <div style={{ height: '100%', width: `${Math.max(3, (w / maxW) * 100)}%`, borderRadius: 100, background: '#FF6A1A' }} />
                  </div>
                )}
                {kind === 'kpi' && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono',monospace", marginTop: 4 }}>
                    Bobot {w}% · Skor {scoreOf(k).toFixed(1)}/{Number(k.maxScore)} · {k.status}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function KpiFormModal({ item, month, year, targetUserId, onClose, onSaved }: {
  item: KpiItem | null; month: number; year: number; targetUserId: string
  onClose: () => void; onSaved: () => void
}) {
  const isNew = !item
  const [form, setForm] = useState({
    kpiName: item?.kpiName ?? '',
    weight: item?.weight ?? '',
    target: item?.target ?? '',
    realization: item?.realization ?? '',
    maxScore: item?.maxScore ?? '100',
    evaluationNote: item?.evaluationNote ?? '',
    improvementPlan: item?.improvementPlan ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewAuto = form.target && form.realization && form.maxScore
    ? calcAutoScore(form.target, form.realization, form.maxScore)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.kpiName || !form.weight || !form.maxScore) { setError('Nama, bobot, dan skor maks wajib diisi'); return }
    if (Number(form.weight) <= 0 || Number(form.weight) > 100) { setError('Bobot harus antara 1-100'); return }
    setLoading(true); setError(null)

    const body = {
      ...form,
      userId: targetUserId,
      periodMonth: month,
      periodYear: year,
      autoScore: previewAuto,
    }
    const url = isNew ? '/api/kpi' : `/api/kpi/${item!.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Gagal menyimpan'); setLoading(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 py-8" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-grotesk font-bold text-[16px] text-[var(--text-primary)]">{isNew ? 'Tambah KPI Baru' : 'Edit KPI'}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
          {error && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '9px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)' }}>{error}</div>}

          <div>
            <label style={labelS}>Nama KPI / Indikator *</label>
            <input style={inputS} value={form.kpiName} onChange={e => setForm(f => ({ ...f, kpiName: e.target.value }))}
              placeholder="Contoh: Jumlah konten terbit per bulan" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelS}>Bobot (%) *</label>
              <input style={inputS} type="number" min="1" max="100" value={form.weight}
                onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="20" required />
            </div>
            <div>
              <label style={labelS}>Skor Maksimal *</label>
              <input style={inputS} type="number" min="1" value={form.maxScore}
                onChange={e => setForm(f => ({ ...f, maxScore: e.target.value }))} placeholder="100" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelS}>Target</label>
              <input style={inputS} type="number" value={form.target}
                onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="Contoh: 10" />
            </div>
            <div>
              <label style={labelS}>Realisasi</label>
              <input style={inputS} type="number" value={form.realization}
                onChange={e => setForm(f => ({ ...f, realization: e.target.value }))} placeholder="Contoh: 8" />
            </div>
          </div>

          {/* Auto score preview */}
          {previewAuto !== null && (
            <div style={{ background: 'rgba(255,106,26,0.08)', border: '1px solid rgba(255,106,26,0.2)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#FF8A4C' }}>Skor Otomatis (Realisasi/Target × Maks)</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#FF6A1A', fontFamily: "'Space Grotesk', sans-serif" }}>{previewAuto.toFixed(1)}</span>
            </div>
          )}

          <div>
            <label style={labelS}>Catatan Evaluasi</label>
            <textarea style={{ ...inputS, minHeight: '70px', resize: 'vertical' }} value={form.evaluationNote}
              onChange={e => setForm(f => ({ ...f, evaluationNote: e.target.value }))}
              placeholder="Kendala, faktor pencapaian, dll." />
          </div>

          <div>
            <label style={labelS}>Rencana Perbaikan</label>
            <textarea style={{ ...inputS, minHeight: '70px', resize: 'vertical' }} value={form.improvementPlan}
              onChange={e => setForm(f => ({ ...f, improvementPlan: e.target.value }))}
              placeholder="Langkah yang akan dilakukan bulan depan..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              style={{ flex: 1, background: 'var(--border)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', borderRadius: '10px', padding: '11px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>
              Batal
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 2, background: loading ? 'rgba(255,106,26,0.5)' : '#FF6A1A', border: 'none', color: 'var(--on-accent)', borderRadius: '10px', padding: '11px', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px' }}>
              {loading ? 'Menyimpan...' : isNew ? 'Tambah KPI' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
