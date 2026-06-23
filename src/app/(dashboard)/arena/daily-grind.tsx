'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import { Brain, CheckCircle2, XCircle, Lightbulb, Zap, Lock, Plus, Settings2, Eye, EyeOff } from 'lucide-react'
import type { TodayQuiz, QuizAttemptResult, AdminQuestion } from '@/lib/quiz'

export function DailyGrind({ quiz, isAdmin = false, questions = [], readOnly = false }: { quiz: TodayQuiz; isAdmin?: boolean; questions?: AdminQuestion[]; readOnly?: boolean }) {
  const router = useRouter()
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Hasil lokal setelah submit (server-confirmed); fallback ke hasil dari server bila sudah menjawab.
  const [localResult, setLocalResult] = useState<QuizAttemptResult | null>(quiz.result)

  const answered = quiz.answered || localResult !== null
  const result = localResult
  const q = quiz.question

  async function submit() {
    if (selected == null || busy || !q) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/quiz/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: q.id, selectedIndex: selected }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Gagal mengirim jawaban.'); return }
      setLocalResult(data.result)
      if (data.result?.isCorrect) {
        confetti({ particleCount: 120, spread: 75, origin: { y: 0.4 }, colors: ['#3FD08A', '#F5C451', '#FF6A1A'] })
      }
      router.refresh()
    } catch {
      setErr('Terjadi kesalahan jaringan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(124,109,255,0.18)', borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <Brain size={15} color="var(--purple)" />
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>The Daily Grind</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--green)', background: 'rgba(63,208,138,0.12)', padding: '3px 9px', borderRadius: 100, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Zap size={11} /> +{quiz.expReward} EXP
        </span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Kuis harian · jawab benar untuk bonus EXP 🧠</p>

      {!q ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '24px 0' }}>Belum ada kuis tersedia.</div>
      ) : (
        <>
          {q.category && (
            <span style={{ fontSize: 10, color: 'var(--purple)', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em' }}>{q.category}</span>
          )}
          <p style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Space Grotesk',sans-serif", margin: '6px 0 14px', lineHeight: 1.5 }}>{q.question}</p>

          {err && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: 'var(--red)', fontSize: 12, padding: '8px 12px', borderRadius: 10, marginBottom: 12 }}>{err}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.options.map((opt, i) => {
              const isSel = selected === i
              // Pewarnaan setelah dijawab
              let bg = 'var(--surface-subtle)', border = 'var(--border)', color = 'var(--text-primary)'
              let icon: React.ReactNode = null
              if (answered && result) {
                if (i === result.correctIndex) { bg = 'rgba(63,208,138,0.12)'; border = 'rgba(63,208,138,0.5)'; color = 'var(--green)'; icon = <CheckCircle2 size={15} color="var(--green)" /> }
                else if (i === result.selectedIndex) { bg = 'rgba(255,107,107,0.1)'; border = 'rgba(255,107,107,0.5)'; color = 'var(--red)'; icon = <XCircle size={15} color="var(--red)" /> }
              } else if (isSel) {
                bg = 'rgba(167,139,250,0.14)'; border = 'rgba(167,139,250,0.6)'; color = '#fff'
              }
              return (
                <button key={i} disabled={answered || busy || readOnly} onClick={() => !answered && !readOnly && setSelected(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%',
                    padding: '11px 13px', borderRadius: 11, border: `1px solid ${border}`, background: bg, color,
                    cursor: answered || readOnly ? 'default' : 'pointer', fontSize: 13.5, fontFamily: "'Space Grotesk',sans-serif",
                  }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0, fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isSel && !answered ? 'var(--purple)' : 'var(--border)', color: isSel && !answered ? '#fff' : 'var(--text-secondary)',
                  }}>{String.fromCharCode(65 + i)}</span>
                  <span style={{ flex: 1 }}>{opt}</span>
                  {icon}
                </button>
              )
            })}
          </div>

          {/* Aksi / hasil */}
          {readOnly ? (
            <div style={{ marginTop: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '10px 0', background: 'var(--surface-subtle)', borderRadius: 10 }}>
              👁️ Mode spectator: lihat saja, tidak bisa jawab kuis.
            </div>
          ) : !answered ? (
            <button onClick={submit} disabled={selected == null || busy}
              style={{
                marginTop: 14, width: '100%', padding: '10px 0', borderRadius: 11, border: 'none',
                fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 13.5,
                cursor: selected == null ? 'not-allowed' : 'pointer',
                background: selected == null ? 'var(--border)' : 'linear-gradient(90deg,#7C6DFF,var(--purple))',
                color: selected == null ? 'var(--text-muted)' : '#fff', opacity: busy ? 0.6 : 1,
                boxShadow: selected == null ? 'none' : '0 0 18px rgba(124,109,255,0.4)',
              }}>
              {busy ? 'Mengirim…' : 'Kirim Jawaban'}
            </button>
          ) : result && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {result.isCorrect ? (
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} /> Benar! +{result.expAwarded} EXP
                  </span>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <XCircle size={16} /> Belum tepat — tapi tak ada EXP berkurang 👍
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 9, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 11, padding: '11px 13px' }}>
                <Lightbulb size={16} color="#C4B5FD" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12.5, color: 'var(--purple)', lineHeight: 1.5 }}>{result.explanation}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 12, fontSize: 11, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono',monospace" }}>
                <Lock size={11} /> Kuis berikutnya besok. Sampai jumpa, grinder!
              </div>
            </div>
          )}
        </>
      )}

      {isAdmin && <QuizAdmin questions={questions} />}
    </div>
  )
}

/* ═══════════════════ ADMIN: kelola bank soal (super_admin) ═══════════════════ */
function QuizAdmin({ questions }: { questions: AdminQuestion[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ question: '', a: '', b: '', c: '', d: '', correct: 0, category: '', points: '15' })

  const activeCount = questions.filter(q => q.isActive).length

  async function save() {
    const options = [f.a, f.b, f.c, f.d].map(s => s.trim()).filter(Boolean)
    if (!f.question.trim() || options.length < 2) { setErr('Isi pertanyaan & minimal 2 pilihan.'); return }
    if (f.correct >= options.length) { setErr('Jawaban benar di luar jumlah pilihan.'); return }
    setBusy('save'); setErr(null)
    try {
      const res = await fetch('/api/quiz-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: f.question, options, correctIndex: f.correct, category: f.category || 'Umum', points: Number(f.points) || 15 }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Gagal menyimpan soal.'); return }
      setF({ question: '', a: '', b: '', c: '', d: '', correct: 0, category: '', points: '15' })
      setAdding(false); router.refresh()
    } catch { setErr('Kesalahan jaringan.') } finally { setBusy(null) }
  }

  async function toggle(id: string, isActive: boolean) {
    setBusy(id)
    try {
      await fetch(`/api/quiz-questions/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !isActive }),
      })
      router.refresh()
    } finally { setBusy(null) }
  }

  const input: React.CSSProperties = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '7px 10px',
    color: 'var(--text-primary)', fontSize: 12.5, width: '100%', fontFamily: "'Space Grotesk',sans-serif",
  }
  const optRow = (label: string, key: 'a' | 'b' | 'c' | 'd', idx: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button type="button" onClick={() => setF({ ...f, correct: idx })}
        title="Tandai sebagai jawaban benar"
        style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 7, fontSize: 11, fontWeight: 800, cursor: 'pointer',
          border: f.correct === idx ? '1px solid var(--green)' : '1px solid var(--border-strong)',
          background: f.correct === idx ? 'rgba(63,208,138,0.2)' : 'var(--surface-hover)', color: f.correct === idx ? 'var(--green)' : 'var(--text-secondary)' }}>
        {label}
      </button>
      <input style={input} placeholder={`Pilihan ${label}`} value={f[key]} onChange={e => setF({ ...f, [key]: e.target.value })} />
    </div>
  )

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--border-strong)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
        <Settings2 size={13} color="var(--purple)" />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Admin · Bank Soal ({activeCount} aktif / {questions.length} total)
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {err && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: 'var(--red)', fontSize: 12, padding: '8px 12px', borderRadius: 10, marginBottom: 10 }}>{err}</div>}

          {adding ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-subtle)', padding: 12, borderRadius: 10, marginBottom: 12 }}>
              <textarea style={{ ...input, minHeight: 56, resize: 'vertical' }} placeholder="Tulis pertanyaan…" value={f.question} onChange={e => setF({ ...f, question: e.target.value })} />
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono',monospace" }}>Klik huruf untuk menandai jawaban benar (hijau)</div>
              {optRow('A', 'a', 0)}
              {optRow('B', 'b', 1)}
              {optRow('C', 'c', 2)}
              {optRow('D', 'd', 3)}
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={input} placeholder="Kategori (mis. Branding)" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} />
                <input style={{ ...input, maxWidth: 110 }} type="number" placeholder="Poin EXP" value={f.points} onChange={e => setF({ ...f, points: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={save} disabled={busy === 'save'}
                  style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', background: 'linear-gradient(90deg,#7C6DFF,var(--purple))', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', opacity: busy === 'save' ? 0.6 : 1 }}>
                  {busy === 'save' ? 'Menyimpan…' : 'Simpan soal'}
                </button>
                <button onClick={() => { setAdding(false); setErr(null) }} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Batal</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--purple)', background: 'rgba(124,109,255,0.1)', border: '1px solid rgba(124,109,255,0.25)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', marginBottom: 12 }}>
              <Plus size={13} /> Tambah soal
            </button>
          )}

          {/* Daftar soal (20 terbaru) dengan toggle aktif/nonaktif */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 260, overflowY: 'auto' }}>
            {questions.slice(0, 30).map(q => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8, background: 'var(--surface-subtle)', opacity: q.isActive ? 1 : 0.45 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.question}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono',monospace" }}>{q.category} · {q.points} EXP</div>
                </div>
                <button onClick={() => toggle(q.id, q.isActive)} disabled={busy === q.id} title={q.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  style={{ flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: q.isActive ? 'var(--green)' : 'var(--text-muted)', padding: 4 }}>
                  {q.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
