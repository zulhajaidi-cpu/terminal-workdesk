'use client'

import { useState } from 'react'
import { Plus, Search, FolderOpen, ExternalLink, Pencil, Trash2, Tag, X } from 'lucide-react'

interface Asset {
  id: string; name: string; category: string; version: string | null
  status: string; driveLink: string; description: string | null
  tags: string[] | null; createdAt: string
  divisionId: string; relatedProjectId: string | null; uploadedBy: string
  divisionName: string | null; projectName: string | null; uploaderName: string | null
}

interface Props {
  assets: Asset[]
  divisions: { id: string; name: string }[]
  projects: { id: string; name: string }[]
  currentUser: { id: string; role: string; divisionId: string | null }
}

const STATUS_CFG: Record<string, { bg: string; color: string }> = {
  'Draft':       { bg: 'rgba(107,115,133,0.15)', color: 'var(--text-muted)' },
  'Need Review': { bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B' },
  'Approved':    { bg: 'rgba(74,222,128,0.15)',  color: '#4ADE80' },
  'Rejected':    { bg: 'rgba(255,107,107,0.15)', color: 'var(--red)' },
  'Archived':    { bg: 'rgba(139,92,246,0.15)',  color: '#8B5CF6' },
}
const ASSET_STATUSES = Object.keys(STATUS_CFG)

const CATEGORIES = ['Foto', 'Video', 'Desain', 'Dokumen', 'Audio', 'Template', 'Lainnya']

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CFG[status] ?? STATUS_CFG.Draft
  return <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600 }}>{status}</span>
}

const canManageAsset = (role: string, uploadedBy: string, uid: string) =>
  ['super_admin', 'spv_manager', 'leader_divisi'].includes(role) || uploadedBy === uid

export function AssetsContent({ assets: initialAssets, divisions, projects, currentUser }: Props) {
  const [assets, setAssets] = useState(initialAssets)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Semua')
  const [categoryFilter, setCategoryFilter] = useState('Semua')
  const [divisionFilter, setDivisionFilter] = useState('Semua')
  const [showModal, setShowModal] = useState(false)
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null)

  const filtered = assets.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase()) ||
      (a.tags?.some(t => t.toLowerCase().includes(search.toLowerCase())) ?? false)
    const matchStatus = statusFilter === 'Semua' || a.status === statusFilter
    const matchCat = categoryFilter === 'Semua' || a.category === categoryFilter
    const matchDiv = divisionFilter === 'Semua' || a.divisionName === divisionFilter
    return matchSearch && matchStatus && matchCat && matchDiv
  })

  const counts = ASSET_STATUSES.reduce((acc, s) => ({ ...acc, [s]: assets.filter(a => a.status === s).length }), {} as Record<string, number>)

  async function handleDelete(id: string) {
    if (!confirm('Hapus asset ini?')) return
    const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' })
    if (res.ok) { setAssets(prev => prev.filter(a => a.id !== id)); setDetailAsset(null) }
  }

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch(`/api/assets/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setAssets(prev => prev.map(a => a.id === id ? { ...a, status } : a))
      setDetailAsset(prev => prev && prev.id === id ? { ...prev, status } : prev)
    }
  }

  function onSaved(saved: Asset, isNew: boolean) {
    if (isNew) setAssets(prev => [saved, ...prev])
    else setAssets(prev => prev.map(a => a.id === saved.id ? saved : a))
    setShowModal(false); setEditAsset(null)
  }

  const divisionNames = [...new Set(assets.map(a => a.divisionName).filter(Boolean))] as string[]

  return (
    <div className="max-w-7xl mx-auto animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-[var(--text-primary)]">Assets</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">{assets.length} asset terdaftar</p>
        </div>
        <button onClick={() => { setEditAsset(null); setShowModal(true) }}
          style={{ background: '#FF6A1A', color: 'var(--on-accent)', border: 'none', borderRadius: '11px', padding: '9px 18px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} /> Upload Asset
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {ASSET_STATUSES.map(s => (
          <div key={s} onClick={() => setStatusFilter(statusFilter === s ? 'Semua' : s)}
            style={{ background: 'var(--bg-elevated)', border: `1px solid ${statusFilter === s ? STATUS_CFG[s].color + '55' : 'var(--border)'}`, borderRadius: '11px', padding: '10px 14px', cursor: 'pointer' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '3px' }}>{s}</p>
            <p style={{ fontSize: '20px', fontWeight: 700, color: STATUS_CFG[s].color, fontFamily: "'Space Grotesk', sans-serif" }}>{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '11px', padding: '9px 12px' }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, kategori, atau tag..."
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '13px', width: '100%' }} />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '11px', padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
          <option value="Semua">Semua Kategori</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '11px', padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
          <option value="Semua">Semua Divisi</option>
          {divisionNames.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Grid / List */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
          <FolderOpen size={36} style={{ color: 'var(--text-faint)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Tidak ada asset ditemukan</p>
          <button onClick={() => { setEditAsset(null); setShowModal(true) }}
            style={{ marginTop: '14px', background: 'rgba(255,106,26,0.1)', border: '1px solid rgba(255,106,26,0.3)', color: '#FF8A4C', borderRadius: '10px', padding: '9px 18px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            + Upload Asset Pertama
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {filtered.map(a => (
            <div key={a.id}
              onClick={() => setDetailAsset(a)}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,106,26,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}>
              {/* Icon + category */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ background: 'rgba(255,106,26,0.1)', border: '1px solid rgba(255,106,26,0.2)', borderRadius: '10px', padding: '8px 10px', fontSize: '11px', color: '#FF8A4C', fontWeight: 600 }}>
                  {a.category}
                </div>
                <StatusBadge status={a.status} />
              </div>

              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', lineHeight: 1.3 }}>{a.name}</h3>

              {a.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{a.description}</p>}

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {(a.tags ?? []).slice(0, 3).map(tag => (
                  <span key={tag} style={{ fontSize: '10px', background: 'var(--surface-hover)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Tag size={8} />{tag}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.divisionName ?? '—'}</p>
                  {a.version && <p style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: "'IBM Plex Mono', monospace" }}>v{a.version}</p>}
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <a href={a.driveLink} target="_blank" rel="noopener noreferrer"
                    style={{ background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: '7px', padding: '5px 7px', color: 'var(--blue)', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                    <ExternalLink size={12} />
                  </a>
                  {canManageAsset(currentUser.role, a.uploadedBy, currentUser.id) && (
                    <>
                      <button onClick={() => { setEditAsset(a); setShowModal(true) }}
                        style={{ background: 'var(--border)', border: 'none', borderRadius: '7px', padding: '5px 7px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(a.id)}
                        style={{ background: 'rgba(255,107,107,0.08)', border: 'none', borderRadius: '7px', padding: '5px 7px', cursor: 'pointer', color: 'var(--red)', display: 'flex' }}>
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail side panel */}
      {detailAsset && (
        <div className="fixed inset-0 z-40 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDetailAsset(null)}>
          <div style={{ width: '100%', maxWidth: '380px', background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border)', height: '100%', overflowY: 'auto', padding: '24px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="font-grotesk font-bold text-[16px] text-[var(--text-primary)]">Detail Asset</h2>
              <button onClick={() => setDetailAsset(null)} style={{ background: 'var(--border)', border: 'none', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={15} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <p style={{ fontSize: '10px', color: '#FF8A4C', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>{detailAsset.category}</p>
                <h3 className="font-grotesk font-bold text-[18px] text-[var(--text-primary)]">{detailAsset.name}</h3>
              </div>

              <StatusBadge status={detailAsset.status} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'Divisi', val: detailAsset.divisionName ?? '—' },
                  { label: 'Versi', val: detailAsset.version ? `v${detailAsset.version}` : '—' },
                  { label: 'Diupload oleh', val: detailAsset.uploaderName ?? '—' },
                  { label: 'Project', val: detailAsset.projectName ?? '—' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--surface-subtle)', borderRadius: '9px', padding: '10px 12px' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '3px' }}>{item.label}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{item.val}</p>
                  </div>
                ))}
              </div>

              {detailAsset.description && (
                <div style={{ background: 'var(--surface-subtle)', borderRadius: '9px', padding: '10px 12px' }}>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>Deskripsi</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{detailAsset.description}</p>
                </div>
              )}

              {(detailAsset.tags ?? []).length > 0 && (
                <div>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Tags</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {(detailAsset.tags ?? []).map(t => (
                      <span key={t} style={{ fontSize: '11px', background: 'var(--border)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: '100px' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              <a href={detailAsset.driveLink} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: '10px', padding: '11px 14px', color: 'var(--blue)', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
                <ExternalLink size={14} /> Buka di Google Drive
              </a>

              {canManageAsset(currentUser.role, detailAsset.uploadedBy, currentUser.id) && (
                <>
                  {/* Quick status change */}
                  <div>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Ubah Status</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {ASSET_STATUSES.filter(s => s !== detailAsset.status).map(s => (
                        <button key={s} onClick={() => handleStatusChange(detailAsset.id, s)}
                          style={{ fontSize: '11px', background: STATUS_CFG[s].bg, color: STATUS_CFG[s].color, border: `1px solid ${STATUS_CFG[s].color}44`, padding: '5px 12px', borderRadius: '100px', cursor: 'pointer', fontWeight: 600 }}>
                          → {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button onClick={() => { setEditAsset(detailAsset); setShowModal(true) }}
                      style={{ background: 'var(--border)', border: '1px solid var(--border-strong)', borderRadius: '10px', padding: '10px', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => handleDelete(detailAsset.id)}
                      style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: '10px', padding: '10px', cursor: 'pointer', color: 'var(--red)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                      <Trash2 size={13} /> Hapus
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AssetModal
          asset={editAsset}
          divisions={divisions}
          projects={projects}
          currentUser={currentUser}
          onClose={() => { setShowModal(false); setEditAsset(null) }}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

/* ── Asset Modal ─────────────────────────────────────── */
function AssetModal({ asset, divisions, projects, currentUser, onClose, onSaved }: {
  asset: Asset | null
  divisions: { id: string; name: string }[]
  projects: { id: string; name: string }[]
  currentUser: { id: string; role: string; divisionId: string | null }
  onClose: () => void
  onSaved: (a: Asset, isNew: boolean) => void
}) {
  const isNew = !asset
  const [form, setForm] = useState({
    name: asset?.name ?? '',
    category: asset?.category ?? 'Foto',
    divisionId: asset?.divisionId ?? currentUser.divisionId ?? '',
    driveLink: asset?.driveLink ?? '',
    version: asset?.version ?? '',
    relatedProjectId: asset?.relatedProjectId ?? '',
    description: asset?.description ?? '',
    tagInput: '',
    tags: asset?.tags ?? [] as string[],
    status: asset?.status ?? 'Draft',
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

  function addTag() {
    const t = form.tagInput.trim()
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t], tagInput: '' }))
    else setForm(f => ({ ...f, tagInput: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.category || !form.divisionId || !form.driveLink) {
      setError('Nama, kategori, divisi, dan link Drive wajib diisi'); return
    }
    setLoading(true); setError(null)

    const url    = isNew ? '/api/assets' : `/api/assets/${asset!.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const body   = {
      name: form.name, category: form.category, divisionId: form.divisionId,
      driveLink: form.driveLink, version: form.version || null,
      relatedProjectId: form.relatedProjectId || null,
      description: form.description || null, tags: form.tags, status: form.status,
    }

    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Gagal menyimpan'); setLoading(false); return }

    const divName  = divisions.find(d => d.id === form.divisionId)?.name ?? null
    const projName = projects.find(p => p.id === form.relatedProjectId)?.name ?? null
    const saved: Asset = {
      id: data.id ?? asset!.id,
      ...body, version: form.version || null, tags: form.tags,
      createdAt: asset?.createdAt ?? new Date().toISOString(),
      divisionName: divName, projectName: projName,
      uploaderName: asset?.uploaderName ?? null,
      uploadedBy: asset?.uploadedBy ?? currentUser.id,
    }
    onSaved(saved, isNew)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 py-8" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-grotesk font-bold text-[16px] text-[var(--text-primary)]">{isNew ? 'Upload Asset' : 'Edit Asset'}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
          {error && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '9px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)' }}>{error}</div>}

          <div>
            <label style={labelS}>Nama Asset *</label>
            <input style={inputS} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nama file atau asset..." required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelS}>Kategori *</label>
              <select style={inputS} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelS}>Divisi *</label>
              <select style={inputS} value={form.divisionId} onChange={e => setForm(f => ({ ...f, divisionId: e.target.value }))} required>
                <option value="">— Pilih —</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelS}>Link Google Drive *</label>
            <input style={inputS} type="url" value={form.driveLink} onChange={e => setForm(f => ({ ...f, driveLink: e.target.value }))} placeholder="https://drive.google.com/..." required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelS}>Versi</label>
              <input style={inputS} value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0, 2.1, final..." />
            </div>
            <div>
              <label style={labelS}>Status</label>
              <select style={inputS} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {ASSET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelS}>Project terkait</label>
            <select style={inputS} value={form.relatedProjectId} onChange={e => setForm(f => ({ ...f, relatedProjectId: e.target.value }))}>
              <option value="">— Tidak ada —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label style={labelS}>Deskripsi</label>
            <textarea style={{ ...inputS, minHeight: '70px', resize: 'vertical' }} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Keterangan singkat tentang asset ini..." />
          </div>

          <div>
            <label style={labelS}>Tags</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input style={{ ...inputS, flex: 1 }} value={form.tagInput}
                onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Ketik tag lalu Enter..." />
              <button type="button" onClick={addTag}
                style={{ background: 'rgba(255,106,26,0.1)', border: '1px solid rgba(255,106,26,0.3)', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', color: '#FF8A4C', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}>
                + Tag
              </button>
            </div>
            {form.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                {form.tags.map(t => (
                  <span key={t} style={{ fontSize: '11px', background: 'var(--border)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {t}
                    <button type="button" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', lineHeight: 1 }}><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'var(--border)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', borderRadius: '10px', padding: '11px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>Batal</button>
            <button type="submit" disabled={loading} style={{ flex: 2, background: loading ? 'rgba(255,106,26,0.5)' : '#FF6A1A', border: 'none', color: 'var(--on-accent)', borderRadius: '10px', padding: '11px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px' }}>
              {loading ? 'Menyimpan...' : isNew ? 'Upload' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
