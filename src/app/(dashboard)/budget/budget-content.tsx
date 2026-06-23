'use client'

import { useState } from 'react'
import { Plus, Search, Wallet, Pencil, Trash2, ExternalLink, X } from 'lucide-react'
import { canEditProject } from '@/lib/roles'

interface BudgetItem {
  id: string; category: string; planned: number; approved: number | null
  actual: number; vendor: string | null; invoiceLink: string | null
  reimburseLink: string | null; paymentStatus: string; notes: string | null
  createdAt: string; projectId: string | null; projectName: string | null
  projectCode: string | null; divisionName: string | null
}

interface Props {
  budgets: BudgetItem[]
  projects: { id: string; name: string; projectCode: string }[]
  currentUser: { id: string; role: string }
}

const PAYMENT_COLORS: Record<string, { bg: string; color: string }> = {
  'Draft':            { bg: 'rgba(107,115,133,0.15)', color: 'var(--text-muted)' },
  'Waiting Approval': { bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B' },
  'Approved':         { bg: 'rgba(74,158,255,0.15)',  color: 'var(--blue)' },
  'Used':             { bg: 'rgba(139,92,246,0.15)',  color: '#8B5CF6' },
  'Partially Paid':   { bg: 'rgba(255,106,26,0.15)',  color: '#FF8A4C' },
  'Paid':             { bg: 'rgba(74,222,128,0.15)',  color: '#4ADE80' },
  'Rejected':         { bg: 'rgba(255,107,107,0.15)', color: 'var(--red)' },
}

const PAYMENT_STATUSES = Object.keys(PAYMENT_COLORS)

function formatRp(n: number | null | undefined): string {
  if (n == null) return '—'
  return 'Rp ' + n.toLocaleString('id-ID')
}

function PaymentBadge({ status }: { status: string }) {
  const s = PAYMENT_COLORS[status] ?? PAYMENT_COLORS['Draft']
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

export function BudgetContent({ budgets: initialBudgets, projects, currentUser }: Props) {
  const [budgets, setBudgets] = useState(initialBudgets)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Semua')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<BudgetItem | null>(null)

  const filtered = budgets.filter(b => {
    const matchSearch = b.category.toLowerCase().includes(search.toLowerCase()) ||
      (b.projectName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (b.vendor?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchStatus = statusFilter === 'Semua' || b.paymentStatus === statusFilter
    return matchSearch && matchStatus
  })

  const totalPlanned = budgets.reduce((s, b) => s + (b.planned ?? 0), 0)
  const totalActual  = budgets.reduce((s, b) => s + (b.actual ?? 0), 0)
  const totalApproved = budgets.reduce((s, b) => s + (b.approved ?? 0), 0)
  const pctUsed = totalPlanned > 0 ? Math.min(100, Math.round((totalActual / totalPlanned) * 100)) : 0

  async function handleDelete(id: string) {
    if (!confirm('Hapus item budget ini?')) return
    const res = await fetch(`/api/budget/${id}`, { method: 'DELETE' })
    if (res.ok) setBudgets(prev => prev.filter(b => b.id !== id))
  }

  function onSaved(saved: BudgetItem, isNew: boolean) {
    if (isNew) setBudgets(prev => [saved, ...prev])
    else setBudgets(prev => prev.map(b => b.id === saved.id ? saved : b))
    setShowModal(false); setEditItem(null)
  }

  const canEdit = canEditProject(currentUser.role)

  return (
    <div className="max-w-7xl mx-auto animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-[var(--text-primary)]">Budget</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">{budgets.length} item budget terdaftar</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditItem(null); setShowModal(true) }}
            style={{ background: '#FF6A1A', color: 'var(--on-accent)', border: 'none', borderRadius: '11px', padding: '9px 18px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={15} /> Tambah Budget
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Planned', val: formatRp(totalPlanned), color: 'var(--blue)' },
          { label: 'Total Approved', val: formatRp(totalApproved), color: '#4ADE80' },
          { label: 'Total Aktual', val: formatRp(totalActual), color: '#F59E0B' },
          { label: 'Pemakaian', val: `${pctUsed}%`, color: pctUsed > 90 ? 'var(--red)' : pctUsed > 70 ? '#F59E0B' : '#4ADE80' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '5px' }}>{s.label}</p>
            <p style={{ fontSize: '20px', fontWeight: 700, color: s.color, fontFamily: "'Space Grotesk', sans-serif" }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Progress bar overall */}
      {totalPlanned > 0 && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Realisasi Budget Keseluruhan</span>
            <span style={{ fontSize: '12px', color: pctUsed > 90 ? 'var(--red)' : '#4ADE80', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{pctUsed}%</span>
          </div>
          <div style={{ background: 'var(--border)', borderRadius: '100px', height: '8px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pctUsed}%`, background: pctUsed > 90 ? 'var(--red)' : pctUsed > 70 ? '#F59E0B' : '#4ADE80', borderRadius: '100px', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '11px', padding: '9px 12px' }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kategori, project, atau vendor..."
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '13px', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {['Semua', ...PAYMENT_STATUSES].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '8px 12px', borderRadius: '9px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', border: `1px solid ${statusFilter === s ? 'rgba(255,106,26,0.4)' : 'var(--border)'}`, background: statusFilter === s ? 'rgba(255,106,26,0.12)' : 'transparent', color: statusFilter === s ? '#FF8A4C' : 'var(--text-secondary)' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
          <Wallet size={36} style={{ color: 'var(--text-faint)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Tidak ada item budget</p>
          {canEdit && <button onClick={() => { setEditItem(null); setShowModal(true) }}
            style={{ marginTop: '16px', background: 'rgba(255,106,26,0.1)', border: '1px solid rgba(255,106,26,0.3)', color: '#FF8A4C', borderRadius: '10px', padding: '10px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            + Tambah Budget Pertama
          </button>}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
          {/* Desktop header */}
          <div className="hidden md:grid" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 80px', gap: '12px', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-subtle)' }}>
            {['Kategori / Project', 'Planned', 'Approved', 'Aktual', 'Vendor', 'Status', ''].map(h => (
              <div key={h} style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {filtered.map(b => {
            const pct = b.planned > 0 ? Math.min(100, Math.round((b.actual / b.planned) * 100)) : 0
            return (
              <div key={b.id} style={{ borderBottom: '1px solid var(--surface-hover)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {/* Desktop */}
                <div className="hidden md:grid" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 80px', gap: '12px', padding: '12px 16px', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{b.category}</p>
                    {b.projectName && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{b.projectCode} · {b.projectName}</p>}
                    {b.divisionName && <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '1px' }}>{b.divisionName}</p>}
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>{formatRp(b.planned)}</p>
                    <div style={{ marginTop: '4px', background: 'var(--border)', borderRadius: '100px', height: '4px', overflow: 'hidden', width: '80px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct > 90 ? 'var(--red)' : '#4ADE80', borderRadius: '100px' }} />
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: b.approved != null ? '#4ADE80' : 'var(--text-faint)', fontFamily: "'IBM Plex Mono', monospace" }}>{formatRp(b.approved)}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>{formatRp(b.actual)}</p>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{b.vendor ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}</p>
                    <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
                      {b.invoiceLink && <a href={b.invoiceLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: '2px' }}><ExternalLink size={9} /> Invoice</a>}
                      {b.reimburseLink && <a href={b.reimburseLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: '2px' }}><ExternalLink size={9} /> Reimburse</a>}
                    </div>
                  </div>
                  <PaymentBadge status={b.paymentStatus} />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {canEdit && (
                      <>
                        <button onClick={() => { setEditItem(b); setShowModal(true) }}
                          style={{ background: 'var(--border)', border: 'none', borderRadius: '7px', padding: '4px 6px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                          <Pencil size={11} />
                        </button>
                        <button onClick={() => handleDelete(b.id)}
                          style={{ background: 'rgba(255,107,107,0.08)', border: 'none', borderRadius: '7px', padding: '4px 6px', cursor: 'pointer', color: 'var(--red)', display: 'flex' }}>
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Mobile */}
                <div className="md:hidden p-4">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{b.category}</p>
                      {b.projectName && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{b.projectName}</p>}
                    </div>
                    <PaymentBadge status={b.paymentStatus} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '11px' }}>
                    <div><p style={{ color: 'var(--text-muted)' }}>Planned</p><p style={{ color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>{formatRp(b.planned)}</p></div>
                    <div><p style={{ color: 'var(--text-muted)' }}>Approved</p><p style={{ color: '#4ADE80', fontFamily: "'IBM Plex Mono', monospace" }}>{formatRp(b.approved)}</p></div>
                    <div><p style={{ color: 'var(--text-muted)' }}>Aktual</p><p style={{ color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>{formatRp(b.actual)}</p></div>
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                      <button onClick={() => { setEditItem(b); setShowModal(true) }}
                        style={{ flex: 1, background: 'var(--border)', border: 'none', borderRadius: '9px', padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Edit</button>
                      <button onClick={() => handleDelete(b.id)}
                        style={{ flex: 1, background: 'rgba(255,107,107,0.08)', border: 'none', borderRadius: '9px', padding: '8px', cursor: 'pointer', color: 'var(--red)', fontSize: '12px', fontWeight: 600 }}>Hapus</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <BudgetModal
          item={editItem}
          projects={projects}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

/* ── Budget Modal ───────────────────────────────────── */
function BudgetModal({ item, projects, onClose, onSaved }: {
  item: BudgetItem | null
  projects: { id: string; name: string; projectCode: string }[]
  onClose: () => void
  onSaved: (b: BudgetItem, isNew: boolean) => void
}) {
  const isNew = !item
  const [form, setForm] = useState({
    projectId: item?.projectId ?? '',
    category: item?.category ?? '',
    planned: item?.planned?.toString() ?? '',
    approved: item?.approved?.toString() ?? '',
    actual: item?.actual?.toString() ?? '',
    vendor: item?.vendor ?? '',
    invoiceLink: item?.invoiceLink ?? '',
    reimburseLink: item?.reimburseLink ?? '',
    paymentStatus: item?.paymentStatus ?? 'Draft',
    notes: item?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputS: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px',
    padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', width: '100%',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  }
  const labelS: React.CSSProperties = {
    fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace",
    letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '5px',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category || !form.planned) { setError('Kategori dan planned wajib diisi'); return }
    if (isNew && !form.projectId) { setError('Pilih project'); return }
    setLoading(true); setError(null)

    const url = isNew ? '/api/budget' : `/api/budget/${item!.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const body = {
      projectId: form.projectId,
      category: form.category,
      planned: Number(form.planned) || 0,
      approved: form.approved ? Number(form.approved) : null,
      actual: Number(form.actual) || 0,
      vendor: form.vendor || null,
      invoiceLink: form.invoiceLink || null,
      reimburseLink: form.reimburseLink || null,
      paymentStatus: form.paymentStatus,
      notes: form.notes || null,
    }

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Gagal menyimpan'); setLoading(false); return }

    const proj = projects.find(p => p.id === form.projectId)
    const saved: BudgetItem = {
      id: data.id ?? item!.id,
      ...body,
      planned: Number(form.planned) || 0,
      approved: form.approved ? Number(form.approved) : null,
      actual: Number(form.actual) || 0,
      projectName: proj?.name ?? item?.projectName ?? null,
      projectCode: proj?.projectCode ?? item?.projectCode ?? null,
      divisionName: item?.divisionName ?? null,
      createdAt: item?.createdAt ?? new Date().toISOString(),
    }
    onSaved(saved, isNew)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 py-8" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-grotesk font-bold text-[16px] text-[var(--text-primary)]">{isNew ? 'Tambah Budget' : 'Edit Budget'}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
          {error && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '9px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)' }}>{error}</div>}

          {isNew && (
            <div>
              <label style={labelS}>Project *</label>
              <select style={inputS} value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} required>
                <option value="">— Pilih project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.projectCode} · {p.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={labelS}>Kategori *</label>
            <input style={inputS} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Contoh: Produksi, Design, Logistik, Talent..." required />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label style={labelS}>Planned (Rp) *</label>
              <input style={inputS} type="number" value={form.planned} onChange={e => setForm(f => ({ ...f, planned: e.target.value }))} placeholder="0" required />
            </div>
            <div>
              <label style={labelS}>Approved (Rp)</label>
              <input style={inputS} type="number" value={form.approved} onChange={e => setForm(f => ({ ...f, approved: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label style={labelS}>Aktual (Rp)</label>
              <input style={inputS} type="number" value={form.actual} onChange={e => setForm(f => ({ ...f, actual: e.target.value }))} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelS}>Vendor</label>
              <input style={inputS} value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Nama vendor / supplier" />
            </div>
            <div>
              <label style={labelS}>Status Pembayaran</label>
              <select style={inputS} value={form.paymentStatus} onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value }))}>
                {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelS}>Link Invoice</label>
            <input style={inputS} type="url" value={form.invoiceLink} onChange={e => setForm(f => ({ ...f, invoiceLink: e.target.value }))} placeholder="https://..." />
          </div>

          <div>
            <label style={labelS}>Link Reimburse</label>
            <input style={inputS} type="url" value={form.reimburseLink} onChange={e => setForm(f => ({ ...f, reimburseLink: e.target.value }))} placeholder="https://..." />
          </div>

          <div>
            <label style={labelS}>Catatan</label>
            <textarea style={{ ...inputS, minHeight: '70px', resize: 'vertical' }} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Catatan tambahan..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'var(--border)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', borderRadius: '10px', padding: '11px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>Batal</button>
            <button type="submit" disabled={loading} style={{ flex: 2, background: loading ? 'rgba(255,106,26,0.5)' : '#FF6A1A', border: 'none', color: 'var(--on-accent)', borderRadius: '10px', padding: '11px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px' }}>
              {loading ? 'Menyimpan...' : isNew ? 'Tambah' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
