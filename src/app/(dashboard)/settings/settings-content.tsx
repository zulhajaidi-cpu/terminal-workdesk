'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/avatar'
import { Plus, Pencil, ToggleLeft, ToggleRight, Eye, EyeOff, Camera, User, Users, Globe, Moon, Sun } from 'lucide-react'
import { ROLE_LABELS, ROLE_COLORS, ROLE_OPTIONS } from '@/lib/roles'
import { uploadSquareImage } from '@/lib/upload-image'
import { getTheme, setTheme, type Theme } from '@/lib/theme'

interface UserRow {
  id: string; email: string; username: string | null; fullName: string; role: string
  isActive: boolean; pendingApproval?: boolean; avatarUrl: string | null; divisionId: string | null
  createdAt: string; divisionName: string | null
}
interface Me {
  id: string; email: string; fullName: string; avatarUrl: string | null
  bio: string | null; role: string; divisionId: string | null
}
interface Props {
  me: Me
  allUsers: UserRow[]
  divisions: { id: string; name: string }[]
  currentUser: { id: string; role: string }
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px',
  padding: '10px 12px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', width: '100%',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
}
const labelStyle: React.CSSProperties = {
  fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace",
  letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px',
}
const sectionCard: React.CSSProperties = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px',
}

type Tab = 'profile' | 'users' | 'appearance'

export function SettingsContent({ me, allUsers: initialUsers, divisions, currentUser }: Props) {
  const [tab, setTab] = useState<Tab>('profile')
  const [users, setUsers] = useState(initialUsers)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const router = useRouter()

  const TABS = [
    { key: 'profile', label: 'Profil Saya', icon: User },
    ...(currentUser.role === 'super_admin' ? [{ key: 'users', label: 'Kelola User', icon: Users }] : []),
    { key: 'appearance', label: 'Tampilan', icon: Moon },
  ] as { key: Tab; label: string; icon: any }[]

  async function toggleActive(user: UserRow) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    if (res.ok) setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u))
  }

  function onUserSaved(updated: UserRow, isNew: boolean) {
    if (isNew) setUsers(prev => [updated, ...prev])
    else setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
    setShowModal(false); setEditUser(null)
  }

  async function approveUser(user: UserRow) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true, pendingApproval: false }),
    })
    if (res.ok) setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: true, pendingApproval: false } : u))
  }

  async function rejectUser(user: UserRow) {
    if (!confirm(`Tolak & hapus pendaftaran "${user.fullName}" (@${user.username})?`)) return
    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    if (res.ok) setUsers(prev => prev.filter(u => u.id !== user.id))
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-5">
      <div>
        <h1 className="font-grotesk font-bold text-2xl text-[var(--text-primary)]">Settings</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Pengaturan akun dan tampilan</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ background: tab === t.key ? '#FF6A1A' : 'transparent', color: tab === t.key ? 'var(--on-accent)' : 'var(--text-muted)', border: 'none', borderRadius: '9px', padding: '8px 18px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
              <Icon size={13} />{t.label}
            </button>
          )
        })}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && <ProfileSection me={me} divisions={divisions} onSaved={() => router.refresh()} />}

      {/* User Management Tab (super_admin only) */}
      {tab === 'users' && currentUser.role === 'super_admin' && (
        <UserManagementSection
          users={users} divisions={divisions} currentUser={currentUser}
          onToggleActive={toggleActive}
          onApprove={approveUser}
          onReject={rejectUser}
          onEdit={u => { setEditUser(u); setShowModal(true) }}
          onAdd={() => { setEditUser(null); setShowModal(true) }}
        />
      )}

      {/* Appearance Tab */}
      {tab === 'appearance' && <AppearanceSection />}

      {showModal && (
        <UserModal
          user={editUser} divisions={divisions}
          onClose={() => { setShowModal(false); setEditUser(null) }}
          onSaved={onUserSaved}
        />
      )}
    </div>
  )
}

/* ── Profile Section ─────────────────────────────────── */
function ProfileSection({ me, divisions, onSaved }: { me: Me; divisions: { id: string; name: string }[]; onSaved: () => void }) {
  const [form, setForm] = useState({ fullName: me.fullName, bio: me.bio ?? '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(me.avatarUrl)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarErr, setAvatarErr] = useState<string | null>(null)

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingAvatar(true); setAvatarErr(null)
    try {
      const url = await uploadSquareImage(file, 'avatars', 256)
      const res = await fetch(`/api/users/${me.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: url }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Gagal menyimpan foto.') }
      setAvatarUrl(url)
      onSaved()
    } catch (err: any) {
      setAvatarErr(err?.message ?? 'Gagal mengunggah foto.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fullName.trim()) { setError('Nama tidak boleh kosong'); return }
    setSaving(true); setError(null)
    const res = await fetch(`/api/users/${me.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: form.fullName, bio: form.bio }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); onSaved() }
    else { const d = await res.json(); setError(d.error ?? 'Gagal menyimpan') }
  }

  return (
    <div className="space-y-4">
      {/* Avatar */}
      <div style={sectionCard}>
        <h2 className="font-grotesk font-bold text-[15px] text-[var(--text-primary)] mb-4">Foto Profil</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => !uploadingAvatar && fileRef.current?.click()}
            title="Ganti foto profil"
            style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: uploadingAvatar ? 'wait' : 'pointer' }}>
            <Avatar name={me.fullName} imageUrl={avatarUrl} size="xl" />
            <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#FF6A1A', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-base)' }}>
              <Camera size={13} style={{ color: 'var(--on-accent)' }} />
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: 'none' }} />
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>{me.fullName}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{ROLE_LABELS[me.role] ?? me.role}</p>
            {uploadingAvatar ? (
              <p style={{ fontSize: '12px', color: '#FF8A4C', marginTop: '8px' }}>Mengunggah foto…</p>
            ) : avatarErr ? (
              <p style={{ fontSize: '12px', color: 'var(--red)', marginTop: '8px' }}>{avatarErr}</p>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '8px' }}>
                Klik foto untuk mengganti. Otomatis dipotong persegi · maks 5MB.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <div style={sectionCard}>
        <h2 className="font-grotesk font-bold text-[15px] text-[var(--text-primary)] mb-4">Informasi Pribadi</h2>
        <form onSubmit={handleSave} className="space-y-4">
          {error && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '9px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)' }}>{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Nama Lengkap *</label>
              <input style={inputStyle} value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={{ ...inputStyle, color: 'var(--text-muted)', cursor: 'not-allowed' }} value={me.email} disabled />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Bio / Jabatan Lengkap</label>
            <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
              value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Contoh: Graphic Designer · Divisi Branding · Bergabung sejak 2024" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Role</label>
              <input style={{ ...inputStyle, color: 'var(--text-muted)', cursor: 'not-allowed' }} value={ROLE_LABELS[me.role] ?? me.role} disabled />
            </div>
            <div>
              <label style={labelStyle}>Divisi</label>
              <input style={{ ...inputStyle, color: 'var(--text-muted)', cursor: 'not-allowed' }}
                value={divisions.find(d => d.id === me.divisionId)?.name ?? '—'} disabled />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving}
              style={{ background: saved ? 'rgba(74,222,128,0.2)' : saving ? 'rgba(255,106,26,0.5)' : '#FF6A1A', border: saved ? '1px solid rgba(74,222,128,0.4)' : 'none', color: saved ? '#4ADE80' : 'var(--bg-base)', borderRadius: '10px', padding: '10px 24px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px' }}>
              {saved ? '✓ Tersimpan' : saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>

      <ChangePasswordSection />
    </div>
  )
}

/* ── Ganti Password Sendiri ──────────────────────────── */
function ChangePasswordSection() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (form.newPassword.length < 8) { setError('Password baru minimal 8 karakter'); return }
    if (form.newPassword !== form.confirmPassword) { setError('Konfirmasi password baru tidak cocok'); return }
    setSaving(true); setError(null)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } else {
      const d = await res.json(); setError(d.error ?? 'Gagal mengubah password')
    }
  }

  return (
    <div style={sectionCard}>
      <h2 className="font-grotesk font-bold text-[15px] text-[var(--text-primary)] mb-1">Ubah Password</h2>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Ganti password akunmu sendiri kapan saja</p>
      <form onSubmit={handleSave} className="space-y-4">
        {error && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '9px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)' }}>{error}</div>}
        <div>
          <label style={labelStyle}>Password Lama *</label>
          <input style={inputStyle} type="password" value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} required />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Password Baru *</label>
            <input style={inputStyle} type="password" value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} placeholder="Min. 8 karakter" required />
          </div>
          <div>
            <label style={labelStyle}>Konfirmasi Password Baru *</label>
            <input style={inputStyle} type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} required />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={saving}
            style={{ background: saved ? 'rgba(74,222,128,0.2)' : saving ? 'rgba(255,106,26,0.5)' : '#FF6A1A', border: saved ? '1px solid rgba(74,222,128,0.4)' : 'none', color: saved ? '#4ADE80' : 'var(--bg-base)', borderRadius: '10px', padding: '10px 24px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px' }}>
            {saved ? '✓ Password diganti' : saving ? 'Menyimpan...' : 'Ganti Password'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ── User Management Section ─────────────────────────── */
function UserManagementSection({ users, divisions, currentUser, onToggleActive, onApprove, onReject, onEdit, onAdd }: {
  users: UserRow[]; divisions: { id: string; name: string }[]
  currentUser: { id: string; role: string }
  onToggleActive: (u: UserRow) => void
  onApprove: (u: UserRow) => void
  onReject: (u: UserRow) => void
  onEdit: (u: UserRow) => void
  onAdd: () => void
}) {
  const [search, setSearch] = useState('')
  // Akun menunggu persetujuan tampil di antrean terpisah, bukan di tabel user utama.
  const pending = users.filter(u => u.pendingApproval)
  const active = users.filter(u => !u.pendingApproval)
  const filtered = active.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Antrean pendaftaran menunggu persetujuan */}
      {pending.length > 0 && (
        <div style={{ ...sectionCard, border: '1px solid rgba(255,106,26,0.35)', background: 'radial-gradient(120% 140% at 0% 0%, rgba(255,106,26,0.07) 0%, var(--bg-elevated) 55%)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#FF8A4C', fontFamily: "'Space Grotesk', sans-serif" }}>📝 Permintaan Pendaftaran</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--on-accent)', background: '#FF6A1A', borderRadius: '100px', padding: '2px 9px' }}>{pending.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pending.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                <Avatar name={u.fullName} imageUrl={u.avatarUrl} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{u.fullName}</p>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: ROLE_COLORS[u.role] ?? '#6B7385', background: `${ROLE_COLORS[u.role] ?? '#6B7385'}1F`, padding: '2px 8px', borderRadius: '100px' }}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    {u.divisionName && <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>· {u.divisionName}</span>}
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", marginTop: '2px' }}>@{u.username} · daftar {new Date(u.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                </div>
                <button onClick={() => onApprove(u)}
                  style={{ flexShrink: 0, fontSize: '12px', fontWeight: 700, color: '#fff', background: 'linear-gradient(90deg,#16a34a,#22c55e)', border: 'none', borderRadius: '9px', padding: '7px 13px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
                  ✓ Setujui
                </button>
                <button onClick={() => onReject(u)} title="Tolak & hapus"
                  style={{ flexShrink: 0, fontSize: '12px', fontWeight: 600, color: 'var(--red)', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '9px', padding: '7px 13px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
                  Tolak
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={sectionCard}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="font-grotesk font-bold text-[15px] text-[var(--text-primary)]">Kelola User</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{active.length} pengguna terdaftar</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama / email..."
              style={{ ...inputStyle, width: '200px', padding: '8px 12px', fontSize: '13px' }} />
            <button onClick={onAdd}
              style={{ background: '#FF6A1A', color: 'var(--on-accent)', border: 'none', borderRadius: '10px', padding: '9px 16px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
              <Plus size={14} /> Tambah User
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Pengguna', 'Role', 'Divisi', 'Status', 'Aksi'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--surface-hover)' }}>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <Avatar name={u.fullName} imageUrl={u.avatarUrl} size="sm" />
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{u.fullName}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.username ? `@${u.username}` : u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: ROLE_COLORS[u.role] ?? 'var(--text-muted)', background: `${ROLE_COLORS[u.role] ?? 'var(--text-muted)'}18`, padding: '3px 9px', borderRadius: '100px' }}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>{u.divisionName ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: u.isActive ? '#4ADE80' : 'var(--text-muted)', background: u.isActive ? 'rgba(74,222,128,0.1)' : 'rgba(107,115,133,0.1)', padding: '3px 9px', borderRadius: '100px' }}>
                      {u.isActive ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => onEdit(u)} title="Edit"
                        style={{ background: 'var(--border)', border: 'none', borderRadius: '7px', padding: '5px 7px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                        <Pencil size={12} />
                      </button>
                      {u.id !== currentUser.id && (
                        <button onClick={() => onToggleActive(u)}
                          style={{ background: 'var(--border)', border: 'none', borderRadius: '7px', padding: '5px 7px', cursor: 'pointer', color: u.isActive ? 'var(--red)' : '#4ADE80', display: 'flex' }}>
                          {u.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Tidak ada user ditemukan</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── Appearance Section ──────────────────────────────── */
function AppearanceSection() {
  const [theme, setThemeLocal] = useState<Theme>('dark')
  useEffect(() => {
    setThemeLocal(getTheme())
    const sync = () => setThemeLocal(getTheme())
    window.addEventListener('themechange', sync)
    return () => window.removeEventListener('themechange', sync)
  }, [])

  const modes = [
    { key: 'dark' as Theme, label: 'Dark Mode', desc: 'Tema gelap — fokus & low-light', icon: Moon },
    { key: 'light' as Theme, label: 'Light Mode', desc: 'Tema terang yang elegan', icon: Sun },
  ]

  return (
    <div className="space-y-4">
      <div style={sectionCard}>
        <h2 className="font-grotesk font-bold text-[15px] text-[var(--text-primary)] mb-1">Mode Tampilan</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Pilih tema yang nyaman untuk kamu — pilihan disimpan otomatis</p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {modes.map(m => {
            const active = theme === m.key
            const Icon = m.icon
            return (
              <button key={m.key} onClick={() => setTheme(m.key)}
                style={{ flex: '1 1 180px', textAlign: 'left', border: `1px solid ${active ? 'rgba(255,106,26,0.5)' : 'var(--border)'}`, borderRadius: '12px', padding: '16px', cursor: 'pointer', background: active ? 'rgba(255,106,26,0.06)' : 'transparent' }}>
                <Icon size={18} style={{ color: active ? '#FF6A1A' : 'var(--text-muted)', marginBottom: '8px' }} />
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>{m.label}</p>
                <p style={{ fontSize: '12px', color: active ? '#FF8A4C' : 'var(--text-muted)', marginTop: '3px' }}>{active ? 'Aktif saat ini' : m.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div style={sectionCard}>
        <h2 className="font-grotesk font-bold text-[15px] text-[var(--text-primary)] mb-1">Bahasa</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Pilih bahasa antarmuka</p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { key: 'id', label: 'Bahasa Indonesia', active: true },
            { key: 'zh', label: '中文 (Mandarin)', active: false },
          ].map(l => (
            <div key={l.key} style={{ flex: '1 1 180px', border: `1px solid ${l.active ? 'rgba(255,106,26,0.5)' : 'var(--border)'}`, borderRadius: '12px', padding: '16px', cursor: l.active ? 'default' : 'not-allowed', opacity: l.active ? 1 : 0.5, background: l.active ? 'rgba(255,106,26,0.06)' : 'transparent' }}>
              <Globe size={18} style={{ color: l.active ? '#FF6A1A' : 'var(--text-muted)', marginBottom: '8px' }} />
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>{l.label}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>{l.active ? 'Aktif saat ini' : 'Segera hadir'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── User Modal ──────────────────────────────────────── */
function UserModal({ user, divisions, onClose, onSaved }: {
  user: UserRow | null; divisions: { id: string; name: string }[]
  onClose: () => void; onSaved: (u: UserRow, isNew: boolean) => void
}) {
  const isNew = !user
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '', email: user?.email ?? '', username: user?.username ?? '',
    role: user?.role ?? 'staff', divisionId: user?.divisionId ?? '',
    password: '', isActive: user?.isActive ?? true,
  })
  const [usernameTouched, setUsernameTouched] = useState(!isNew)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)

  function slugify(name: string) {
    return name.toLowerCase().trim().replace(/[^a-z0-9\s.]/g, '').replace(/\s+/g, '.').slice(0, 20)
  }

  function onNameChange(value: string) {
    setForm(f => ({ ...f, fullName: value, username: usernameTouched ? f.username : slugify(value) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fullName || !form.username) { setError('Nama dan username wajib diisi'); return }
    if (!/^[a-z0-9._]{3,20}$/.test(form.username)) { setError('Username 3-20 karakter: huruf kecil, angka, titik, underscore'); return }
    if (isNew && !form.password) { setError('Password wajib diisi untuk user baru'); return }
    setLoading(true); setError(null)
    const body: Record<string, unknown> = { fullName: form.fullName, username: form.username, role: form.role, divisionId: form.divisionId || null, isActive: form.isActive }
    if (form.email.trim()) body.email = form.email
    if (form.password) body.password = form.password
    const url = isNew ? '/api/users' : `/api/users/${user!.id}`
    const res = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Gagal menyimpan'); setLoading(false); return }
    onSaved(data.user, isNew)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 py-8" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-md rounded-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-grotesk font-bold text-[16px] text-[var(--text-primary)]">{isNew ? 'Tambah User' : 'Edit User'}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
          {error && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '9px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)' }}>{error}</div>}
          <div>
            <label style={labelStyle}>Nama Lengkap *</label>
            <input style={inputStyle} value={form.fullName} onChange={e => onNameChange(e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Username *</label>
            <input style={inputStyle} value={form.username}
              onChange={e => { setUsernameTouched(true); setForm(f => ({ ...f, username: e.target.value.toLowerCase() })) }}
              placeholder="huruf kecil, angka, titik/underscore" required />
          </div>
          <div>
            <label style={labelStyle}>Email (opsional)</label>
            <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Kosongkan jika tidak ada" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Role *</label>
              <select style={inputStyle} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Divisi</label>
              <select style={inputStyle} value={form.divisionId} onChange={e => setForm(f => ({ ...f, divisionId: e.target.value }))}>
                <option value="">— Tidak ada —</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>{isNew ? 'Password *' : 'Password baru (kosongkan jika tidak berubah)'}</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inputStyle, paddingRight: '40px' }} type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={isNew ? 'Min. 8 karakter' : '••••••••'} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          {!isNew && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Status</label>
              <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))} style={{ color: form.isActive ? '#4ADE80' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                {form.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>
              <span style={{ fontSize: '13px', color: form.isActive ? '#4ADE80' : 'var(--text-muted)' }}>{form.isActive ? 'Aktif' : 'Non-Aktif'}</span>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'var(--border)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', borderRadius: '10px', padding: '11px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px' }}>Batal</button>
            <button type="submit" disabled={loading} style={{ flex: 2, background: loading ? 'rgba(255,106,26,0.5)' : '#FF6A1A', border: 'none', color: 'var(--on-accent)', borderRadius: '10px', padding: '11px', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px' }}>
              {loading ? 'Menyimpan...' : isNew ? 'Buat User' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
