import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px', textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'rgba(255,106,26,0.12)',
        border: '1px solid rgba(255,106,26,0.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 24,
      }}>
        🗺️
      </div>
      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '0.14em', color: '#FF6A1A', textTransform: 'uppercase', marginBottom: 12 }}>
        404 — Halaman Tidak Ditemukan
      </p>
      <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 28, color: 'var(--text-primary)', margin: '0 0 12px' }}>
        Halaman ini tidak ada
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
        URL yang kamu akses tidak ditemukan atau sudah dipindahkan.
      </p>
      <Link href="/dashboard" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#FF6A1A', color: '#fff',
        padding: '10px 24px', borderRadius: 12,
        fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 14,
        textDecoration: 'none',
      }}>
        ← Kembali ke Dashboard
      </Link>
    </div>
  )
}