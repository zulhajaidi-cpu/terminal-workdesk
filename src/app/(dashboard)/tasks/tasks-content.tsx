'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { formatDate } from '@/lib/utils'
import { StatusBadge, PriorityBadge } from '@/components/ui/badge'
import { Plus, Search, CheckSquare, Pencil, Trash2, CheckCircle, X, ExternalLink, MessageSquare, Send, ListTodo } from 'lucide-react'
import { ROLE_LABELS, canBulkData, canSeeAllDivisions } from '@/lib/roles'
import { ExcelToolbar } from '@/components/excel-toolbar'

interface Assignee { id: string; fullName: string; avatarUrl: string | null }
interface Task {
  id: string; name: string; status: string; priority: string
  dueDate: string; isOverdue: boolean; requiresApproval: boolean
  description: string | null; outputUrl: string | null; completedAt: string | null
  projectName: string | null; divisionName: string | null
  picId: string | null; picName: string | null; createdBy: string | null
  category: string | null; progressPct: number | null
  assignees: Assignee[]
}
interface ProgressLog {
  id: string; note: string; created_at: string; user_name: string; avatar_url: string | null
}
interface Props {
  tasks: Task[]
  projects: { id: string; name: string }[]
  divisions: { id: string; name: string }[]
  users: { id: string; fullName: string; avatarUrl: string | null; role: string }[]
  currentUser: { id: string; role: string; fullName: string }
}

const SECTION_TABS = ['Semua', 'Tasks Project', 'Tasks Individu'] as const
type SectionTab = typeof SECTION_TABS[number]
const STATUS_CHIPS = ['Semua', 'To Do', 'In Progress', 'Need Review', 'Completed', 'Deadline Alert']
const STATUS_NEXT: Record<string, string> = {
  'To Do': 'In Progress', 'In Progress': 'Need Review',
  'Need Review': 'Completed', 'Revision': 'In Progress',
}
const STATUS_ALL = ['To Do', 'In Progress', 'Need Review', 'Revision', 'Completed', 'On Hold', 'Cancelled']
const TODO_STATUSES = ['To Do', 'In Progress', 'Completed', 'On Hold', 'Cancelled']
const CATEGORIES = ['Daily', 'Weekly', 'Ad Hoc', 'Meeting', 'Reporting', 'Review', 'Lainnya']

const MANAGER_ROLES = ['super_admin', 'spv_manager', 'head_director', 'leader_divisi']
const canCreate     = (r: string) => MANAGER_ROLES.includes(r)
const canEdit       = (r: string) => MANAGER_ROLES.includes(r)
const canDelete     = (r: string) => MANAGER_ROLES.includes(r)
const canEditStatus = (r: string) => [...MANAGER_ROLES, 'staff'].includes(r)

function hasSpecificTime(iso: string | null | undefined): boolean {
  if (!iso) return false
  const d = new Date(iso)
  return d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0
}

function isDeadlineAlert(t: Task): boolean {
  if (t.status === 'Completed' || t.status === 'Cancelled') return false
  if (!t.dueDate) return false
  return new Date(t.dueDate).getTime() <= Date.now() + 3 * 24 * 60 * 60 * 1000
}

function getTaskTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!hasSpecificTime(iso)) return ''
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
function AvatarChip({ name, url, size = 22 }: { name: string; url: string | null; size?: number }) {
  return (
    <span title={name} style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,106,26,0.2)', border: '1px solid rgba(255,106,26,0.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#FF8A4C', flexShrink: 0, overflow: 'hidden' }}>
      {url ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name)}
    </span>
  )
}

export function TasksContent({ tasks: initialTasks, projects, divisions, users, currentUser }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Semua')
  const [divFilter, setDivFilter] = useState('all')
  const showDivFilter = canSeeAllDivisions(currentUser.role)
  const [sectionTab, setSectionTab] = useState<SectionTab>('Semua')
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showTodoModal, setShowTodoModal] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  const applyFilter = (list: Task[]) => list.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.projectName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (t.picName?.toLowerCase().includes(search.toLowerCase()) ?? false)
    if (!matchSearch) return false
    // Filter divisi: 'all' = semua; pilih divisi → task divisi itu + task tanpa divisi (lintas-divisi).
    if (divFilter !== 'all' && t.divisionName !== divFilter && t.divisionName != null) return false
    if (statusFilter === 'Semua') return true
    if (statusFilter === 'Deadline Alert') return isDeadlineAlert(t)
    return t.status === statusFilter
  })

  const projectTasks  = applyFilter(tasks.filter(t => !!t.projectName))
  const individualTasks = applyFilter(tasks.filter(t => !t.projectName))

  const counts = {
    todo:          tasks.filter(t => t.status === 'To Do').length,
    inProgress:    tasks.filter(t => t.status === 'In Progress').length,
    review:        tasks.filter(t => t.status === 'Need Review').length,
    deadlineAlert: tasks.filter(t => isDeadlineAlert(t)).length,
    done:          tasks.filter(t => t.status === 'Completed' || t.status === 'Done').length,
  }

  async function handleStatusChange(task: Task, newStatus: string) {
    const prevStatus = task.status
    // Optimistic: ubah UI seketika, revert kalau server gagal.
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    if (detailTask?.id === task.id) setDetailTask(prev => prev ? { ...prev, status: newStatus } : null)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: prevStatus } : t))
      if (detailTask?.id === task.id) setDetailTask(prev => prev ? { ...prev, status: prevStatus } : null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus task ini?')) return
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTasks(prev => prev.filter(t => t.id !== id))
      if (detailTask?.id === id) setDetailTask(null)
    }
  }

  function onSaved(saved: Task, isNew: boolean) {
    if (isNew) setTasks(prev => [saved, ...prev])
    else setTasks(prev => prev.map(t => t.id === saved.id ? saved : t))
    setShowProjectModal(false); setShowTodoModal(false); setEditTask(null)
  }

  function openEdit(t: Task) {
    setEditTask(t)
    if (t.projectName) setShowProjectModal(true)
    else setShowTodoModal(true)
  }

  // Can a user edit/delete an individual task?
  const canEditIndividual = (t: Task) => canEdit(currentUser.role) || t.createdBy === currentUser.id
  const canDeleteIndividual = (t: Task) => canDelete(currentUser.role) || t.createdBy === currentUser.id

  const showProject = sectionTab !== 'Tasks Individu'
  const showIndividual = sectionTab !== 'Tasks Project'

  return (
    <div className="max-w-7xl mx-auto animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-[var(--text-primary)]">Tasks</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {counts.inProgress} in progress · <span style={{ color: '#F59E0B' }}>{counts.deadlineAlert} deadline alert</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canBulkData(currentUser.role) && sectionTab !== 'Tasks Individu' && <ExcelToolbar type="tasks" label="Tasks Project" />}
          {canCreate(currentUser.role) && sectionTab !== 'Tasks Individu' && (
            <button onClick={() => { setEditTask(null); setShowProjectModal(true) }}
              style={{ background: '#FF6A1A', color: 'var(--on-accent)', border: 'none', borderRadius: '11px', padding: '9px 18px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={15} /> Buat Task
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: 'To Do', val: counts.todo, color: 'var(--text-muted)' },
          { label: 'In Progress', val: counts.inProgress, color: 'var(--blue)' },
          { label: 'Review', val: counts.review, color: '#F59E0B' },
          { label: 'Deadline Alert', val: counts.deadlineAlert, color: 'var(--red)' },
          { label: 'Selesai', val: counts.done, color: '#4ADE80' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', cursor: 'pointer' }}
            onClick={() => setStatusFilter(s.label === 'Selesai' ? 'Completed' : s.label === 'Review' ? 'Need Review' : s.label)}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>{s.label}</p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: s.color, fontFamily: "'Space Grotesk', sans-serif" }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Section tabs + search + status filter */}
      <div className="flex flex-col gap-3">
        {/* Section tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {SECTION_TABS.map(tab => (
            <button key={tab} onClick={() => setSectionTab(tab)}
              style={{ padding: '7px 16px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s', background: sectionTab === tab ? '#FF6A1A' : 'transparent', color: sectionTab === tab ? 'var(--on-accent)' : 'var(--text-muted)' }}>
              {tab}
            </button>
          ))}
        </div>
        {/* Search + status chips */}
        <div className="flex gap-3 flex-wrap">
          <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '11px', padding: '9px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari task, project, atau PIC..."
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '13px', width: '100%' }} />
          </div>
          {showDivFilter && (
            <select value={divFilter} onChange={e => setDivFilter(e.target.value)}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '11px', padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
              <option value="all">Semua Divisi</option>
              {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {STATUS_CHIPS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: '8px 12px', borderRadius: '9px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: `1px solid ${statusFilter === s ? 'rgba(255,106,26,0.4)' : 'var(--border)'}`, background: statusFilter === s ? 'rgba(255,106,26,0.12)' : 'transparent', color: statusFilter === s ? '#FF8A4C' : 'var(--text-secondary)' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tasks Project ── */}
      {showProject && (
        projectTasks.length > 0 ? (
          <TaskSection
            title="Tasks Project"
            subtitle="Task yang terkait dengan project aktif"
            tasks={projectTasks}
            showProject
            currentUser={currentUser}
            canEditFn={() => canEdit(currentUser.role)}
            canDeleteFn={() => canDelete(currentUser.role)}
            onDetail={setDetailTask}
            onEdit={openEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        ) : sectionTab === 'Tasks Project' ? (
          <EmptyState icon={<CheckSquare size={36} />} text="Tidak ada task project ditemukan" />
        ) : null
      )}

      {/* ── Tasks Individu ── */}
      {showIndividual && (
        <div>
          {/* Individu header with Add button for ALL roles */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <p className="font-grotesk font-semibold text-[15px] text-[var(--text-primary)]">
                Tasks Individu <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>({individualTasks.length})</span>
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '1px' }}>To-do list pribadi yang tidak terkait project</p>
            </div>
            <button onClick={() => { setEditTask(null); setShowTodoModal(true) }}
              style={{ background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.3)', color: '#93C5FD', borderRadius: '11px', padding: '8px 16px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={14} /> Tambah To Do
            </button>
          </div>

          {individualTasks.length > 0 ? (
            <TaskSection
              title=""
              subtitle=""
              tasks={individualTasks}
              showProject={false}
              currentUser={currentUser}
              canEditFn={(t) => canEditIndividual(t)}
              canDeleteFn={(t) => canDeleteIndividual(t)}
              onDetail={setDetailTask}
              onEdit={openEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              showTodoFields
            />
          ) : (
            <EmptyState icon={<ListTodo size={36} />} text="Belum ada to-do. Klik 'Tambah To Do' untuk mulai." />
          )}
        </div>
      )}

      {/* Detail panel */}
      {detailTask && (
        <TaskDetailPanel
          task={detailTask}
          currentUser={currentUser}
          allUsers={users.map(u => ({ id: u.id, fullName: u.fullName }))}
          canEditTask={detailTask.projectName ? canEdit(currentUser.role) : canEditIndividual(detailTask)}
          canDeleteTask={detailTask.projectName ? canDelete(currentUser.role) : canDeleteIndividual(detailTask)}
          onClose={() => setDetailTask(null)}
          onStatusChange={handleStatusChange}
          onEdit={() => openEdit(detailTask)}
          onDelete={() => handleDelete(detailTask.id)}
        />
      )}

      {/* Project task modal */}
      {showProjectModal && (
        <ProjectTaskModal
          task={editTask}
          projects={projects}
          divisions={divisions}
          users={users}
          currentUser={currentUser}
          onClose={() => { setShowProjectModal(false); setEditTask(null) }}
          onSaved={onSaved}
        />
      )}

      {/* Individual to-do modal */}
      {showTodoModal && (
        <TodoModal
          task={editTask}
          divisions={divisions}
          users={users}
          currentUser={currentUser}
          onClose={() => { setShowTodoModal(false); setEditTask(null) }}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)', borderRadius: '16px', padding: '50px 24px', textAlign: 'center' }}>
      <div style={{ color: 'var(--text-faint)', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{text}</p>
    </div>
  )
}

/* ── Shared task table section ──────────────────────── */
const COLS_WITH_PROJECT = '1fr 130px 80px 110px 85px 76px'
const COLS_NO_PROJECT   = '1fr 80px 110px 85px 76px'
const COLS_TODO         = '1fr 80px 110px 60px 85px 76px'

function TaskSection({ title, subtitle, tasks, showProject, currentUser, canEditFn, canDeleteFn, onDetail, onEdit, onDelete, onStatusChange, showTodoFields = false }: {
  title: string; subtitle: string; tasks: Task[]; showProject: boolean; showTodoFields?: boolean
  currentUser: { id: string; role: string }
  canEditFn: (t: Task) => boolean
  canDeleteFn: (t: Task) => boolean
  onDetail: (t: Task) => void
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onStatusChange: (t: Task, s: string) => void
}) {
  const cols = showTodoFields ? COLS_TODO : showProject ? COLS_WITH_PROJECT : COLS_NO_PROJECT
  const headers = showTodoFields
    ? ['Task', 'PIC', 'Status', '%', 'Due Date', '']
    : showProject
      ? ['Task', 'Project', 'PIC', 'Status', 'Due Date', '']
      : ['Task', 'PIC', 'Status', 'Due Date', '']

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
      {title && (
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface-subtle)' }}>
          <p className="font-grotesk font-bold text-[14px] text-[var(--text-primary)]">{title} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '4px' }}>({tasks.length})</span></p>
          {subtitle && <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '1px' }}>{subtitle}</p>}
        </div>
      )}
      <div className="hidden md:grid" style={{ gridTemplateColumns: cols, padding: '8px 16px', borderBottom: '1px solid var(--surface-hover)' }}>
        {headers.map(h => (
          <div key={h} style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
        ))}
      </div>
      <div>
        {tasks.map(t => {
          const isOverdue = t.isOverdue
          const nextStatus = STATUS_NEXT[t.status]
          const canE = canEditFn(t)
          const canD = canDeleteFn(t)
          return (
            <div key={t.id} style={{ borderBottom: '1px solid var(--surface-hover)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {/* Desktop */}
              <div className="hidden md:grid" style={{ gridTemplateColumns: cols, padding: '10px 16px', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => onDetail(t)}>
                {/* Task name */}
                <div style={{ minWidth: 0, paddingRight: '10px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: isDeadlineAlert(t) ? 'var(--red)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                  {t.description && (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description.split('\n')[0]}
                    </p>
                  )}
                  {showTodoFields && t.category && (
                    <span style={{ fontSize: '10px', background: 'rgba(74,158,255,0.1)', color: 'var(--blue)', borderRadius: '4px', padding: '1px 6px', marginTop: '3px', display: 'inline-block' }}>{t.category}</span>
                  )}
                </div>
                {/* Project column */}
                {showProject && !showTodoFields && (
                  <div style={{ minWidth: 0, paddingRight: '8px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.projectName ?? '—'}</p>
                  </div>
                )}
                {/* PIC */}
                <div style={{ minWidth: 0, paddingRight: '8px' }}>
                  {t.assignees?.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {t.assignees.slice(0, 2).map((a, i) => (
                        <span key={a.id} style={{ marginLeft: i > 0 ? '-5px' : 0 }}>
                          <AvatarChip name={a.fullName} url={a.avatarUrl} size={22} />
                        </span>
                      ))}
                      {t.assignees.length > 2 && <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '3px' }}>+{t.assignees.length - 2}</span>}
                    </div>
                  ) : t.picName ? (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.picName}</p>
                  ) : <span style={{ color: 'var(--text-faint)', fontSize: '11px' }}>—</span>}
                </div>
                {/* Status */}
                <div style={{ minWidth: 0, paddingRight: '8px' }}><StatusBadge status={isDeadlineAlert(t) ? 'Deadline Alert' : t.status} /></div>
                {/* Progress % (todo only) */}
                {showTodoFields && (
                  <div style={{ minWidth: 0, paddingRight: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>{t.progressPct ?? 0}%</span>
                  </div>
                )}
                {/* Due date */}
                <div style={{ minWidth: 0, paddingRight: '8px' }}>
                  <span style={{ fontSize: '11px', color: isDeadlineAlert(t) ? 'var(--red)' : 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace", whiteSpace: 'nowrap' }}>
                    {t.dueDate ? formatDate(t.dueDate, { day: 'numeric', month: 'short' }) : '—'}
                    {hasSpecificTime(t.dueDate) && (
                      <span style={{ marginLeft: '4px', opacity: 0.8 }}>{getTaskTime(t.dueDate)}</span>
                    )}
                  </span>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                  {nextStatus && t.status !== 'Completed' && t.status !== 'Done' && canEditStatus(currentUser.role) && (
                    <button onClick={() => onStatusChange(t, nextStatus)} title={`→ ${nextStatus}`}
                      style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '6px', padding: '4px 5px', cursor: 'pointer', color: '#4ADE80', display: 'flex' }}>
                      <CheckCircle size={11} />
                    </button>
                  )}
                  {canE && (
                    <button onClick={() => onEdit(t)}
                      style={{ background: 'var(--border)', border: 'none', borderRadius: '6px', padding: '4px 5px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                      <Pencil size={10} />
                    </button>
                  )}
                  {canD && (
                    <button onClick={() => onDelete(t.id)}
                      style={{ background: 'rgba(255,107,107,0.08)', border: 'none', borderRadius: '6px', padding: '4px 5px', cursor: 'pointer', color: 'var(--red)', display: 'flex' }}>
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile */}
              <div className="md:hidden" style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => onDetail(t)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: isDeadlineAlert(t) ? 'var(--red)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.projectName ?? t.category ?? t.divisionName ?? '—'}
                      {t.picName && <> · <span style={{ color: 'var(--text-secondary)' }}>{t.picName}</span></>}
                    </p>
                  </div>
                  <StatusBadge status={isDeadlineAlert(t) ? 'Deadline Alert' : t.status} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <PriorityBadge priority={t.priority} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                    {t.dueDate ? formatDate(t.dueDate, { day: 'numeric', month: 'short' }) : '—'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function renderLogNote(text: string): React.ReactNode[] {
  const URL_RE = /(https?:\/\/[^\s]+)/g
  return text.split(URL_RE).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        style={{ color: 'var(--blue)', textDecoration: 'underline', wordBreak: 'break-all' }}>
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

/* ── Task Detail Panel ──────────────────────────────── */
function TaskDetailPanel({ task, currentUser, canEditTask, canDeleteTask, onClose, onStatusChange, onEdit, onDelete, allUsers }: {
  task: Task; currentUser: { id: string; role: string }
  canEditTask: boolean; canDeleteTask: boolean
  allUsers: { id: string; fullName: string }[]
  onClose: () => void
  onStatusChange: (t: Task, s: string) => void
  onEdit: () => void; onDelete: () => void
}) {
  const [logs, setLogs] = useState<ProgressLog[]>([])
  const [note, setNote] = useState('')
  const [posting, setPosting] = useState(false)
  const [statusEdit, setStatusEdit] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const mentionMatches = allUsers.filter(u =>
    u.id !== currentUser.id &&
    u.fullName.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 6)

  function handleNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setNote(val)
    const cursor = e.target.selectionStart
    const before = val.slice(0, cursor)
    const match = before.match(/@(\w*)$/)
    if (match) { setMentionQuery(match[1]); setShowMentions(true) }
    else setShowMentions(false)
  }

  function insertMention(name: string) {
    const cursor = noteRef.current?.selectionStart ?? note.length
    const before = note.slice(0, cursor)
    const after = note.slice(cursor)
    const replaced = before.replace(/@(\w*)$/, `@${name.split(' ')[0]} `)
    setNote(replaced + after)
    setShowMentions(false)
    noteRef.current?.focus()
  }
  const isOverdue = task.isOverdue
  const isTodo = !task.projectName

  const loadLogs = useCallback(async () => {
    const res = await fetch(`/api/tasks/${task.id}/progress`)
    if (res.ok) setLogs(await res.json())
  }, [task.id])

  useEffect(() => { loadLogs() }, [loadLogs])

  async function submitProgress() {
    if (!note.trim()) return
    setPosting(true)
    const res = await fetch(`/api/tasks/${task.id}/progress`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }),
    })
    if (res.ok) { setNote(''); loadLogs() }
    setPosting(false)
  }

  async function changeStatus(newStatus: string) {
    await onStatusChange(task, newStatus)
    setStatusEdit(false)
  }

  function fmtLog(iso: string) {
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const statusList = isTodo ? TODO_STATUSES : STATUS_ALL

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border)', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              {isTodo && task.category && (
                <span style={{ fontSize: '10px', background: 'rgba(74,158,255,0.1)', color: 'var(--blue)', borderRadius: '4px', padding: '2px 7px', display: 'inline-block', marginBottom: '6px', fontFamily: "'IBM Plex Mono', monospace" }}>{task.category}</span>
              )}
              <h2 className="font-grotesk font-bold text-[15px]" style={{ color: isOverdue ? 'var(--red)' : 'var(--text-primary)', lineHeight: 1.35 }}>{task.name}</h2>
              {task.projectName && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>📁 {task.projectName}</p>}
            </div>
            <button onClick={onClose} style={{ background: 'var(--border)', border: 'none', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {/* Status */}
            <div style={{ background: 'var(--surface-subtle)', borderRadius: '10px', padding: '10px 12px' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>Status</p>
              {statusEdit ? (
                <select autoFocus value={task.status} onChange={e => changeStatus(e.target.value)} onBlur={() => setStatusEdit(false)}
                  style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,106,26,0.4)', borderRadius: '7px', color: 'var(--text-primary)', fontSize: '12px', padding: '3px 6px', outline: 'none', width: '100%' }}>
                  {statusList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: canEditStatus(currentUser.role) ? 'pointer' : 'default' }}
                  onClick={() => canEditStatus(currentUser.role) && setStatusEdit(true)}>
                  <StatusBadge status={isOverdue ? 'Overdue' : task.status} />
                  {canEditStatus(currentUser.role) && <Pencil size={10} style={{ color: 'var(--text-faint)' }} />}
                </div>
              )}
            </div>
            <div style={{ background: 'var(--surface-subtle)', borderRadius: '10px', padding: '10px 12px' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>Prioritas</p>
              <PriorityBadge priority={task.priority} />
            </div>
            <div style={{ background: 'var(--surface-subtle)', borderRadius: '10px', padding: '10px 12px' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>Due Date</p>
              <p style={{ fontSize: '12px', color: isOverdue ? 'var(--red)' : 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>
                {task.dueDate ? formatDate(task.dueDate, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
            {isTodo ? (
              <div style={{ background: 'var(--surface-subtle)', borderRadius: '10px', padding: '10px 12px' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>Progress</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, background: 'var(--border)', borderRadius: '100px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${task.progressPct ?? 0}%`, background: '#FF6A1A', borderRadius: '100px' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: '#FF8A4C', fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>{task.progressPct ?? 0}%</span>
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--surface-subtle)', borderRadius: '10px', padding: '10px 12px' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>Assignee</p>
                {task.assignees?.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {task.assignees.map(a => <span key={a.id} style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--border)', borderRadius: '5px', padding: '2px 6px' }}>{a.fullName}</span>)}
                  </div>
                ) : <p style={{ fontSize: '12px', color: task.picName ? 'var(--text-secondary)' : 'var(--text-faint)' }}>{task.picName ?? '—'}</p>}
              </div>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div style={{ background: 'var(--surface-subtle)', borderRadius: '10px', padding: '12px' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Deskripsi</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{task.description}</p>
            </div>
          )}

          {task.outputUrl && (
            <a href={task.outputUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: '10px', padding: '10px 14px', color: 'var(--blue)', fontSize: '13px', textDecoration: 'none' }}>
              <ExternalLink size={13} /> Lihat Output / Hasil
            </a>
          )}

          {/* Quick advance */}
          {STATUS_NEXT[task.status] && task.status !== 'Completed' && task.status !== 'Done' && canEditStatus(currentUser.role) && (
            <button onClick={() => onStatusChange(task, STATUS_NEXT[task.status]!)}
              style={{ width: '100%', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '11px', padding: '10px', cursor: 'pointer', color: '#4ADE80', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px' }}>
              Tandai: {STATUS_NEXT[task.status]} →
            </button>
          )}

          {/* Edit / Delete */}
          {(canEditTask || canDeleteTask) && (
            <div style={{ display: 'grid', gridTemplateColumns: canEditTask && canDeleteTask ? '1fr 1fr' : '1fr', gap: '8px' }}>
              {canEditTask && (
                <button onClick={onEdit}
                  style={{ background: 'var(--border)', border: '1px solid var(--border-strong)', borderRadius: '11px', padding: '9px', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                  <Pencil size={13} /> Edit
                </button>
              )}
              {canDeleteTask && (
                <button onClick={onDelete}
                  style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: '11px', padding: '9px', cursor: 'pointer', color: 'var(--red)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                  <Trash2 size={13} /> Hapus
                </button>
              )}
            </div>
          )}

          {/* Progress log */}
          <div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={12} /> Update Progress ({logs.length})
            </p>
            {logs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                {logs.map(log => (
                  <div key={log.id} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                      <AvatarChip name={log.user_name} url={log.avatar_url} size={20} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{log.user_name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: "'IBM Plex Mono', monospace", marginLeft: 'auto' }}>
                        {fmtLog(log.created_at)}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{renderLogNote(log.note)}</p>
                  </div>
                ))}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              {showMentions && mentionMatches.length > 0 && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: 'var(--bg-hover)', border: '1px solid var(--border-strong)', borderRadius: '12px', overflow: 'hidden', zIndex: 20, marginBottom: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sebut anggota</span>
                  </div>
                  {mentionMatches.map(u => (
                    <button key={u.id} onMouseDown={e => { e.preventDefault(); insertMention(u.fullName) }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,106,26,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{u.fullName}</span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <textarea ref={noteRef} value={note} onChange={handleNoteChange} placeholder="Tulis update progress… ketik @ untuk sebut user"
                  onKeyDown={e => { if (e.key === 'Escape') setShowMentions(false); if (e.key === 'Enter' && !e.shiftKey && !showMentions) { e.preventDefault(); submitProgress() } }}
                  style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'none', minHeight: '60px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                />
                <button onClick={submitProgress} disabled={posting || !note.trim()}
                  style={{ background: note.trim() ? '#FF6A1A' : 'rgba(255,106,26,0.2)', border: 'none', borderRadius: '10px', padding: '10px 12px', cursor: note.trim() ? 'pointer' : 'default', color: note.trim() ? 'var(--on-accent)' : 'var(--text-faint)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <Send size={14} />
                </button>
              </div>
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px' }}>Enter untuk kirim · Shift+Enter baris baru</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Individual To-Do Modal ─────────────────────────── */
function TodoModal({ task, divisions, users, currentUser, onClose, onSaved }: {
  task: Task | null
  divisions: { id: string; name: string }[]
  users: { id: string; fullName: string; avatarUrl: string | null; role: string }[]
  currentUser: { id: string; role: string; fullName: string }
  onClose: () => void
  onSaved: (t: Task, isNew: boolean) => void
}) {
  const isNew = !task
  const [form, setForm] = useState({
    name: task?.name ?? '',
    status: task?.status ?? 'To Do',
    priority: task?.priority ?? 'Medium',
    category: task?.category ?? 'Daily',
    progressPct: task?.progressPct ?? 0,
    dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
    dueTime: task?.dueDate ? getTaskTime(task.dueDate) : '',
    description: task?.description ?? '',
    divisionId: divisions[0]?.id ?? '',
    requester: task?.picName ?? currentUser.fullName,
  })
  const [requesterSearch, setRequesterSearch] = useState('')
  const [showRequesterDrop, setShowRequesterDrop] = useState(false)

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(requesterSearch.toLowerCase()) && requesterSearch.length > 0
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inp: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', width: '100%', fontFamily: "'Plus Jakarta Sans', sans-serif" }
  const lbl: React.CSSProperties = { fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600, display: 'block', marginBottom: '6px', fontFamily: "'Space Grotesk', sans-serif" }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Judul wajib diisi'); return }
    setLoading(true); setError(null)

    const url = isNew ? '/api/tasks' : `/api/tasks/${task!.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const dueDatetime = form.dueDate
      ? (form.dueTime
          ? new Date(`${form.dueDate}T${form.dueTime}`).toISOString()
          : new Date(form.dueDate).toISOString())
      : null
    const body = isNew
      ? {
          name: form.name, status: form.status, priority: form.priority,
          divisionId: form.divisionId,
          due_date: dueDatetime,
          description: form.description, category: form.category,
          progressPct: form.progressPct, assignees: [],
        }
      : {
          name: form.name, status: form.status, priority: form.priority,
          dueDate: dueDatetime,
          description: form.description, category: form.category,
          progressPct: form.progressPct,
        }

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}) as Record<string, unknown>)
    if (!res.ok) { setError((data.error as string) ?? 'Gagal menyimpan'); setLoading(false); return }

    const saved: Task = {
      id: (data.id as string) ?? task!.id,
      name: form.name, status: form.status, priority: form.priority,
      dueDate: dueDatetime ?? '',
      isOverdue: false, requiresApproval: false,
      description: form.description || null,
      outputUrl: task?.outputUrl ?? null, completedAt: task?.completedAt ?? null,
      projectName: null, divisionName: task?.divisionName ?? null,
      picId: null, picName: null,
      createdBy: task?.createdBy ?? currentUser.id,
      category: form.category, progressPct: form.progressPct,
      assignees: [],
    }
    onSaved(saved, isNew)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 py-8" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-xl rounded-2xl" style={{ background: '#0f1219', border: '1px solid var(--border-strong)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="font-grotesk font-bold text-[18px] text-[var(--text-primary)]">{isNew ? 'Tambah To Do' : 'Edit To Do'}</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>Isi detail to do agar task harian lebih jelas dan mudah dipantau.</p>
          </div>
          <button onClick={onClose} style={{ background: 'var(--border)', border: 'none', borderRadius: '9px', padding: '7px 9px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '9px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)' }}>{error}</div>}

          {/* Judul */}
          <div>
            <label style={lbl}>Judul To Do</label>
            <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Contoh: Finalisasi poster promo Sky" required />
          </div>

          {/* Row: Tanggal, Jam, Status, Priority */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label style={lbl}>Tanggal</label>
              <input style={inp} type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Jam <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(opsional)</span></label>
              <input style={inp} type="time" value={form.dueTime} onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {TODO_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Priority</label>
              <select style={inp} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Row: Category, Requester, Progress */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label style={lbl}>Category</label>
              <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ position: 'relative' }}>
              <label style={lbl}>Requester</label>
              <input
                style={inp}
                value={showRequesterDrop ? requesterSearch : form.requester}
                placeholder="Nama requester..."
                onChange={e => {
                  setRequesterSearch(e.target.value)
                  setForm(f => ({ ...f, requester: e.target.value }))
                  setShowRequesterDrop(true)
                }}
                onFocus={() => { setRequesterSearch(''); setShowRequesterDrop(true) }}
                onBlur={() => setTimeout(() => setShowRequesterDrop(false), 150)}
              />
              {showRequesterDrop && filteredUsers.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-hover)', border: '1px solid var(--border-strong)', borderRadius: '10px', zIndex: 50, maxHeight: '160px', overflowY: 'auto', marginTop: '4px' }}>
                  {filteredUsers.map(u => (
                    <div key={u.id}
                      onMouseDown={() => { setForm(f => ({ ...f, requester: u.fullName })); setShowRequesterDrop(false) }}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,106,26,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <AvatarChip name={u.fullName} url={u.avatarUrl} size={20} />
                      {u.fullName}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={lbl}>Progress (%)</label>
              <input style={inp} type="number" min="0" max="100" value={form.progressPct}
                onChange={e => setForm(f => ({ ...f, progressPct: Math.min(100, Math.max(0, Number(e.target.value))) }))} />
            </div>
          </div>

          {/* Deskripsi */}
          <div>
            <label style={lbl}>Deskripsi</label>
            <textarea style={{ ...inp, minHeight: '90px', resize: 'vertical' }} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Detail pekerjaan, kebutuhan file, brief singkat, link referensi, atau catatan khusus..." />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button type="button" onClick={onClose}
              style={{ padding: '10px 24px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>
              Batal
            </button>
            <button type="submit" disabled={loading}
              style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: loading ? 'rgba(255,106,26,0.5)' : '#FF6A1A', color: 'var(--on-accent)', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px' }}>
              {loading ? 'Menyimpan...' : isNew ? 'Simpan To Do' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Project Task Modal ─────────────────────────────── */
function ProjectTaskModal({ task, projects, divisions, users, currentUser, onClose, onSaved }: {
  task: Task | null
  projects: { id: string; name: string }[]
  divisions: { id: string; name: string }[]
  users: { id: string; fullName: string; avatarUrl: string | null; role: string }[]
  currentUser: { id: string; role: string }
  onClose: () => void
  onSaved: (t: Task, isNew: boolean) => void
}) {
  const isNew = !task
  const [form, setForm] = useState({
    name: task?.name ?? '', projectId: '', divisionId: '',
    status: task?.status ?? 'To Do', priority: task?.priority ?? 'Medium',
    dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
    description: task?.description ?? '', outputUrl: task?.outputUrl ?? '',
  })
  // Initialize assignees from existing task assignees (for edit mode)
  const [assignees, setAssignees] = useState<string[]>(task?.assignees?.map(a => a.id) ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputS: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', width: '100%', fontFamily: "'Plus Jakarta Sans', sans-serif" }
  const labelS: React.CSSProperties = { fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || (!task && !form.divisionId) || !form.dueDate) {
      setError('Nama task, divisi, dan due date wajib diisi'); return
    }
    setLoading(true); setError(null)
    const url = isNew ? '/api/tasks' : `/api/tasks/${task!.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const body = isNew
      ? { ...form, due_date: new Date(form.dueDate).toISOString(), assignees }
      : { name: form.name, status: form.status, priority: form.priority, dueDate: form.dueDate, description: form.description, outputUrl: form.outputUrl, assignees }

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}) as Record<string, unknown>)
    if (!res.ok) { setError((data.error as string) ?? 'Gagal menyimpan'); setLoading(false); return }

    const updatedAssignees = assignees.map(uid => {
      const u = users.find(x => x.id === uid)
      return { id: uid, fullName: u?.fullName ?? uid, avatarUrl: u?.avatarUrl ?? null }
    })
    const saved: Task = {
      id: data.id ?? task!.id,
      name: form.name, priority: form.priority, status: form.status,
      dueDate: new Date(form.dueDate).toISOString(),
      isOverdue: false, requiresApproval: false,
      description: form.description || null,
      outputUrl: form.outputUrl || null, completedAt: task?.completedAt ?? null,
      projectName: task?.projectName ?? null, divisionName: task?.divisionName ?? null,
      picId: task?.picId ?? null, picName: task?.picName ?? null,
      createdBy: task?.createdBy ?? null, category: null, progressPct: null,
      assignees: updatedAssignees,
    }
    onSaved(saved, isNew)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 py-8" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-grotesk font-bold text-[16px] text-[var(--text-primary)]">{isNew ? 'Buat Task' : 'Edit Task'}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '9px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)' }}>{error}</div>}
          <div>
            <label style={labelS}>Nama Task *</label>
            <input style={inputS} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Deskripsi singkat task" required />
          </div>
          {isNew && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelS}>Divisi *</label>
                <select style={inputS} value={form.divisionId} onChange={e => setForm(f => ({ ...f, divisionId: e.target.value }))} required>
                  <option value="">— Pilih —</option>
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelS}>Project (opsional)</label>
                <select style={inputS} value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
                  <option value="">— Tidak ada —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelS}>Status</label>
              <select style={inputS} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUS_ALL.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelS}>Prioritas</label>
              <select style={inputS} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelS}>Due Date *</label>
            <input style={inputS} type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} required />
          </div>
          <div>
            <label style={labelS}>Deskripsi / Target</label>
            <textarea style={{ ...inputS, minHeight: '80px', resize: 'vertical' }} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detail pekerjaan yang harus dilakukan..." />
          </div>
          <div>
            <label style={labelS}>Link Output</label>
            <input style={inputS} type="url" value={form.outputUrl}
              onChange={e => setForm(f => ({ ...f, outputUrl: e.target.value }))} placeholder="https://drive.google.com/..." />
          </div>
          {/* Assignee — shown for both create and edit */}
          <div>
            <label style={labelS}>Assignee</label>
            <select style={inputS} value="" onChange={e => { if (e.target.value && !assignees.includes(e.target.value)) setAssignees(a => [...a, e.target.value]) }}>
              <option value="">— Pilih anggota —</option>
              {users.filter(u => !assignees.includes(u.id)).map(u => (
                <option key={u.id} value={u.id}>{u.fullName} — {ROLE_LABELS[u.role] ?? u.role}</option>
              ))}
            </select>
            {assignees.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {assignees.map(uid => {
                  const u = users.find(x => x.id === uid)
                  return u ? (
                    <span key={uid} style={{ fontSize: '12px', background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.25)', color: 'var(--blue)', padding: '2px 10px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {u.fullName}
                      <button type="button" onClick={() => setAssignees(a => a.filter(x => x !== uid))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', padding: 0, display: 'flex' }}><X size={10} /></button>
                    </span>
                  ) : null
                })}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'var(--border)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', borderRadius: '10px', padding: '11px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>Batal</button>
            <button type="submit" disabled={loading} style={{ flex: 2, background: loading ? 'rgba(255,106,26,0.5)' : '#FF6A1A', border: 'none', color: 'var(--on-accent)', borderRadius: '10px', padding: '11px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px' }}>
              {loading ? 'Menyimpan...' : isNew ? 'Buat Task' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
