'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[App Error]', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', background: '#0C0F16',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px', textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'rgba(255,107,107,0.12)',
        border: '1px solid rgba(255,107,107,0.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 24,
      }}>
        ⚠️
      </div>
      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '0.14em', color: '#FF6B6B', textTransform: 'uppercase', marginBottom: 12 }}>
        Terjadi Kesalahan
      </p>
      <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 28, color: '#EDF0F5', margin: '0 0 12px' }}>
        Sesuatu tidak berjalan dengan benar
      </h1>
      <p style={{ color: '#6B7385', fontSize: 14, maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
        {error.digest ? `Error ID: ${error.digest}` : 'Silakan coba lagi atau hubungi administrator.'}
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={reset} style={{
          background: '#FF6A1A', color: '#fff', border: 'none',
          padding: '10px 24px', borderRadius: 12,
          fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 14,
          cursor: 'pointer',
        }}>
          Coba Lagi
        </button>
        <a href="/dashboard" style={{
          background: 'rgba(255,255,255,0.06)', color: '#A5AEC0', border: '1px solid rgba(255,255,255,0.1)',
          padding: '10px 24px', borderRadius: 12,
          fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 14,
          textDecoration: 'none',
        }}>
          Dashboard
        </a>
      </div>
    </div>
  )
}