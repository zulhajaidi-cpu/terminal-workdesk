'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { StatusBadge, PriorityBadge } from '@/components/ui/badge'
import { ProgressBar, getProgressColor } from '@/components/ui/progress-bar'
import { Plus, Search, FolderKanban, Pencil, Trash2, ChevronRight, Check, ListChecks, ArrowUpRight } from 'lucide-react'
import { canCreateProject, canEditProject, canBulkData } from '@/lib/roles'
import { ExcelToolbar } from '@/components/excel-toolbar'

interface TaskLite { id: string; name: string; status: string; checked: boolean; isOverdue: boolean; assignees: string }
interface Project {
  id: string; name: string; projectCode: string; status: string; priority: string
  progress: number; deadline: string; isOverdue: boolean; approvalStatus: string | null
  budgetPlanned: number | null; budgetActual: number | null; picId: string
  divisionName: string | null; picName: string | null
  tasks: TaskLite[]; taskStats: { total: number; done: number; progress: number }
}

interface Props {
  projects: Project[]
  divisions: { id: string; name: string }[]
  currentUser: { id: string; role: string }
}

const STATUS_FILTERS = ['Semua', 'Draft', 'Not Started', 'In Progress', 'Need Review', 'Revision', 'Completed', 'On Hold']
const NON_DELETEABLE = ['In Progress', 'Need Review', 'Completed']

export function ProjectsContent({ projects: initialProjects, divisions, currentUser }: Props) {
  const [projects, setProjects] = useState(initialProjects)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Semua')
  const [divisionFilter, setDivisionFilter] = useState('Semua')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const router = useRouter()

  const isSuperAdmin = currentUser.role === 'super_admin'

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.projectCode.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'Semua' || p.status === statusFilter
    const matchDiv = divisionFilter === 'Semua' || p.divisionName === divisionFilter
    return matchSearch && matchStatus && matchDiv
  })

  const overdueCount = projects.filter(p => p.isOverdue).length
  const activeCount = projects.filter(p => !['Completed', 'Cancelled'].includes(p.status)).length

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id))
  const someSelected = filtered.some(p => selected.has(p.id))

  const derivedPct = (p: Project) => p.taskStats.total > 0 ? p.taskStats.progress : p.progress
  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id)

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map(p => p.id)))
  }

  async function handleDelete(e: React.MouseEvent, id: string, status: string) {
    e.preventDefault(); e.stopPropagation()
    if (NON_DELETEABLE.includes(status) && currentUser.role !== 'super_admin') {
      alert(`Project berstatus "${status}" tidak bisa dihapus.`)
      return
    }
    if (!confirm('Hapus project ini? Tindakan ini tidak bisa dibatalkan.')) return
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setProjects(prev => prev.filter(p => p.id !== id))
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    } else {
      const data = await res.json()
      alert(data.error ?? 'Gagal menghapus project')
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Hapus ${selected.size} project terpilih? Tindakan ini tidak bisa dibatalkan.`)) return
    setBulkDeleting(true)
    const ids = Array.from(selected)
    const results = await Promise.allSettled(
      ids.map(id => fetch(`/api/projects/${id}`, { method: 'DELETE' }))
    )
    const okIds = ids.filter((_, i) => {
      const r = results[i]
      return r.status === 'fulfilled' && r.value.ok
    })
    const failCount = ids.length - okIds.length
    setProjects(prev => prev.filter(p => !okIds.includes(p.id)))
    setSelected(new Set())
    setBulkDeleting(false)
    if (failCount > 0) alert(`${okIds.length} project dihapus, ${failCount} gagal dihapus.`)
  }

  const [taskBusy, setTaskBusy] = useState<Set<string>>(new Set())

  async function handleToggleTask(e: React.MouseEvent, projectId: string, taskId: string, currentChecked: boolean) {
    e.stopPropagation()
    if (taskBusy.has(taskId)) return
    const nextChecked = !currentChecked
    setTaskBusy(prev => new Set(prev).add(taskId))
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: nextChecked }),
    })
    setTaskBusy(prev => { const n = new Set(prev); n.delete(taskId); return n })
    if (res.ok) {
      setProjects(prev => prev.map(p => p.id !== projectId ? p : {
        ...p,
        tasks: p.tasks.map(t => t.id !== taskId ? t : { ...t, checked: nextChecked }),
      }))
    }
  }

  const canEdit = canEditProject(currentUser.role)
  const gridCols = `${isSuperAdmin ? '32px ' : ''}${canEdit ? '2.2fr 1fr 1fr 1fr 1.1fr 110px 72px' : '2.2fr 1fr 1fr 1fr 1.1fr 110px'}`

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-[var(--text-primary)]">Projects</h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            {activeCount} aktif · <span style={{ color: 'var(--red)' }}>{overdueCount} overdue</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canBulkData(currentUser.role) && <ExcelToolbar type="projects" label="Projects" />}
          {canCreateProject(currentUser.role) && (
            <Link href="/projects/new"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-grotesk font-semibold text-[13px] text-[var(--on-accent)] transition-all"
              style={{ background: '#FF6A1A' }}>
              <Plus size={16} /> Buat Project
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <Search size={14} className="text-[var(--text-muted)] flex-shrink-0" />
          <input placeholder="Cari nama atau kode project..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] flex-1" />
        </div>
        <select value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-[13px] text-[var(--text-primary)] outline-none cursor-pointer"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <option>Semua</option>
          {divisions.map(d => <option key={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Status chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scroll">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
            style={{ background: statusFilter === s ? 'rgba(255,106,26,0.15)' : 'var(--surface-hover)', border: `1px solid ${statusFilter === s ? 'rgba(255,106,26,0.4)' : 'var(--border)'}`, color: statusFilter === s ? '#FF8A4C' : 'var(--text-secondary)' }}>
            {s}
          </button>
        ))}
      </div>

      {/* Bulk action bar (super admin) */}
      {isSuperAdmin && selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)' }}>
          <span className="text-[13px] text-[var(--text-primary)] font-medium">
            <span style={{ color: 'var(--red)', fontWeight: 700 }}>{selected.size}</span> project terpilih
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())}
              className="px-3 py-2 rounded-lg text-[12px] font-medium"
              style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}>
              Batal
            </button>
            <button onClick={handleBulkDelete} disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold"
              style={{ background: bulkDeleting ? 'rgba(255,107,107,0.4)' : 'var(--red)', color: 'var(--on-accent)', cursor: bulkDeleting ? 'wait' : 'pointer' }}>
              <Trash2 size={13} /> {bulkDeleting ? 'Menghapus...' : `Hapus ${selected.size} project`}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <div className="p-16 text-center">
            <FolderKanban size={40} className="mx-auto text-[var(--text-muted)] mb-3" />
            <div className="text-[var(--text-muted)] text-sm">Tidak ada project ditemukan.</div>
            {canCreateProject(currentUser.role) && (
              <Link href="/projects/new" className="inline-block mt-4 text-[#FF8A4C] text-sm hover:underline">+ Buat project pertama</Link>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <div className="hidden sm:grid gap-4 px-4 py-3 border-b border-[var(--border)] items-center"
            style={{ gridTemplateColumns: gridCols }}>
            {isSuperAdmin && (
              <input type="checkbox" aria-label="Pilih semua project"
                ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                checked={allSelected} onChange={toggleAll}
                style={{ width: '15px', height: '15px', accentColor: '#FF6A1A', cursor: 'pointer' }} />
            )}
            {['Nama Project', 'Divisi', 'Status', 'Prioritas', 'Progress', 'Deadline', ...(canEdit ? [''] : [])].map((h, i) => (
              <div key={h || `col-${i}`} className="font-mono text-[10px] tracking-widest text-[var(--text-muted)] uppercase">{h}</div>
            ))}
          </div>

          <div className="divide-y divide-[var(--surface-hover)]">
            {filtered.map(p => {
              const pct = derivedPct(p)
              const expanded = expandedId === p.id
              const stats = p.taskStats
              return (
                <div key={p.id} className="group">
                  {/* Desktop row */}
                  <div className="hidden sm:grid gap-4 px-4 py-3.5 items-center hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                    style={{ gridTemplateColumns: gridCols, background: selected.has(p.id) ? 'rgba(255,106,26,0.06)' : expanded ? 'var(--surface-subtle)' : undefined }}
                    onClick={() => toggleExpand(p.id)}>
                    {isSuperAdmin && (
                      <div onClick={e => e.stopPropagation()} className="flex items-center">
                        <input type="checkbox" aria-label={`Pilih ${p.name}`}
                          checked={selected.has(p.id)} onChange={() => toggleOne(p.id)}
                          style={{ width: '15px', height: '15px', accentColor: '#FF6A1A', cursor: 'pointer' }} />
                      </div>
                    )}
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronRight size={14} className="text-[var(--text-muted)] flex-shrink-0 transition-transform"
                        style={{ transform: expanded ? 'rotate(90deg)' : 'none' }} />
                      <div className="min-w-0">
                        <div className="text-[13.5px] text-[var(--text-primary)] font-medium group-hover:text-[var(--orange-primary)] leading-snug truncate">{p.name}</div>
                        <div className="font-mono text-[10px] text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                          <span>{p.projectCode}</span>
                          {stats.total > 0 && (
                            <span className="inline-flex items-center gap-1" style={{ color: stats.done === stats.total ? 'var(--green)' : 'var(--text-muted)' }}>
                              <ListChecks size={11} /> {stats.done}/{stats.total}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-[12px] text-[var(--text-secondary)] truncate">{p.divisionName ?? '—'}</div>
                    <div><StatusBadge status={p.isOverdue ? 'Overdue' : p.status} /></div>
                    <div><PriorityBadge priority={p.priority} /></div>
                    <div><ProgressBar value={pct} color={getProgressColor(pct)} height={5} showLabel animated={false} /></div>
                    <div className="font-mono text-[11px] text-[var(--text-secondary)]">
                      {formatDate(p.deadline, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Link href={`/projects/${p.id}/edit`}
                          style={{ background: 'var(--border)', border: 'none', borderRadius: '7px', padding: '5px 7px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                          <Pencil size={12} />
                        </Link>
                        <button onClick={e => handleDelete(e, p.id, p.status)}
                          title={NON_DELETEABLE.includes(p.status) && currentUser.role !== 'super_admin' ? `Project "${p.status}" tidak bisa dihapus` : 'Hapus project'}
                          style={{ background: 'rgba(255,107,107,0.08)', border: 'none', borderRadius: '7px', padding: '5px 7px', cursor: 'pointer', color: (!NON_DELETEABLE.includes(p.status) || currentUser.role === 'super_admin') ? 'var(--red)' : 'var(--text-faint)', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Mobile card */}
                  <div className="sm:hidden flex flex-col gap-3 p-4 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                    style={{ background: selected.has(p.id) ? 'rgba(255,106,26,0.06)' : undefined }}
                    onClick={() => toggleExpand(p.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        {isSuperAdmin && (
                          <input type="checkbox" aria-label={`Pilih ${p.name}`}
                            onClick={e => e.stopPropagation()}
                            checked={selected.has(p.id)} onChange={() => toggleOne(p.id)}
                            style={{ width: '16px', height: '16px', accentColor: '#FF6A1A', cursor: 'pointer', marginTop: '2px' }} />
                        )}
                        <div>
                          <div className="text-[13.5px] text-[var(--text-primary)] font-medium">{p.name}</div>
                          <div className="font-mono text-[10px] text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                            <span>{p.projectCode}</span>
                            {stats.total > 0 && (
                              <span className="inline-flex items-center gap-1" style={{ color: stats.done === stats.total ? 'var(--green)' : 'var(--text-muted)' }}>
                                <ListChecks size={11} /> {stats.done}/{stats.total}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={p.isOverdue ? 'Overdue' : p.status} />
                    </div>
                    <ProgressBar value={pct} color={getProgressColor(pct)} height={5} showLabel animated={false} />
                    <div className="flex items-center justify-between">
                      <PriorityBadge priority={p.priority} />
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {canEdit && (
                          <>
                            <Link href={`/projects/${p.id}/edit`} style={{ color: 'var(--text-secondary)' }}><Pencil size={13} /></Link>
                            <button onClick={e => handleDelete(e, p.id, p.status)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: (!NON_DELETEABLE.includes(p.status) || currentUser.role === 'super_admin') ? 'var(--red)' : 'var(--text-faint)', display: 'flex' }}><Trash2 size={13} /></button>
                          </>
                        )}
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">{formatDate(p.deadline, { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded task list */}
                  {expanded && (
                    <div className="px-4 sm:px-12 pb-4 pt-1" style={{ background: 'var(--surface-subtle)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] tracking-widest text-[var(--text-muted)] uppercase">
                          Tasks — {stats.done}/{stats.total} selesai ({pct}%)
                        </span>
                        <Link href={`/projects/${p.id}`}
                          className="inline-flex items-center gap-1 text-[12px] text-[#FF8A4C] hover:underline">
                          Update Progress <ArrowUpRight size={12} />
                        </Link>
                      </div>
                      {p.tasks.length === 0 ? (
                        <div className="text-[12px] text-[var(--text-muted)] py-3 text-center rounded-lg" style={{ border: '1px dashed var(--border)' }}>
                          Belum ada task. Tambahkan task di halaman detail agar progress terhitung.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {p.tasks.map(t => {
                            const isBusy = taskBusy.has(t.id)
                            return (
                              <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: 'var(--surface-subtle)' }}>
                                <button
                                  onClick={e => handleToggleTask(e, p.id, t.id, t.checked)}
                                  disabled={isBusy}
                                  title={t.checked ? 'Hapus centang' : 'Centang task ini'}
                                  style={{
                                    width: '16px', height: '16px', borderRadius: '5px', flexShrink: 0,
                                    border: `1.5px solid ${t.checked ? 'var(--green)' : 'var(--border-strong)'}`,
                                    background: t.checked ? 'var(--green)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: isBusy ? 'wait' : 'pointer', opacity: isBusy ? 0.5 : 1,
                                    padding: 0, transition: 'all 0.15s',
                                  }}>
                                  {t.checked && <Check size={11} strokeWidth={3} style={{ color: 'var(--on-accent)' }} />}
                                </button>
                                <span className="flex-1 text-[12.5px] text-[var(--text-primary)] truncate"
                                  style={{ textDecoration: t.checked ? 'line-through' : 'none', opacity: t.checked ? 0.55 : 1 }}>
                                  {t.name}
                                </span>
                                {t.assignees && <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline truncate max-w-[160px]">{t.assignees}</span>}
                                <StatusBadge status={t.isOverdue && t.status !== 'Completed' ? 'Overdue' : t.status} />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
