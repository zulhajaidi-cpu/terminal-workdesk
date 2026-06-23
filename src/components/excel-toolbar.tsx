'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FileDown, FileUp, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

type ExcelEntity = 'projects' | 'tasks' | 'kpi'

interface ImportResult {
  inserted: number; updated: number; skipped: number; total: number
  errors: { row: number; message: string }[]
}

export function ExcelToolbar({ type, label }: { type: ExcelEntity; label: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  function download(action: 'template' | 'export') {
    window.open(`/api/excel/${action}?type=${type}`, '_blank')
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setErrMsg(null); setResult(null)
    const fd = new FormData()
    fd.append('type', type)
    fd.append('file', file)
    try {
      const res = await fetch('/api/excel/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data.error ?? 'Gagal import'); }
      else { setResult(data); router.refresh() }
    } catch {
      setErrMsg('Terjadi kesalahan saat mengunggah file')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const btn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 13px', borderRadius: '10px',
    fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
    border: '1px solid var(--border-strong)', background: 'var(--surface-hover)', color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={() => download('template')} style={btn} title="Unduh template kolom kosong">
          <FileSpreadsheet size={14} style={{ color: 'var(--blue)' }} /> Template
        </button>
        <button onClick={() => download('export')} style={btn} title="Download semua data sebagai Excel">
          <FileDown size={14} style={{ color: 'var(--green)' }} /> Export
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={importing}
          style={{ ...btn, border: '1px solid rgba(255,106,26,0.35)', background: 'rgba(255,106,26,0.12)', color: '#FF8A4C' }}
          title="Upload Excel untuk impor data">
          {importing ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
          {importing ? 'Mengimpor...' : 'Import Excel'}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
      </div>

      {/* Result / error modal */}
      {(result || errMsg) && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 py-8"
          style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => { setResult(null); setErrMsg(null) }}>
          <div className="w-full max-w-md rounded-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="font-grotesk font-bold text-[16px] text-[var(--text-primary)]">Hasil Import {label}</h3>
              <button onClick={() => { setResult(null); setErrMsg(null) }} style={{ background: 'var(--border)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={15} /></button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              {errMsg ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--red)' }}>
                  <AlertTriangle size={20} /> <span style={{ fontSize: '14px' }}>{errMsg}</span>
                </div>
              ) : result && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <CheckCircle2 size={22} style={{ color: 'var(--green)' }} />
                    <span className="text-[var(--text-primary)] font-semibold text-[15px]">Import selesai</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: result.errors.length ? '16px' : 0 }}>
                    <Stat label="Ditambah" val={result.inserted} color="var(--green)" />
                    <Stat label="Diperbarui" val={result.updated} color="var(--blue)" />
                    <Stat label="Dilewati" val={result.skipped} color={result.skipped ? '#F59E0B' : 'var(--text-muted)'} />
                  </div>
                  {result.errors.length > 0 && (
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Baris bermasalah</p>
                      <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {result.errors.map((er, i) => (
                          <div key={i} style={{ fontSize: '12px', color: 'var(--red)', background: 'rgba(239,68,68,0.08)', borderRadius: '7px', padding: '6px 10px' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", opacity: 0.8 }}>Baris {er.row}:</span> {er.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Stat({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div style={{ background: 'var(--surface-subtle)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
      <p style={{ fontSize: '22px', fontWeight: 700, color, fontFamily: "'Space Grotesk', sans-serif" }}>{val}</p>
      <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{label}</p>
    </div>
  )
}
