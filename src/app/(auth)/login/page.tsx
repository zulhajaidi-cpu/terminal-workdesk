'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Username/email atau password salah. Coba lagi.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(900px 600px at 50% -100px, rgba(255,106,26,.16), transparent 60%), #07090d' }}>

      {/* Top accent line */}
      <div className="fixed top-0 left-0 right-0 h-[3px]"
        style={{ background: 'linear-gradient(90deg,#E2540A,#FF6A1A,#FF8A4C,#FF6A1A,#E2540A)' }} />

      <div className="w-full max-w-[400px] animate-fade-in">
        {/* Logo & header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6"
            style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.16em', color: '#FF8A4C', background: 'rgba(255,106,26,0.1)', border: '1px solid rgba(255,106,26,0.25)', padding: '6px 14px', borderRadius: '100px', textTransform: 'uppercase' }}>
            <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: '#FF6A1A' }} />
            Terminal Workdesk · v2.1
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '28px', color: '#F4F6FA', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Selamat datang kembali
          </h1>
          <p style={{ color: '#A5AEC0', fontSize: '14px' }}>
            Masuk ke workdesk Department Terminal GODA
          </p>
        </div>

        {/* Form card */}
        <div style={{ background: '#10141d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '32px' }}>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.06em', color: '#6B7385', textTransform: 'uppercase' }}>
                Username atau Email
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                placeholder="username atau nama@goda.id"
                style={{
                  background: '#141925', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px',
                  padding: '12px 14px', color: '#EDF0F5', fontSize: '14px', outline: 'none', width: '100%',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,106,26,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.06em', color: '#6B7385', textTransform: 'uppercase' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  background: '#141925', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px',
                  padding: '12px 14px', color: '#EDF0F5', fontSize: '14px', outline: 'none', width: '100%',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,106,26,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '9px', padding: '10px 14px', fontSize: '13px', color: '#FF6B6B' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? 'rgba(255,106,26,0.5)' : '#FF6A1A',
                color: '#0C0F16', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '15px',
                padding: '13px', borderRadius: '11px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 14px 30px -12px rgba(255,106,26,0.8)',
                transition: 'all 0.2s', marginTop: '4px', width: '100%',
              }}
            >
              {loading ? 'Memproses...' : 'Masuk ke Workdesk →'}
            </button>
          </form>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '24px', paddingTop: '18px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#6B7385' }}>
              Belum punya akun? Hubungi Super Admin untuk mendapatkan akses.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: '24px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#4a5160', letterSpacing: '0.04em' }}>
          © 2026 Department Terminal GODA · Internal Use Only
        </p>
      </div>
    </div>
  )
}
