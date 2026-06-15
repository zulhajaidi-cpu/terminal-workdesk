'use client'

import { useEffect } from 'react'

// global-error menggantikan root layout — wajib sertakan <html> dan <body>
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Error]', error)
  }, [error])

  return (
    <html lang="id">
      <body style={{ margin: 0, background: '#0C0F16' }}>
        <div style={{
          minHeight: '100vh',
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
            💥
          </div>
          <p style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.14em', color: '#FF6B6B', textTransform: 'uppercase', marginBottom: 12 }}>
            Kesalahan Kritis
          </p>
          <h1 style={{ fontFamily: 'sans-serif', fontWeight: 700, fontSize: 28, color: '#EDF0F5', margin: '0 0 12px' }}>
            Aplikasi mengalami masalah
          </h1>
          <p style={{ color: '#6B7385', fontSize: 14, maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
            Terjadi kesalahan yang tidak terduga. Tim teknis telah diberitahu.
          </p>
          <button onClick={reset} style={{
            background: '#FF6A1A', color: '#fff', border: 'none',
            padding: '10px 24px', borderRadius: 12,
            fontFamily: 'sans-serif', fontWeight: 600, fontSize: 14,
            cursor: 'pointer',
          }}>
            Muat Ulang
          </button>
        </div>
      </body>
    </html>
  )
}