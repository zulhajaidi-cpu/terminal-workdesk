'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDate, formatRupiah } from '@/lib/utils'
import { Card, CardBody } from '@/components/ui/card'
import { Badge, StatusBadge, PriorityBadge } from '@/components/ui/badge'
import { ProgressBar, getProgressColor } from '@/components/ui/progress-bar'
import { Avatar } from '@/components/ui/avatar'
import { ArrowLeft, Calendar, Users, DollarSign, ClipboardCheck, Check, Send, CheckCircle2, Clock, MessageSquare, ExternalLink, X as XIcon } from 'lucide-react'
import { canEditProject, canViewBudget } from '@/lib/roles'
import { ProjectComments } from './project-comments'

interface CommentRow {
  id: string; content: string; createdAt: string | Date
  userId: string; userName: string | null; userAvatar: string | null; userRole: string | null
}
interface Assignee { id: string; fullName: string; avatarUrl: string | null }
interface TaskItem {
  id: string; name: string; status: string; priority: string
  dueDate: string; isOverdue: boolean; checked: boolean; assignees: Assignee[]
  description: string | null; outputUrl: string | null
}
interface ProgressLog {
  id: string; note: string; created_at: string; user_name: string; avatar_url: string | null
}
interface ApprovalStep { stepOrder: number; approverRole: string; action: string; note: string | null; actedAt: string | null }

interface Props {
  project: {
    id: string; name: string; projectCode: string; status: string; priority: string
    progress: number; deadline: string; startDate: string; objective: string; deliverables: string
    isOverdue: boolean; approvalStatus: string | null; currentApprovalStep: number | null
    picId: string; budgetPlanned: number | null; budgetApproved: number | null; budgetActual: number | null
    notes: string | null; attachmentUrl: string | null
    divisionName: string | null; picName: string | null; picAvatar: string | null
    members: Array<{ userId: string; fullName: string | null; avatarUrl: string | null }>
    tasks: TaskItem[]
    approval: { id: string; status: string; currentStep: number; steps: ApprovalStep[] } | null
    taskStats: { total: number; done: number; progress: number }
  }
  currentUserRole: string
  currentUserId: string
  comments?: CommentRow[]
  projectMembers?: { id: string; fullName: string }[]
  allUsers?: { id: string; fullName: string }[]
  currentUser?: { id: string; fullName: string; avatarUrl: string | null; role: string }
}

const STEP_LABELS: Record<number, string> = { 1: 'SPV', 2: 'Manager', 3: 'Direktur' }
const ACTION_COLORS: Record<string, string> = {
  pending: '#6B7385', approve: '#3FD08A', reject: '#FF6B6B', revision: '#FFB489',
}

const PROJECT_STATUSES = ['Draft', 'Not Started', 'In Progress', 'Need Review', 'Revision', 'On Hold', 'Completed', 'Cancelled']

function renderWithLinks(text: string): React.ReactNode[] {
  const URL_RE = /(https?:\/\/[^\s]+)/g
  const parts = text.split(URL_RE)
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          style={{ color: '#4A9EFF', textDecoration: 'underline', wordBreak: 'break-all' }}
          onClick={e => e.stopPropagation()}>
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function AvatarChipSmall({ name, url }: { name: string; url: string | null }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <span title={name} style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,106,26,0.2)', border: '1px solid rgba(255,106,26,0.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#FF8A4C', flexShrink: 0, overflow: 'hidden' }}>
      {url ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </span>
  )
}

const TASK_STATUS_ALL = ['To Do', 'In Progress', 'Need Review', 'Revision', 'Completed', 'On Hold', 'Cancelled']

function TaskQuickModal({ task, allUsers, onClose, onTaskUpdated }: {
  task: TaskItem
  allUsers: { id: string; fullName: string }[]
  onClose: () => void
  onTaskUpdated: (updated: Partial<TaskItem>) => void
}) {
  const [logs, setLogs] = useState<ProgressLog[]>([])
  const [note, setNote] = useState('')
  const [posting, setPosting] = useState(false)
  const [localStatus, setLocalStatus] = useState(task.status)
  const [statusEdit, setStatusEdit] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mentionMatches = allUsers.filter(u =>
    u.fullName.toLowerCase().includes(mentionQuery.toLowerCase()) && mentionQuery.length >= 0
  ).slice(0, 6)

  useEffect(() => {
    fetch(`/api/tasks/${task.id}/progress`).then(r => r.ok ? r.json() : []).then(setLogs)
  }, [task.id])

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
    const cursor = textareaRef.current?.selectionStart ?? note.length
    const before = note.slice(0, cursor)
    const after = note.slice(cursor)
    const replaced = before.replace(/@(\w*)$/, `@${name.split(' ')[0]} `)
    setNote(replaced + after)
    setShowMentions(false)
    textareaRef.current?.focus()
  }

  async function submitProgress() {
    if (!note.trim() || posting) return
    setPosting(true)
    const res = await fetch(`/api/tasks/${task.id}/progress`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }),
    })
    if (res.ok) {
      setNote('')
      fetch(`/api/tasks/${task.id}/progress`).then(r => r.ok ? r.json() : []).then(setLogs)
    }
    setPosting(false)
  }

  async function changeStatus(newStatus: string) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) { setLocalStatus(newStatus); onTaskUpdated({ status: newStatus }); setStatusEdit(false) }
  }

  function fmtLog(iso: string) {
    return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB'
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: '440px', background: '#10141d', borderLeft: '1px solid rgba(255,255,255,0.08)', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#EDF0F5', lineHeight: 1.35, fontFamily: "'Space Grotesk', sans-serif" }}>{task.name}</h2>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#6B7385', display: 'flex', flexShrink: 0 }}>
              <XIcon size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px 12px' }}>
              <p style={{ fontSize: '10px', color: '#6B7385', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>Status</p>
              {statusEdit ? (
                <select autoFocus value={localStatus} onChange={e => changeStatus(e.target.value)} onBlur={() => setStatusEdit(false)}
                  style={{ background: '#141925', border: '1px solid rgba(255,106,26,0.4)', borderRadius: '7px', color: '#EDF0F5', fontSize: '12px', padding: '3px 6px', outline: 'none', width: '100%' }}>
                  {TASK_STATUS_ALL.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => setStatusEdit(true)}>
                  <StatusBadge status={localStatus} />
                </div>
              )}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px 12px' }}>
              <p style={{ fontSize: '10px', color: '#6B7385', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>Prioritas</p>
              <PriorityBadge priority={task.priority} />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px 12px' }}>
              <p style={{ fontSize: '10px', color: '#6B7385', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>Due Date</p>
              <p style={{ fontSize: '12px', color: task.isOverdue ? '#FF6B6B' : '#A5AEC0', fontFamily: "'IBM Plex Mono', monospace" }}>
                {task.dueDate ? formatDate(task.dueDate, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px 12px' }}>
              <p style={{ fontSize: '10px', color: '#6B7385', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>Assignee</p>
              {task.assignees.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {task.assignees.map(a => (
                    <span key={a.id} style={{ fontSize: '11px', color: '#A5AEC0', background: 'rgba(255,255,255,0.06)', borderRadius: '5px', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AvatarChipSmall name={a.fullName} url={a.avatarUrl} />
                      {a.fullName}
                    </span>
                  ))}
                </div>
              ) : <p style={{ fontSize: '12px', color: '#4a5160' }}>—</p>}
            </div>
          </div>

          {task.description && (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px' }}>
              <p style={{ fontSize: '10px', color: '#6B7385', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Deskripsi</p>
              <p style={{ fontSize: '13px', color: '#A5AEC0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{renderWithLinks(task.description)}</p>
            </div>
          )}

          {task.outputUrl && (
            <a href={task.outputUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: '10px', padding: '10px 14px', color: '#4A9EFF', fontSize: '13px', textDecoration: 'none' }}>
              <ExternalLink size={13} /> Lihat Output / Hasil
            </a>
          )}

          {/* Progress log */}
          <div>
            <p style={{ fontSize: '10px', color: '#6B7385', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={12} /> Update Progress ({logs.length})
            </p>
            {logs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                {logs.map(log => (
                  <div key={log.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                      <AvatarChipSmall name={log.user_name} url={log.avatar_url} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#EDF0F5' }}>{log.user_name}</span>
                      <span style={{ fontSize: '10px', color: '#4a5160', fontFamily: "'IBM Plex Mono', monospace", marginLeft: 'auto' }}>{fmtLog(log.created_at)}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#A5AEC0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{renderWithLinks(log.note)}</p>
                  </div>
                ))}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              {showMentions && mentionMatches.length > 0 && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#1a2030', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', zIndex: 20, marginBottom: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  <div style={{ padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '10px', color: '#4a5160', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sebut anggota</span>
                  </div>
                  {mentionMatches.map(u => (
                    <button key={u.id} onMouseDown={e => { e.preventDefault(); insertMention(u.fullName) }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,106,26,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <span style={{ fontSize: '13px', color: '#EDF0F5', fontWeight: 600 }}>{u.fullName}</span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <textarea ref={textareaRef} value={note} onChange={handleNoteChange} placeholder="Tulis update progress... ketik @ untuk sebut user"
                  onKeyDown={e => { if (e.key === 'Escape') setShowMentions(false); if (e.key === 'Enter' && !e.shiftKey && !showMentions) { e.preventDefault(); submitProgress() } }}
                  style={{ flex: 1, background: '#141925', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '9px 12px', color: '#EDF0F5', fontSize: '13px', outline: 'none', resize: 'none', minHeight: '60px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                />
                <button onClick={submitProgress} disabled={posting || !note.trim()}
                  style={{ background: note.trim() ? '#FF6A1A' : 'rgba(255,106,26,0.2)', border: 'none', borderRadius: '10px', padding: '10px 12px', cursor: note.trim() ? 'pointer' : 'default', color: note.trim() ? '#0C0F16' : '#4a5160', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <Send size={14} />
                </button>
              </div>
            </div>
            <p style={{ fontSize: '10px', color: '#4a5160', marginTop: '4px' }}>Enter untuk kirim · Shift+Enter baris baru</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProjectDetailContent({ project, currentUserRole, currentUserId, comments = [], projectMembers = [], allUsers = [], currentUser }: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskItem[]>(project.tasks ?? [])
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null)
  const [projectStatus, setProjectStatus] = useState(project.status)
  const [savingStatus, setSavingStatus] = useState(false)

  async function handleStatusChange(newStatus: string) {
    if (newStatus === projectStatus || savingStatus) return
    setSavingStatus(true)
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setSavingStatus(false)
    if (res.ok) { setProjectStatus(newStatus); router.refresh() }
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Gagal mengubah status') }
  }

  const total = tasks.length
  const done = tasks.filter(t => t.status === 'Completed').length
  const pct = total > 0 ? Math.round((done / total) * 100) : project.progress
  const atLeastOneChecked = total === 0 || tasks.some(t => t.checked)

  const isLeaderPlus = canEditProject(currentUserRole) // leader_divisi / spv_manager / super_admin
  const isPic = currentUserId === project.picId
  const underReview = projectStatus === 'Need Review'
  const isCompleted = projectStatus === 'Completed'
  const hasActivePendingApproval = !!project.approval && project.approval.status === 'Pending'
  const canSubmitResults = (isPic || isLeaderPlus || currentUserRole === 'head_director') && !isCompleted && !hasActivePendingApproval

  function canCheckTask(t: TaskItem) {
    return isLeaderPlus || isPic || t.assignees.some(a => a.id === currentUserId)
  }

  async function toggleCheck(t: TaskItem) {
    if (!canCheckTask(t) || underReview || isCompleted || busyTaskId) return
    const nextChecked = !t.checked
    setBusyTaskId(t.id)
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, checked: nextChecked } : x))
    const res = await fetch(`/api/tasks/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: nextChecked }),
    })
    setBusyTaskId(null)
    if (!res.ok) {
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, checked: t.checked } : x)) // revert
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Gagal memperbarui task')
    }
  }

  async function submitForApproval() {
    if (!atLeastOneChecked || submitting) return
    if (!confirm('Kirim hasil project ini untuk direview SPV → Manager → Direktur?')) return
    setSubmitting(true)
    const res = await fetch(`/api/projects/${project.id}/submit-approval`, { method: 'POST' })
    setSubmitting(false)
    if (res.ok) router.refresh()
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Gagal mengirim hasil project') }
  }

  const approval = project.approval
  const budgetRemaining = (project.budgetApproved ?? 0) - (project.budgetActual ?? 0)

  return (
    <div className="space-y-5 max-w-5xl mx-auto animate-fade-in">
      {/* Back + header */}
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-[#6B7385] hover:text-[#A5AEC0] text-[13px] mb-4 transition-colors">
          <ArrowLeft size={14} /> Kembali ke Projects
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] text-[#6B7385] tracking-widest">{project.projectCode}</span>
              {project.isOverdue && <Badge variant="red">Overdue</Badge>}
            </div>
            <h1 className="font-grotesk font-bold text-2xl text-[#EDF0F5] leading-tight">{project.name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge variant="ghost">{project.divisionName ?? '—'}</Badge>
              {isLeaderPlus ? (
                <select
                  value={projectStatus}
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={savingStatus}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px', padding: '3px 10px', fontSize: '12px', color: '#EDF0F5',
                    cursor: savingStatus ? 'wait' : 'pointer', outline: 'none',
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>
                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <StatusBadge status={projectStatus} />
              )}
              <PriorityBadge priority={project.priority} />
              {(project.approval?.status === 'Approved' || isCompleted) && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(63,208,138,0.12)', border: '1px solid rgba(63,208,138,0.35)', borderRadius: '100px', padding: '2px 10px', fontSize: '11px', fontWeight: 700, color: '#3FD08A', fontFamily: "'Space Grotesk', sans-serif" }}>
                  <CheckCircle2 size={11} /> Approved
                </span>
              )}
            </div>
          </div>
          <Link href={`/projects/${project.id}/edit`}
            className="self-start text-[13px] px-3.5 py-2 rounded-lg font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#A5AEC0' }}>
            Edit
          </Link>
        </div>
      </div>

      {/* Status banners */}
      {underReview && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(255,106,26,0.08)', border: '1px solid rgba(255,106,26,0.25)' }}>
          <Clock size={16} style={{ color: '#FF8A4C' }} />
          <span className="text-[13px] text-[#FFB489]">
            Hasil project sedang <strong>direview</strong> — menunggu {STEP_LABELS[approval?.currentStep ?? 0] ?? 'approver'}.
          </span>
        </div>
      )}
      {isCompleted && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(63,208,138,0.08)', border: '1px solid rgba(63,208,138,0.25)' }}>
          <CheckCircle2 size={16} style={{ color: '#3FD08A' }} />
          <span className="text-[13px] text-[#7FE3B2]">Project telah <strong>disetujui penuh & selesai</strong>.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progress (derived from checked tasks) */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-2">
                <span className="font-grotesk font-semibold text-[14px] text-[#EDF0F5]">Progress</span>
                <span className="font-grotesk font-bold text-xl" style={{ color: getProgressColor(pct) }}>{pct}%</span>
              </div>
              <ProgressBar value={pct} color={getProgressColor(pct)} height={8} />
              <p className="text-[12px] text-[#6B7385] mt-2">
                {total > 0
                  ? <><span style={{ color: '#3FD08A', fontWeight: 600 }}>{done}</span> dari {total} task berstatus Completed</>
                  : 'Belum ada task — progress mengikuti nilai manual'}
              </p>
            </CardBody>
          </Card>

          {/* Objective & Deliverables */}
          <Card>
            <CardBody className="space-y-4">
              <div>
                <div className="font-mono text-[10px] text-[#6B7385] tracking-widest uppercase mb-2">Objective</div>
                <p className="text-[13.5px] text-[#A5AEC0] leading-relaxed">{project.objective}</p>
              </div>
              <div>
                <div className="font-mono text-[10px] text-[#6B7385] tracking-widest uppercase mb-2">Deliverables</div>
                <p className="text-[13.5px] text-[#A5AEC0] leading-relaxed">{project.deliverables}</p>
              </div>
              {project.notes && (
                <div>
                  <div className="font-mono text-[10px] text-[#6B7385] tracking-widest uppercase mb-2">Catatan</div>
                  <p className="text-[13.5px] text-[#A5AEC0] leading-relaxed">{project.notes}</p>
                </div>
              )}
              {project.attachmentUrl && (
                <a href={project.attachmentUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#56A9E8] text-[13px] hover:underline">
                  📎 Lihat lampiran
                </a>
              )}
            </CardBody>
          </Card>

          {/* Tasks with check-off */}
          <Card>
            <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.06)]">
              <span className="font-grotesk font-semibold text-[14px] text-[#EDF0F5]">
                Tasks <span className="text-[#6B7385] font-normal">({done}/{total} Completed)</span>
              </span>
              <Link href="/tasks" className="text-[12px] text-[#FF8A4C] hover:underline">Buka di Tasks →</Link>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {tasks.length === 0 ? (
                <div className="p-6 text-center text-[#6B7385] text-sm">
                  Belum ada task di project ini. Tambahkan task agar progress bisa dihitung.
                </div>
              ) : tasks.map(t => {
                const editable = canCheckTask(t) && !underReview && !isCompleted
                return (
                  <div key={t.id} className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-lg"
                    onClick={() => setDetailTask(t)}>
                    {/* Toggle checked */}
                    <button onClick={e => { e.stopPropagation(); if (editable && busyTaskId !== t.id) toggleCheck(t) }} disabled={!editable || busyTaskId === t.id}
                      title={t.checked ? 'Hapus centang' : 'Centang task ini'}
                      style={{
                        width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                        border: `1.5px solid ${t.checked ? '#3FD08A' : 'rgba(255,255,255,0.18)'}`,
                        background: t.checked ? '#3FD08A' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: editable ? 'pointer' : 'not-allowed', opacity: busyTaskId === t.id ? 0.5 : 1,
                        transition: 'all 0.15s',
                      }}>
                      {t.checked && <Check size={13} strokeWidth={3} style={{ color: '#0C0F16' }} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-[#EDF0F5] truncate" style={{ textDecoration: t.checked ? 'line-through' : 'none', opacity: t.checked ? 0.6 : 1 }}>
                        {t.name}
                      </div>
                      {t.assignees.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {t.assignees.slice(0, 4).map(a => (
                            <Avatar key={a.id} name={a.fullName} size="xs" imageUrl={a.avatarUrl} />
                          ))}
                          <span className="text-[11px] text-[#6B7385] ml-1">
                            {t.assignees.map(a => a.fullName.split(' ')[0]).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                    <StatusBadge status={t.isOverdue && t.status !== 'Completed' ? 'Overdue' : t.status} />
                  </div>
                )
              })}
            </div>

            {/* Submit results */}
            {canSubmitResults && (
              <div className="p-4 border-t border-[rgba(255,255,255,0.06)]">
                <button onClick={submitForApproval} disabled={!atLeastOneChecked || submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-grotesk font-bold text-[14px] transition-all"
                  style={{
                    background: atLeastOneChecked && !submitting ? '#FF6A1A' : 'rgba(255,255,255,0.06)',
                    color: atLeastOneChecked && !submitting ? '#0C0F16' : '#6B7385',
                    cursor: atLeastOneChecked && !submitting ? 'pointer' : 'not-allowed',
                    boxShadow: atLeastOneChecked && !submitting ? '0 10px 25px -8px rgba(255,106,26,0.7)' : 'none',
                  }}>
                  <Send size={15} /> {submitting ? 'Mengirim...' : 'Kirim Hasil untuk Approval'}
                </button>
                {!atLeastOneChecked && total > 0 && (
                  <p className="text-[12px] text-[#6B7385] text-center mt-2">
                    Centang minimal 1 task untuk mengaktifkan pengiriman hasil.
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Approval timeline */}
          {approval && (
            <Card>
              <div className="p-4 border-b border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={15} className="text-[#FF8A4C]" />
                  <span className="font-grotesk font-semibold text-[14px] text-[#EDF0F5]">Review Hasil — Berjenjang</span>
                </div>
              </div>
              <CardBody className="space-y-3">
                {[1, 2, 3].map(step => {
                  const s = approval.steps?.find(x => x.stepOrder === step)
                  const action = s?.action ?? 'pending'
                  const isActive = approval.currentStep === step && approval.status === 'Pending'
                  return (
                    <div key={step} className="flex items-center gap-4 p-3 rounded-xl"
                      style={{ background: isActive ? 'rgba(255,106,26,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isActive ? 'rgba(255,106,26,0.25)' : 'rgba(255,255,255,0.05)'}` }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-grotesk font-bold text-[12px]"
                        style={{ background: ACTION_COLORS[action] + '22', color: ACTION_COLORS[action] }}>
                        {step}
                      </div>
                      <div className="flex-1">
                        <div className="text-[13px] text-[#EDF0F5] font-medium">{STEP_LABELS[step]}</div>
                        {s?.note && <div className="text-[11px] text-[#A5AEC0] mt-0.5">"{s.note}"</div>}
                      </div>
                      <Badge variant={action === 'approve' ? 'green' : action === 'reject' ? 'red' : action === 'revision' ? 'yellow' : 'ghost'}>
                        {action === 'approve' ? 'Disetujui' : action === 'reject' ? 'Ditolak' : action === 'revision' ? 'Revisi' : isActive ? 'Menunggu' : 'Belum'}
                      </Badge>
                    </div>
                  )
                })}
              </CardBody>
            </Card>
          )}
        </div>

        {/* Right: sidebar info */}
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-4">
              <div>
                <div className="font-mono text-[10px] text-[#6B7385] tracking-widest uppercase mb-1.5 flex items-center gap-1.5">
                  <Users size={11} /> PIC
                </div>
                <div className="flex items-center gap-2">
                  <Avatar name={project.picName ?? '?'} size="sm" imageUrl={project.picAvatar} />
                  <span className="text-[13px] text-[#EDF0F5]">{project.picName ?? '—'}</span>
                </div>
              </div>

              {project.members?.length > 0 && (
                <div>
                  <div className="font-mono text-[10px] text-[#6B7385] tracking-widest uppercase mb-1.5">Tim ({project.members.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {project.members.slice(0, 8).map(m => m.fullName && (
                      <div key={m.userId} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <Avatar name={m.fullName} size="xs" imageUrl={m.avatarUrl} />
                        <span className="text-[11px] text-[#A5AEC0]">{m.fullName.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="font-mono text-[10px] text-[#6B7385] tracking-widest uppercase mb-1.5 flex items-center gap-1.5">
                  <Calendar size={11} /> Timeline
                </div>
                <div className="text-[12px] text-[#A5AEC0] space-y-0.5">
                  <div>Mulai: {formatDate(project.startDate, { day: 'numeric', month: 'long' })}</div>
                  <div>Deadline: <span style={{ color: project.isOverdue ? '#FF6B6B' : '#EDF0F5' }}>
                    {formatDate(project.deadline, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span></div>
                </div>
              </div>
            </CardBody>
          </Card>

          {project.budgetPlanned !== null && canViewBudget(currentUserRole) && (
            <Card>
              <CardBody className="space-y-3">
                <div className="font-mono text-[10px] text-[#6B7385] tracking-widest uppercase flex items-center gap-1.5 mb-1">
                  <DollarSign size={11} /> Budget
                </div>
                {[
                  { label: 'Planned', value: project.budgetPlanned },
                  { label: 'Approved', value: project.budgetApproved },
                  { label: 'Actual', value: project.budgetActual },
                  { label: 'Remaining', value: budgetRemaining },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[12px] text-[#6B7385]">{label}</span>
                    <span className="font-mono text-[12px]"
                      style={{ color: label === 'Remaining' && budgetRemaining < 0 ? '#FF6B6B' : '#EDF0F5' }}>
                      {value !== null && value !== undefined ? formatRupiah(value) : '—'}
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Task quick-view modal (portal-free, fixed overlay) */}
      {detailTask && (
        <TaskQuickModal
          task={detailTask}
          allUsers={allUsers}
          onClose={() => setDetailTask(null)}
          onTaskUpdated={(updated) => {
            setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
            setDetailTask(prev => prev ? { ...prev, ...updated } : prev)
          }}
        />
      )}

      {/* Discussion / Comments */}
      {currentUser && (
        <ProjectComments
          projectId={project.id}
          initialComments={comments.map(c => ({
            id: c.id, content: c.content, createdAt: c.createdAt, userId: c.userId,
            userName: c.userName ?? 'Unknown', userAvatar: c.userAvatar ?? null, userRole: c.userRole ?? 'staff',
          }))}
          currentUser={currentUser}
          allUsers={allUsers.length > 0 ? allUsers : projectMembers}
        />
      )}
    </div>
  )
}
