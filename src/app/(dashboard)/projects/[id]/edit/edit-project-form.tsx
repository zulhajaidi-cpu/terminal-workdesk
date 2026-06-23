'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Info, Plus, X, Trash2 } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/roles'

interface ExistingTask {
  id: string; name: string; priority: string; dueDate: string
  assignees: { id: string; fullName: string }[]
}
interface TaskDraft {
  id: string; name: string; priority: string; dueDate: string; assignees: string[]
}

interface Props {
  project: {
    id: string; name: string; projectCode: string; divisionId: string
    projectType: string; objective: string; deliverables: string
    startDate: string; deadline: string; priority: string
    budgetPlanned: number | null; attachmentUrl: string | null; notes: string | null; status: string
  }
  divisions: { id: string; name: string }[]
  members: { id: string; fullName: string; role: string }[]
  existingTasks: ExistingTask[]
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px',
  padding: '11px 14px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', width: '100%',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
}
const labelStyle: React.CSSProperties = {
  fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace",
  letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px',
}
const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px',
}
const PROJECT_TYPES = ['General', 'Campaign', 'Event', 'Content', 'Branding', 'Digital', 'Retail', 'Lainnya']
const PROJECT_STATUSES = ['Draft', 'Not Started', 'In Progress', 'Need Review', 'Revision', 'On Hold', 'Completed', 'Cancelled']

export function EditProjectForm({ project, divisions, members, existingTasks: initialExistingTasks }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: project.name,
    projectType: project.projectType,
    objective: project.objective,
    deliverables: project.deliverables,
    startDate: project.startDate,
    deadline: project.deadline,
    priority: project.priority,
    status: project.status,
    budgetPlanned: project.budgetPlanned ? String(project.budgetPlanned) : '',
    attachmentUrl: project.attachmentUrl ?? '',
    notes: project.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Task management
  const [existingTasks, setExistingTasks] = useState<ExistingTask[]>(initialExistingTasks)
  const [tasksToDelete, setTasksToDelete] = useState<string[]>([])
  const [newTaskDrafts, setNewTaskDrafts] = useState<TaskDraft[]>([])

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })) }

  // Existing task: mark for deletion (hide from UI, queue DELETE on submit)
  function removeExistingTask(id: string) {
    setExistingTasks(prev => prev.filter(t => t.id !== id))
    setTasksToDelete(prev => [...prev, id])
  }

  // New task drafts
  function addTask() {
    setNewTaskDrafts(prev => [...prev, {
      id: crypto.randomUUID(), name: '', priority: 'Medium',
      dueDate: form.deadline, assignees: [],
    }])
  }
  function updateTask(id: string, key: string, val: string | string[]) {
    setNewTaskDrafts(prev => prev.map(t => t.id === id ? { ...t, [key]: val } : t))
  }
  function removeNewTask(id: string) {
    setNewTaskDrafts(prev => prev.filter(t => t.id !== id))
  }
  function toggleTaskAssignee(taskId: string, uid: string) {
    setNewTaskDrafts(prev => prev.map(t => {
      if (t.id !== taskId) return t
      const assignees = t.assignees.includes(uid)
        ? t.assignees.filter(x => x !== uid)
        : [...t.assignees, uid]
      return { ...t, assignees }
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.startDate || !form.deadline || !form.objective || !form.deliverables) {
      setError('Harap isi semua field wajib (*)'); return
    }
    const invalidTask = newTaskDrafts.find(t => !t.name.trim() || !t.dueDate)
    if (invalidTask) { setError('Nama task dan due date wajib diisi untuk semua task baru'); return }

    setLoading(true); setError(null)

    // 1. PATCH project details
    const patchRes = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, budgetPlanned: form.budgetPlanned ? Number(form.budgetPlanned) : null }),
    })
    if (!patchRes.ok) {
      const d = await patchRes.json()
      setError(d.error ?? 'Gagal menyimpan project')
      setLoading(false); return
    }

    // 2. Delete removed tasks (fire-and-forget errors non-fatal)
    if (tasksToDelete.length > 0) {
      await Promise.allSettled(
        tasksToDelete.map(tid => fetch(`/api/tasks/${tid}`, { method: 'DELETE' }))
      )
    }

    // 3. Create new task drafts
    if (newTaskDrafts.length > 0) {
      await Promise.allSettled(
        newTaskDrafts.map(t => fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: t.name,
            projectId: project.id,
            divisionId: project.divisionId,
            priority: t.priority,
            dueDate: t.dueDate,
            assignees: t.assignees,
          }),
        }))
      )
    }

    router.push(`/projects/${project.id}`)
    router.refresh()
  }

  const totalTaskCount = existingTasks.length + newTaskDrafts.length

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-16">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()}
          style={{ background: 'var(--border)', border: '1px solid var(--border)', borderRadius: '9px', padding: '7px 10px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={16} />
        </button>
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-[var(--text-primary)]">Edit Project</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: "'IBM Plex Mono', monospace" }}>{project.projectCode}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', color: 'var(--red)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Info size={15} />{error}
          </div>
        )}

        {/* Informasi Dasar */}
        <div style={sectionStyle}>
          <h2 className="font-grotesk font-bold text-[15px] text-[var(--text-primary)] mb-4">Informasi Dasar</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label style={labelStyle}>Nama Project *</label>
              <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Tipe Project</label>
              <select style={inputStyle} value={form.projectType} onChange={e => set('projectType', e.target.value)}>
                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status Project</label>
              <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
                {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Prioritas</label>
              <select style={inputStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
                {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Tujuan & Output */}
        <div style={sectionStyle}>
          <h2 className="font-grotesk font-bold text-[15px] text-[var(--text-primary)] mb-4">Tujuan & Output</h2>
          <div className="space-y-4">
            <div>
              <label style={labelStyle}>Objective *</label>
              <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.objective} onChange={e => set('objective', e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Deliverables *</label>
              <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.deliverables} onChange={e => set('deliverables', e.target.value)} required />
            </div>
          </div>
        </div>

        {/* Timeline & Anggaran */}
        <div style={sectionStyle}>
          <h2 className="font-grotesk font-bold text-[15px] text-[var(--text-primary)] mb-4">Timeline & Anggaran</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label style={labelStyle}>Tanggal Mulai *</label>
              <input style={inputStyle} type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Deadline *</label>
              <input style={inputStyle} type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Budget Rencana (Rp)</label>
              <input style={inputStyle} type="number" min="0" value={form.budgetPlanned} onChange={e => set('budgetPlanned', e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>

        {/* Tasks Project */}
        <div style={sectionStyle}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="font-grotesk font-bold text-[15px] text-[var(--text-primary)]">
                Tasks Project
                {totalTaskCount > 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px' }}>({totalTaskCount} task)</span>
                )}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Task yang dihapus akan langsung dihapus saat simpan. Task baru otomatis masuk ke halaman Tasks assignee.
              </p>
            </div>
            <button type="button" onClick={addTask}
              style={{ background: 'rgba(255,106,26,0.12)', border: '1px solid rgba(255,106,26,0.25)', color: '#FF8A4C', borderRadius: '9px', padding: '7px 14px', cursor: 'pointer', fontSize: '13px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
              <Plus size={13} /> Tambah Task
            </button>
          </div>

          {totalTaskCount === 0 && (
            <div style={{ border: '1px dashed var(--border-strong)', borderRadius: '12px', padding: '24px', textAlign: 'center', marginTop: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-faint)' }}>Belum ada task. Klik "+ Tambah Task" untuk menambahkan.</p>
            </div>
          )}

          <div className="space-y-3 mt-3">
            {/* Existing tasks from DB */}
            {existingTasks.map((task, idx) => (
              <div key={task.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '6px' }}>
                    Task {idx + 1}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--green)', background: 'rgba(63,208,138,0.08)', border: '1px solid rgba(63,208,138,0.2)', padding: '1px 8px', borderRadius: '6px' }}>tersimpan</span>
                  <button type="button" onClick={() => removeExistingTask(task.id)}
                    title="Hapus task ini"
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1">
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Nama Task</label>
                    <div style={{ ...inputStyle, color: 'var(--text-secondary)', cursor: 'default' }}>{task.name}</div>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Due Date</label>
                    <div style={{ ...inputStyle, color: 'var(--text-secondary)', cursor: 'default' }}>{task.dueDate || '—'}</div>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Prioritas</label>
                    <div style={{ ...inputStyle, color: 'var(--text-secondary)', cursor: 'default' }}>{task.priority}</div>
                  </div>
                </div>
                {task.assignees.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {task.assignees.map(a => (
                      <span key={a.id} style={{ fontSize: '12px', background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.2)', color: 'var(--blue)', padding: '2px 10px', borderRadius: '100px' }}>
                        {a.fullName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* New task drafts */}
            {newTaskDrafts.map((task, idx) => (
              <div key={task.id} style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,106,26,0.2)', borderRadius: '12px', padding: '16px' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '6px' }}>
                    Task baru {idx + 1}
                  </span>
                  <button type="button" onClick={() => removeNewTask(task.id)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1">
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Nama Task *</label>
                    <input style={inputStyle} value={task.name}
                      onChange={e => updateTask(task.id, 'name', e.target.value)}
                      placeholder="Contoh: Desain banner utama" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Due Date *</label>
                    <input style={inputStyle} type="date" value={task.dueDate}
                      onChange={e => updateTask(task.id, 'dueDate', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Prioritas</label>
                    <select style={inputStyle} value={task.priority}
                      onChange={e => updateTask(task.id, 'priority', e.target.value)}>
                      {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label style={{ ...labelStyle, marginBottom: '4px' }}>Assignee (Penangung Jawab Task)</label>
                  <select style={inputStyle} value="" onChange={e => { if (e.target.value) toggleTaskAssignee(task.id, e.target.value) }}>
                    <option value="">— Pilih assignee —</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.fullName} — {ROLE_LABELS[m.role] ?? m.role}</option>
                    ))}
                  </select>
                  {task.assignees.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {task.assignees.map(uid => {
                        const m = members.find(x => x.id === uid)
                        if (!m) return null
                        return (
                          <span key={uid} style={{ fontSize: '12px', background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.25)', color: 'var(--blue)', padding: '2px 10px 2px 8px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {m.fullName}
                            <button type="button" onClick={() => toggleTaskAssignee(task.id, uid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', padding: 0, display: 'flex' }}>
                              <X size={10} />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Informasi Tambahan */}
        <div style={sectionStyle}>
          <h2 className="font-grotesk font-bold text-[15px] text-[var(--text-primary)] mb-4">Informasi Tambahan</h2>
          <div className="space-y-4">
            <div>
              <label style={labelStyle}>Link Attachment / Brief</label>
              <input style={inputStyle} type="url" value={form.attachmentUrl} onChange={e => set('attachmentUrl', e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
            <div>
              <label style={labelStyle}>Catatan</label>
              <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            style={{ flex: 1, background: 'var(--border)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', borderRadius: '11px', padding: '12px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>
            Batal
          </button>
          <button type="submit" disabled={loading}
            style={{ flex: 2, background: loading ? 'rgba(255,106,26,0.5)' : '#FF6A1A', border: 'none', color: 'var(--on-accent)', borderRadius: '11px', padding: '12px', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px' }}>
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  )
}
