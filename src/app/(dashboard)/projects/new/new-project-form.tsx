'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, X, Info, Trash2 } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/roles'

interface Props {
  divisions: { id: string; name: string }[]
  members: { id: string; fullName: string; role: string; divisionId: string | null }[]
  currentUser: { id: string; role: string; divisionId: string | null }
}

const inputStyle: React.CSSProperties = {
  background: '#141925', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
  padding: '11px 14px', color: '#EDF0F5', fontSize: '14px', outline: 'none', width: '100%',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
}
const labelStyle: React.CSSProperties = {
  fontSize: '11px', color: '#6B7385', fontFamily: "'IBM Plex Mono', monospace",
  letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px',
}
const sectionStyle: React.CSSProperties = {
  background: '#10141d', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px', padding: '24px',
}

const PROJECT_TYPES = ['General', 'Campaign', 'Event', 'Content', 'Branding', 'Digital', 'Retail', 'Lainnya']

interface TaskDraft {
  id: string; name: string; priority: string; dueDate: string
  description: string; assignees: string[]
}

export function NewProjectForm({ divisions, members, currentUser }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([currentUser.id])
  const [taskDrafts, setTaskDrafts] = useState<TaskDraft[]>([])

  const [form, setForm] = useState({
    name: '',
    divisionId: currentUser.divisionId ?? '',
    projectType: 'General',
    picId: currentUser.id,
    objective: '',
    deliverables: '',
    startDate: '',
    deadline: '',
    priority: 'Medium',
    budgetPlanned: '',
    attachmentUrl: '',
    notes: '',
  })

  function set(key: string, val: string | boolean) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function toggleMember(uid: string) {
    setSelectedMembers(prev =>
      prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]
    )
  }

  function addTask() {
    setTaskDrafts(prev => [...prev, {
      id: crypto.randomUUID(), name: '', priority: 'Medium',
      dueDate: form.deadline, description: '', assignees: [],
    }])
  }

  function updateTask(id: string, key: string, val: string | string[]) {
    setTaskDrafts(prev => prev.map(t => t.id === id ? { ...t, [key]: val } : t))
  }

  function removeTask(id: string) {
    setTaskDrafts(prev => prev.filter(t => t.id !== id))
  }

  function toggleTaskAssignee(taskId: string, uid: string) {
    setTaskDrafts(prev => prev.map(t => {
      if (t.id !== taskId) return t
      const assignees = t.assignees.includes(uid)
        ? t.assignees.filter(x => x !== uid)
        : [...t.assignees, uid]
      return { ...t, assignees }
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.divisionId || !form.startDate || !form.deadline || !form.objective || !form.deliverables) {
      setError('Harap isi semua field wajib (*)'); return
    }
    if (new Date(form.deadline) <= new Date(form.startDate)) {
      setError('Deadline harus setelah tanggal mulai'); return
    }
    const invalidTask = taskDrafts.find(t => !t.name.trim() || !t.dueDate)
    if (invalidTask) { setError('Nama task dan due date wajib diisi untuk semua task'); return }
    setLoading(true); setError(null)

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, members: selectedMembers, initialTasks: taskDrafts }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Gagal membuat project'); setLoading(false); return }
    router.push(`/projects/${data.id}`)
  }

  const availableMembers = members.filter(m => m.id !== currentUser.id)

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', padding: '7px 10px', cursor: 'pointer', color: '#A5AEC0', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={16} />
        </button>
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-[#EDF0F5]">Buat Project Baru</h1>
          <p className="text-[#6B7385] text-sm mt-0.5">Isi detail & task project — tersimpan sebagai Draft, hasilnya dikirim untuk review setelah semua task selesai</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', color: '#FF6B6B', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Info size={15} />{error}
          </div>
        )}

        {/* Section 1 — Info Dasar */}
        <div style={sectionStyle}>
          <h2 className="font-grotesk font-bold text-[15px] text-[#EDF0F5] mb-4">Informasi Dasar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label style={labelStyle}>Nama Project *</label>
              <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Contoh: Campaign Ramadan 2026 — Branding" required />
            </div>

            <div>
              <label style={labelStyle}>Divisi *</label>
              <select style={inputStyle} value={form.divisionId} onChange={e => set('divisionId', e.target.value)} required>
                <option value="">Pilih divisi</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Tipe Project</label>
              <select style={inputStyle} value={form.projectType} onChange={e => set('projectType', e.target.value)}>
                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>PIC (Penanggung Jawab) *</label>
              <select style={inputStyle} value={form.picId} onChange={e => set('picId', e.target.value)} required>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.fullName} — {ROLE_LABELS[m.role] ?? m.role}</option>
                ))}
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

        {/* Section 2 — Tujuan & Output */}
        <div style={sectionStyle}>
          <h2 className="font-grotesk font-bold text-[15px] text-[#EDF0F5] mb-4">Tujuan & Output</h2>
          <div className="space-y-4">
            <div>
              <label style={labelStyle}>Objective / Tujuan Project *</label>
              <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                value={form.objective} onChange={e => set('objective', e.target.value)}
                placeholder="Jelaskan tujuan utama project ini..." required />
            </div>
            <div>
              <label style={labelStyle}>Deliverables / Output yang Diharapkan *</label>
              <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                value={form.deliverables} onChange={e => set('deliverables', e.target.value)}
                placeholder="Contoh: 5 banner digital, 1 video 30 detik, konten sosmed 10 post..." required />
            </div>
          </div>
        </div>

        {/* Section 3 — Timeline & Budget */}
        <div style={sectionStyle}>
          <h2 className="font-grotesk font-bold text-[15px] text-[#EDF0F5] mb-4">Timeline & Anggaran</h2>
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
              <input style={inputStyle} type="number" min="0" value={form.budgetPlanned}
                onChange={e => set('budgetPlanned', e.target.value)}
                placeholder="0 jika belum ada" />
            </div>
          </div>
        </div>

        {/* Section 4 — Tim */}
        <div style={sectionStyle}>
          <h2 className="font-grotesk font-bold text-[15px] text-[#EDF0F5] mb-1">Anggota Tim</h2>
          <p style={{ fontSize: '12px', color: '#6B7385', marginBottom: '16px' }}>Kamu otomatis masuk sebagai anggota. Tambah anggota lain di bawah.</p>

          {/* Selected members chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedMembers.map(uid => {
              const m = members.find(x => x.id === uid)
              if (!m) return null
              return (
                <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,106,26,0.12)', border: '1px solid rgba(255,106,26,0.3)', borderRadius: '100px', padding: '4px 12px 4px 10px', fontSize: '13px', color: '#FF8A4C' }}>
                  {m.fullName}
                  {uid !== currentUser.id && (
                    <button type="button" onClick={() => toggleMember(uid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF6A1A', display: 'flex', padding: 0 }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add member dropdown */}
          <div>
            <label style={labelStyle}>Tambah Anggota</label>
            <select style={inputStyle} value="" onChange={e => { if (e.target.value) toggleMember(e.target.value) }}>
              <option value="">— Pilih anggota —</option>
              {availableMembers.filter(m => !selectedMembers.includes(m.id)).map(m => (
                <option key={m.id} value={m.id}>{m.fullName} — {ROLE_LABELS[m.role] ?? m.role}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Section 5 — Tasks */}
        <div style={sectionStyle}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="font-grotesk font-bold text-[15px] text-[#EDF0F5]">Tasks Project</h2>
              <p style={{ fontSize: '12px', color: '#6B7385', marginTop: '2px' }}>
                Opsional — tambahkan task yang akan otomatis masuk ke halaman Tasks
              </p>
            </div>
            <button type="button" onClick={addTask}
              style={{ background: 'rgba(255,106,26,0.12)', border: '1px solid rgba(255,106,26,0.25)', color: '#FF8A4C', borderRadius: '9px', padding: '7px 14px', cursor: 'pointer', fontSize: '13px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Plus size={13} /> Tambah Task
            </button>
          </div>

          {taskDrafts.length === 0 && (
            <div style={{ border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', textAlign: 'center', marginTop: '12px' }}>
              <p style={{ fontSize: '13px', color: '#4a5160' }}>Belum ada task. Klik "+ Tambah Task" untuk menambahkan.</p>
            </div>
          )}

          <div className="space-y-3 mt-3">
            {taskDrafts.map((task, idx) => (
              <div key={task.id} style={{ background: '#141925', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: '11px', color: '#6B7385', fontFamily: "'IBM Plex Mono', monospace", background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px' }}>
                    Task {idx + 1}
                  </span>
                  <button type="button" onClick={() => removeTask(task.id)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#FF6B6B', display: 'flex', alignItems: 'center' }}>
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
                          <span key={uid} style={{ fontSize: '12px', background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.25)', color: '#4A9EFF', padding: '2px 10px 2px 8px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {m.fullName}
                            <button type="button" onClick={() => toggleTaskAssignee(task.id, uid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A9EFF', padding: 0, display: 'flex' }}>
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

        {/* Section 6 — Tambahan */}
        <div style={sectionStyle}>
          <h2 className="font-grotesk font-bold text-[15px] text-[#EDF0F5] mb-4">Informasi Tambahan</h2>
          <div className="space-y-4">
            <div>
              <label style={labelStyle}>Link Attachment / Brief (Google Drive / URL)</label>
              <input style={inputStyle} type="url" value={form.attachmentUrl}
                onChange={e => set('attachmentUrl', e.target.value)}
                placeholder="https://drive.google.com/..." />
            </div>
            <div>
              <label style={labelStyle}>Catatan Tambahan</label>
              <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Hal lain yang perlu diketahui tim..." />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div style={{ background: '#10141d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Flow info */}
          <div style={{ background: 'rgba(255,106,26,0.08)', border: '1px solid rgba(255,106,26,0.2)', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <Info size={15} style={{ color: '#FF8A4C', marginTop: '2px', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: '#FF8A4C', lineHeight: 1.6 }}>
              Project dibuat sebagai <strong>Draft</strong>. Task akan otomatis masuk ke halaman Tasks tiap anggota. Setelah semua task dikerjakan & dicentang <em>selesai</em>, kirim <strong>hasilnya</strong> untuk direview <strong>SPV → Manager → Direktur</strong> dari halaman detail project.
            </p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()}
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#A5AEC0', borderRadius: '11px', padding: '12px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>
              Batal
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 2, background: loading ? 'rgba(255,106,26,0.5)' : '#FF6A1A', border: 'none', color: '#0C0F16', borderRadius: '11px', padding: '12px', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px', boxShadow: loading ? 'none' : '0 10px 25px -8px rgba(255,106,26,0.7)' }}>
              {loading ? 'Menyimpan...' : 'Buat Project (Draft) →'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
