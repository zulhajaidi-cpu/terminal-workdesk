'use client'

import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '11px',
  padding: '12px 14px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', width: '100%',
  fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'border-color 0.2s',
}
const labelStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.06em',
  color: 'var(--text-muted)', textTransform: 'uppercase',
}

// Jabatan yang boleh dipilih saat daftar (super_admin & spectator tidak termasuk — diatur admin).
const ROLE_CHOICES = [
  { value: 'staff', label: 'Staff' },
  { value: 'leader_divisi', label: 'SPV' },
  { value: 'spv_manager', label: 'Manager' },
  { value: 'head_director', label: 'Direktur' },
]

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9\s.]/g, '').replace(/\s+/g, '.').slice(0, 20)
}

export default function RegisterForm({ divisions }: { divisions: { id: string; name: string }[] }) {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [role, setRole] = useState('staff')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function onNameChange(v: string) {
    setFullName(v)
    if (!usernameTouched) setUsername(slugify(v))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!fullName.trim() || !username.trim()) { setError('Nama dan username wajib diisi'); return }
    if (!/^[a-z0-9._]{3,20}$/.test(username)) { setError('Username 3-20 karakter: huruf kecil, angka, titik, underscore'); return }
    if (password.length < 8) { setError('Password minimal 8 karakter'); return }
    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, username, password, role, divisionId: divisionId || null }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Gagal mendaftar. Coba lagi.')
      return
    }
    setDone(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(900px 600px at 50% -100px, rgba(255,106,26,.16), transparent 60%), #07090d' }}>

      <div className="fixed top-0 left-0 right-0 h-[3px]"
        style={{ background: 'linear-gradient(90deg,#E2540A,#FF6A1A,#FF8A4C,#FF6A1A,#E2540A)' }} />

      <div className="w-full max-w-[400px] animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6"
            style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.16em', color: '#FF8A4C', background: 'rgba(255,106,26,0.1)', border: '1px solid rgba(255,106,26,0.25)', padding: '6px 14px', borderRadius: '100px', textTransform: 'uppercase' }}>
            <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: '#FF6A1A' }} />
            Terminal Workdesk · v2.1
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '28px', color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            {done ? 'Pendaftaran terkirim' : 'Daftar akun tim'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {done ? 'Tinggal selangkah lagi' : 'Untuk anggota Department Terminal GODA'}
          </p>
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '18px', padding: '32px' }}>
          {done ? (
            <div className="flex flex-col items-center text-center gap-3">
              <CheckCircle2 size={44} color="#3FD08A" />
              <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
                Akunmu menunggu persetujuan admin
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Setelah Super Admin menyetujui, kamu bisa langsung login pakai <strong style={{ color: 'var(--text-secondary)' }}>@{username}</strong> dan password tadi.
              </p>
              <a href="/login"
                style={{ marginTop: '8px', width: '100%', display: 'block', textAlign: 'center', background: '#FF6A1A', color: 'var(--on-accent)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: '11px', textDecoration: 'none' }}>
                Ke halaman Masuk →
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label style={labelStyle}>Nama Lengkap</label>
                <input type="text" value={fullName} onChange={e => onNameChange(e.target.value)} required
                  placeholder="Nama lengkapmu" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,106,26,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label style={labelStyle}>Username</label>
                <input type="text" value={username}
                  onChange={e => { setUsernameTouched(true); setUsername(e.target.value.toLowerCase()) }}
                  required autoComplete="username" placeholder="huruf kecil, angka, titik" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,106,26,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>Dipakai untuk login. Contoh: budi.santoso</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label style={labelStyle}>Divisi</label>
                  <select value={divisionId} onChange={e => setDivisionId(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(255,106,26,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}>
                    <option value="">Tanpa Divisi</option>
                    {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label style={labelStyle}>Jabatan</label>
                  <select value={role} onChange={e => setRole(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(255,106,26,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}>
                    {ROLE_CHOICES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '-4px' }}>Divisi & jabatan akan diverifikasi admin sebelum disetujui.</span>

              <div className="flex flex-col gap-1.5">
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    required placeholder="Min. 8 karakter" style={{ ...inputStyle, paddingRight: '42px' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(255,106,26,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '9px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ background: loading ? 'rgba(255,106,26,0.5)' : '#FF6A1A', color: 'var(--on-accent)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '15px', padding: '13px', borderRadius: '11px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 14px 30px -12px rgba(255,106,26,0.8)', transition: 'all 0.2s', marginTop: '4px', width: '100%' }}>
                {loading ? 'Memproses...' : 'Daftar Sekarang'}
              </button>
            </form>
          )}

          {!done && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '24px', paddingTop: '18px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Sudah punya akun?{' '}
                <a href="/login" style={{ color: '#FF8A4C', fontWeight: 600 }}>Masuk →</a>
              </p>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
          © 2026 Department Terminal GODA · Internal Use Only
        </p>
      </div>
    </div>
  )
}
