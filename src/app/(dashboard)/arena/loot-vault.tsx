'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import { Avatar } from '@/components/ui/avatar'
import { Gift, Lock, CheckCircle2, Clock3, Package, Plus, Sparkles, Trophy, Pencil, Trash2, Crown } from 'lucide-react'
import { uploadSquareImage } from '@/lib/upload-image'
import type { MyRewards, EligibleReward, LockedReward, ClaimedReward, CurrentMonthRewards, MonthlyRewardRow } from '@/lib/rewards'

interface AdminClaim {
  id: string; source: string; title: string; status: string
  claimedAt: string; fulfilledAt: string | null; notes: string | null
  userName: string; userAvatar: string | null
}
interface AdminCatalog {
  id: string; unlockType: string; threshold: number | null; badgeId: string | null
  name: string; description: string | null; imageUrl: string | null
  stock: number | null; isActive: boolean; claimedCount: number
}

interface Props {
  rewards: MyRewards
  isAdmin: boolean
  adminClaims: AdminClaim[]
  adminCatalog: AdminCatalog[]
  currentMonth: CurrentMonthRewards
  readOnly?: boolean
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  claimed:   { label: 'Menunggu serah-terima', color: '#F5C451', bg: 'rgba(245,196,81,0.12)' },
  fulfilled: { label: 'Sudah diserahkan',      color: '#3FD08A', bg: 'rgba(63,208,138,0.12)' },
  rejected:  { label: 'Ditolak',               color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)' },
}

const MEDAL = ['🥇', '🥈', '🥉']
const RANK_COLOR = ['#F5C451', '#C8D0DD', '#D9893E']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
}

export function LootVault({ rewards, isAdmin, adminClaims, adminCatalog, currentMonth, readOnly }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function claim(r: EligibleReward) {
    if (busy) return
    setBusy(r.key); setErr(null)
    try {
      const res = await fetch('/api/rewards/claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: r.source, refId: r.refId }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Gagal mengklaim reward.'); return }
      confetti({ particleCount: 130, spread: 90, origin: { y: 0.4 }, colors: ['#FF6A1A', '#F5C451', '#3FD08A', '#4A9EFF'] })
      router.refresh()
    } catch {
      setErr('Terjadi kesalahan jaringan.')
    } finally {
      setBusy(null)
    }
  }

  const { eligible, locked, claimed } = rewards
  const hasAny = eligible.length > 0 || locked.length > 0 || claimed.length > 0

  return (
    <div style={{ background: '#161a23', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <Gift size={15} color="#FF8A4C" />
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: '#EDF0F5' }}>Loot Vault</span>
      </div>
      <p style={{ fontSize: 11, color: '#6B7385', marginBottom: 14 }}>Tebus reward dari level & juara leaderboard 🎁</p>

      {err && (
        <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: '#FF9B9B', fontSize: 12, padding: '8px 12px', borderRadius: 10, marginBottom: 12 }}>
          {err}
        </div>
      )}

      {/* Reward Bulan Ini — live standing, bisa diedit admin */}
      <MonthlyRewardsPanel currentMonth={currentMonth} isAdmin={isAdmin} />

      {!hasAny && (
        <div style={{ textAlign: 'center', color: '#6B7385', fontSize: 13, padding: '28px 0' }}>
          Belum ada reward klaim lainnya. Naikkan level & menangkan leaderboard untuk membuka loot! ⚔️
        </div>
      )}

      {/* Eligible — bisa diklaim */}
      {eligible.length > 0 && (
        <div style={{ marginBottom: locked.length || claimed.length ? 18 : 0 }}>
          <SectionLabel icon={<Sparkles size={12} color="#FF8A4C" />} text="Bisa diklaim" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {eligible.map(r => (
              <RewardCard key={r.key} title={r.title} description={r.description} imageUrl={r.imageUrl} accent="#FF6A1A">
                <span style={{ fontSize: 10.5, color: '#FFB489', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: "'IBM Plex Mono',monospace" }}>
                  {r.source === 'monthly' ? <Trophy size={11} /> : <Sparkles size={11} />} {r.reason}
                </span>
                <button
                  onClick={() => claim(r)}
                  disabled={busy === r.key || r.soldOut || readOnly}
                  style={{
                    marginTop: 10, width: '100%', padding: '8px 0', borderRadius: 10, border: 'none', cursor: r.soldOut || readOnly ? 'not-allowed' : 'pointer',
                    fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 13,
                    background: r.soldOut || readOnly ? 'rgba(255,255,255,0.06)' : 'linear-gradient(90deg,#FF6A1A,#FF8A4C)',
                    color: r.soldOut || readOnly ? '#6B7385' : '#fff', opacity: busy === r.key ? 0.6 : 1,
                    boxShadow: r.soldOut || readOnly ? 'none' : '0 0 18px rgba(255,106,26,0.4)',
                  }}>
                  {readOnly ? '👁️ Lihat saja' : r.soldOut ? 'Stok habis' : busy === r.key ? 'Mengklaim…' : 'Klaim Reward'}
                </button>
              </RewardCard>
            ))}
          </div>
        </div>
      )}

      {/* Claimed — riwayat klaim user */}
      {claimed.length > 0 && (
        <div style={{ marginBottom: locked.length ? 18 : 0 }}>
          <SectionLabel icon={<Package size={12} color="#3FD08A" />} text="Sudah kamu klaim" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {claimed.map((c: ClaimedReward) => {
              const st = STATUS_META[c.status] ?? STATUS_META.claimed
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {c.status === 'fulfilled' ? <CheckCircle2 size={15} color={st.color} /> : <Clock3 size={15} color={st.color} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#EDF0F5', fontFamily: "'Space Grotesk',sans-serif" }}>{c.title}</div>
                    <div style={{ fontSize: 10, color: '#6B7385', fontFamily: "'IBM Plex Mono',monospace" }}>Diklaim {fmtDate(c.claimedAt)}{c.notes ? ` · ${c.notes}` : ''}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: st.color, background: st.bg, padding: '3px 9px', borderRadius: 100 }}>{st.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Locked — belum memenuhi syarat */}
      {locked.length > 0 && (
        <div>
          <SectionLabel icon={<Lock size={12} color="#6B7385" />} text="Belum terbuka" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {locked.map((r: LockedReward) => (
              <RewardCard key={r.key} title={r.title} description={r.description} imageUrl={r.imageUrl} accent="#3a4150" locked>
                <span style={{ fontSize: 10.5, color: '#6B7385', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: "'IBM Plex Mono',monospace" }}>
                  <Lock size={11} /> {r.requirement}
                </span>
              </RewardCard>
            ))}
          </div>
        </div>
      )}

      {isAdmin && <AdminPanel claims={adminClaims} catalog={adminCatalog} />}
    </div>
  )
}

/* ═══════════════════ REWARD BULAN INI (live standing) ═══════════════════ */
function MonthlyRewardsPanel({ currentMonth, isAdmin }: { currentMonth: CurrentMonthRewards; isAdmin: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState<number | null>(null) // rank yang sedang diedit, atau -1 utk "tambah baru"
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({ rank: 1, rewardName: '', notes: '', rewardImageLink: '' as string | null })

  const { rewards, liveTop, monthLabel } = currentMonth
  if (rewards.length === 0 && liveTop.length === 0 && !isAdmin) return null

  function openEdit(row?: MonthlyRewardRow) {
    setErr(null)
    if (row) setForm({ rank: row.rank, rewardName: row.rewardName, notes: row.notes ?? '', rewardImageLink: row.rewardImageLink ?? null })
    else setForm({ rank: (rewards[rewards.length - 1]?.rank ?? 0) + 1, rewardName: '', notes: '', rewardImageLink: null })
    setEditing(row ? row.rank : -1)
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('File harus berupa gambar.'); return }
    setBusy('photo'); setErr(null)
    try {
      const url = await uploadSquareImage(file, 'rewards', 320)
      setForm(f => ({ ...f, rewardImageLink: url }))
    } catch (err: any) {
      setErr(err?.message ?? 'Gagal mengunggah foto.')
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    if (!form.rewardName.trim()) { setErr('Nama hadiah wajib diisi.'); return }
    setBusy('save'); setErr(null)
    try {
      const res = await fetch('/api/monthly-rewards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rank: form.rank, rewardName: form.rewardName, notes: form.notes, rewardImageLink: form.rewardImageLink }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Gagal menyimpan.'); return }
      setEditing(null); router.refresh()
    } catch { setErr('Kesalahan jaringan.') } finally { setBusy(null) }
  }

  async function remove(id: string) {
    if (busy) return
    setBusy(id)
    try {
      const res = await fetch(`/api/monthly-rewards/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(data.error ?? 'Gagal menghapus.'); return }
      router.refresh()
    } finally { setBusy(null) }
  }

  const input: React.CSSProperties = {
    background: '#10141d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 10px',
    color: '#EDF0F5', fontSize: 12.5, width: '100%', fontFamily: "'Space Grotesk',sans-serif",
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <SectionLabel icon={<Crown size={12} color="#F5C451" />} text={`Reward Bulan Ini · ${monthLabel}`} />

      {err && (
        <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: '#FF9B9B', fontSize: 12, padding: '8px 12px', borderRadius: 10, marginBottom: 10 }}>{err}</div>
      )}

      {rewards.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 16px', marginBottom: isAdmin ? 10 : 0 }}>
          <p style={{ fontSize: 12, color: '#6B7385', marginBottom: liveTop.length ? 10 : 0 }}>
            Admin belum menetapkan hadiah bulan ini. Live leaderboard sementara:
          </p>
          {liveTop.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {liveTop.map((s, i) => (
                <div key={s.userId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{MEDAL[i] ?? s.rank}</span>
                  <Avatar name={s.fullName} imageUrl={s.avatarUrl ?? undefined} size="sm" />
                  <span style={{ fontSize: 12.5, color: '#EDF0F5', flex: 1 }}>{s.fullName}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: RANK_COLOR[i] ?? '#A5AEC0' }}>{s.exp.toLocaleString('id-ID')} EXP</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: isAdmin ? 10 : 0 }}>
          {rewards.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12,
              background: 'radial-gradient(120% 140% at 0% 0%, rgba(245,196,81,0.1) 0%, rgba(16,20,29,0) 50%), #10141d',
              border: '1px solid rgba(245,196,81,0.22)',
            }}>
              <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{MEDAL[r.rank - 1] ?? `#${r.rank}`}</span>
              {r.rewardImageLink && (
                <img src={r.rewardImageLink} alt={r.rewardName} style={{ width: 44, height: 44, borderRadius: 9, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(245,196,81,0.3)' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#EDF0F5', fontFamily: "'Space Grotesk',sans-serif" }}>{r.rewardName}</div>
                {r.notes && <div style={{ fontSize: 11, color: '#6B7385', marginTop: 1 }}>{r.notes}</div>}
                <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {r.standing ? (
                    <>
                      <Avatar name={r.standing.fullName} imageUrl={r.standing.avatarUrl ?? undefined} size="sm" />
                      <span style={{ fontSize: 12, color: '#FFE6B8' }}>
                        Juara sementara: <strong>{r.standing.fullName}</strong> · {r.standing.exp.toLocaleString('id-ID')} EXP
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 11.5, color: '#6B7385' }}>Belum ada peserta di posisi ini</span>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => openEdit(r)} title="Edit hadiah" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#A5AEC0', padding: 5 }}><Pencil size={14} /></button>
                  <button onClick={() => remove(r.id)} disabled={busy === r.id} title="Hapus" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#FF8A8A', padding: 5 }}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        editing !== null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 10 }}>
            <div style={{ display: 'flex', gap: 7 }}>
              <input style={{ ...input, maxWidth: 90 }} type="number" min={1} placeholder="Rank" value={form.rank} onChange={e => setForm({ ...form, rank: Number(e.target.value) || 1 })} />
              <input style={input} placeholder="Nama hadiah (mis. Kanky Running Shoes)" value={form.rewardName} onChange={e => setForm({ ...form, rewardName: e.target.value })} />
            </div>
            <input style={input} placeholder="Catatan (opsional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 48, height: 48, borderRadius: 9, flexShrink: 0, overflow: 'hidden', background: '#10141d', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {form.rewardImageLink ? <img src={form.rewardImageLink} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Gift size={18} color="#6B7385" />}
              </span>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#F5C451', background: 'rgba(245,196,81,0.1)', border: '1px solid rgba(245,196,81,0.25)', borderRadius: 8, padding: '7px 12px', cursor: busy === 'photo' ? 'wait' : 'pointer', opacity: busy === 'photo' ? 0.6 : 1 }}>
                {busy === 'photo' ? 'Mengunggah…' : 'Pilih foto produk (persegi)'}
                <input type="file" accept="image/*" onChange={onPickPhoto} disabled={busy === 'photo'} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <button onClick={save} disabled={busy === 'save'}
                style={{ fontSize: 12, fontWeight: 700, color: '#10141d', background: 'linear-gradient(90deg,#F5C451,#F0B429)', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', opacity: busy === 'save' ? 0.6 : 1 }}>
                {busy === 'save' ? 'Menyimpan…' : 'Simpan'}
              </button>
              <button onClick={() => setEditing(null)} style={{ fontSize: 12, color: '#6B7385', background: 'transparent', border: 'none', cursor: 'pointer' }}>Batal</button>
            </div>
          </div>
        ) : (
          <button onClick={() => openEdit()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#F5C451', background: 'rgba(245,196,81,0.1)', border: '1px solid rgba(245,196,81,0.25)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}>
            <Plus size={13} /> Tambah hadiah rank {(rewards[rewards.length - 1]?.rank ?? 0) + 1}
          </button>
        )
      )}
    </div>
  )
}

/* ═══════════════════ ADMIN ═══════════════════ */
function AdminPanel({ claims, catalog }: { claims: AdminClaim[]; catalog: AdminCatalog[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', threshold: '', description: '', stock: '' })
  const pending = claims.filter(c => c.status === 'claimed')

  async function fulfill(id: string) {
    if (busy) return
    setBusy(id)
    try {
      const res = await fetch(`/api/rewards/${id}/fulfill`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      if (res.ok) router.refresh()
    } finally { setBusy(null) }
  }

  async function addCatalog() {
    if (!form.name.trim() || busy) return
    setBusy('add')
    try {
      const res = await fetch('/api/reward-catalog', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unlockType: 'level', name: form.name, threshold: form.threshold, description: form.description, stock: form.stock }),
      })
      if (res.ok) { setForm({ name: '', threshold: '', description: '', stock: '' }); setAdding(false); router.refresh() }
    } finally { setBusy(null) }
  }

  const inputStyle: React.CSSProperties = {
    background: '#10141d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 10px',
    color: '#EDF0F5', fontSize: 12, width: '100%', fontFamily: "'IBM Plex Mono',monospace",
  }

  return (
    <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
      <SectionLabel icon={<Package size={12} color="#FF8A4C" />} text={`Admin · Klaim masuk (${pending.length} menunggu)`} />
      {claims.length === 0 ? (
        <div style={{ fontSize: 12, color: '#6B7385', padding: '6px 0 14px' }}>Belum ada klaim.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
          {claims.slice(0, 20).map(c => {
            const st = STATUS_META[c.status] ?? STATUS_META.claimed
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                <Avatar name={c.userName} imageUrl={c.userAvatar ?? undefined} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: '#EDF0F5', fontFamily: "'Space Grotesk',sans-serif" }}>
                    <strong>{c.userName}</strong> → {c.title}
                  </div>
                  <div style={{ fontSize: 10, color: '#6B7385', fontFamily: "'IBM Plex Mono',monospace" }}>{fmtDate(c.claimedAt)}</div>
                </div>
                {c.status === 'claimed' ? (
                  <button onClick={() => fulfill(c.id)} disabled={busy === c.id}
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#fff', background: 'linear-gradient(90deg,#16a34a,#22c55e)', border: 'none', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', opacity: busy === c.id ? 0.6 : 1 }}>
                    {busy === c.id ? '…' : 'Tandai diserahkan'}
                  </button>
                ) : (
                  <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: st.color, background: st.bg, padding: '3px 9px', borderRadius: 100 }}>{st.label}</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <SectionLabel icon={<Gift size={12} color="#FF8A4C" />} text="Admin · Katalog reward" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {catalog.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', opacity: c.isActive ? 1 : 0.5 }}>
            <span style={{ fontSize: 12.5, color: '#EDF0F5', flex: 1 }}>
              {c.name} <span style={{ color: '#6B7385', fontSize: 11 }}>· {c.unlockType === 'level' ? `Level ${c.threshold}` : c.unlockType} · {c.claimedCount} klaim{c.stock != null ? ` / stok ${c.stock}` : ''}</span>
            </span>
            {!c.isActive && <span style={{ fontSize: 10, color: '#6B7385' }}>nonaktif</span>}
          </div>
        ))}
      </div>

      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 10 }}>
          <input style={inputStyle} placeholder="Nama reward (mis. Kopi Fore)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div style={{ display: 'flex', gap: 7 }}>
            <input style={inputStyle} type="number" placeholder="Level minimal" value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} />
            <input style={inputStyle} type="number" placeholder="Stok (kosong = ∞)" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
          </div>
          <input style={inputStyle} placeholder="Deskripsi (opsional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: 'flex', gap: 7 }}>
            <button onClick={addCatalog} disabled={busy === 'add' || !form.name.trim()}
              style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'linear-gradient(90deg,#FF6A1A,#FF8A4C)', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', opacity: busy === 'add' || !form.name.trim() ? 0.6 : 1 }}>
              {busy === 'add' ? 'Menyimpan…' : 'Simpan reward'}
            </button>
            <button onClick={() => setAdding(false)} style={{ fontSize: 12, color: '#6B7385', background: 'transparent', border: 'none', cursor: 'pointer' }}>Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#FF8A4C', background: 'rgba(255,106,26,0.1)', border: '1px solid rgba(255,106,26,0.25)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}>
          <Plus size={13} /> Tambah reward level
        </button>
      )}
    </div>
  )
}

/* ═══════════════════ PARTS ═══════════════════ */
function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#A5AEC0', fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 9 }}>
      {icon} {text}
    </div>
  )
}

function RewardCard({ title, description, imageUrl, accent, locked, children }: {
  title: string; description: string | null; imageUrl: string | null; accent: string; locked?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{
      background: locked ? 'rgba(255,255,255,0.02)' : 'radial-gradient(120% 120% at 0% 0%, rgba(255,106,26,0.1) 0%, rgba(16,20,29,0) 50%), #10141d',
      border: `1px solid ${locked ? 'rgba(255,255,255,0.07)' : 'rgba(255,106,26,0.28)'}`, borderRadius: 14, padding: 14,
      boxShadow: locked ? 'none' : '0 0 20px rgba(255,106,26,0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', filter: locked ? 'grayscale(0.6)' : 'none' }}>
          {imageUrl
            ? <img src={imageUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Gift size={20} color={locked ? '#6B7385' : accent} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: locked ? '#A5AEC0' : '#EDF0F5', fontFamily: "'Space Grotesk',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        </div>
      </div>
      {description && <p style={{ fontSize: 11, color: '#6B7385', marginBottom: 8, lineHeight: 1.45 }}>{description}</p>}
      {children}
    </div>
  )
}
