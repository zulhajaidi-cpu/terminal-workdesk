'use client'

import { useState, useMemo, useEffect } from 'react'
import { Trophy, Plus, X, Crown, Zap } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/roles'
import { CharacterCard, type CharacterUser } from './character-card'

interface PointRow { userId: string; totalPoints: number }
interface UserRow  { id: string; fullName: string; avatarUrl: string|null; bio: string|null; role: string; divisionId: string|null; divisionName: string|null }
interface BadgeRow { userId: string; badgeName: string|null; badgeIcon: string|null; badgeId: string|null }
interface RewardRow { periodMonth: number; periodYear: number; rank: number; rewardName: string; rewardImageLink: string|null; winnerUserId: string|null; winnerName: string|null; notes: string|null }

interface Props {
  monthly: PointRow[]; allTime: PointRow[]; lastMonth: PointRow[]
  badgeRows: BadgeRow[]; allUsers: UserRow[]
  rewards: RewardRow[]
  expBySource: Record<string, Record<string, number>>
  moodByUser: Record<string, { emoji: string; label: string }>
  currentUser: { id: string; role: string }
  currentPeriod: { month: number; year: number }
}

const MONTHS_ID = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const RANK_COLORS = ['#F59E0B','var(--text-faint)','#B45309']
const RANK_LABELS = ['','🥇','🥈','🥉']

function buildRanking(pointRows: PointRow[], allUsers: UserRow[], badges: BadgeRow[]) {
  const pointMap = new Map(pointRows.map(r => [r.userId, r.totalPoints]))
  const badgeMap = new Map<string, BadgeRow[]>()
  for (const b of badges) {
    if (!badgeMap.has(b.userId)) badgeMap.set(b.userId, [])
    badgeMap.get(b.userId)!.push(b)
  }

  const ranked = allUsers.map(u => ({
    ...u,
    points: pointMap.get(u.id) ?? 0,
    badges: badgeMap.get(u.id) ?? [],
  })).sort((a,b) => b.points - a.points)

  let rank = 1
  return ranked.map((u, i) => {
    if (i > 0 && ranked[i-1].points !== u.points) rank = i + 1
    return { ...u, rank }
  })
}

export function LeaderboardContent({ monthly, allTime, lastMonth, badgeRows, allUsers, rewards, expBySource, moodByUser, currentUser, currentPeriod }: Props) {
  const [period, setPeriod] = useState<'month'|'last'|'all'>('month')
  const [divFilter, setDivFilter] = useState('Semua')
  const [showAddPoints, setShowAddPoints] = useState(false)
  const [selected, setSelected] = useState<CharacterUser | null>(null)

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const canManage = ['super_admin','spv_manager','head_director'].includes(currentUser.role)

  const source = period === 'month' ? monthly : period === 'last' ? lastMonth : allTime
  const ranking = useMemo(() => buildRanking(source, allUsers, badgeRows), [source, allUsers, badgeRows])

  const divisions = [...new Set(allUsers.map(u => u.divisionName).filter(Boolean))] as string[]
  const filtered  = divFilter === 'Semua' ? ranking : ranking.filter(u => u.divisionName === divFilter)

  const top3 = filtered.slice(0, 3)
  const rest  = filtered.slice(3)
  const me    = filtered.find(u => u.id === currentUser.id)

  const periodLabel = period === 'month'
    ? `${MONTHS_ID[currentPeriod.month]} ${currentPeriod.year}`
    : period === 'last'
    ? `${MONTHS_ID[currentPeriod.month===1?12:currentPeriod.month-1]} ${currentPeriod.month===1?currentPeriod.year-1:currentPeriod.year}`
    : 'Sepanjang Masa'

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-[var(--text-primary)] flex items-center gap-3">
            <Trophy size={22} style={{ color: '#F59E0B' }}/>
            Leaderboard
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">{periodLabel} · {filtered.length} peserta</p>
        </div>
        {canManage && (
          <button onClick={() => setShowAddPoints(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '11px', padding: '9px 16px', cursor: 'pointer', color: '#FCD34D', fontSize: '13px', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
            <Plus size={14}/> Beri Poin
          </button>
        )}
      </div>

      {/* Period & Division filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
          {([['month','Bulan Ini'],['last','Bulan Lalu'],['all','All Time']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setPeriod(k)}
              style={{ padding: '5px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: period===k ? '#FF6A1A' : 'transparent', color: period===k ? 'var(--on-accent)' : 'var(--text-muted)', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s' }}>
              {l}
            </button>
          ))}
        </div>
        <select value={divFilter} onChange={e => setDivFilter(e.target.value)}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
          <option value="Semua">Semua Divisi</option>
          {divisions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* My rank banner */}
      {me && me.rank > 3 && (
        <div style={{ background: 'rgba(255,106,26,0.08)', border: '1px solid rgba(255,106,26,0.2)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px', fontWeight: 800, color: '#FF8A4C', fontFamily: "'Space Grotesk', sans-serif", minWidth: '32px' }}>#{me.rank}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Posisi kamu saat ini</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>{me.points.toLocaleString('id-ID')} poin · {me.divisionName}</p>
          </div>
          <Zap size={16} style={{ color: '#FF8A4C' }}/>
        </div>
      )}

      {/* Podium */}
      {top3.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, rgba(16,20,29,0.8), rgba(20,25,37,0.8))', border: '1px solid var(--border)', borderRadius: '20px', padding: '32px 24px 24px', position: 'relative', overflow: 'hidden' }}>
          {/* Background glow */}
          <div style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)', pointerEvents: 'none' }}/>

          <p style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-faint)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '28px' }}>Top Performers · {periodLabel}</p>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '20px' }}>
            {/* 2nd */}
            {top3[1] && <PodiumCard user={top3[1]} rank={2} isSelf={top3[1].id===currentUser.id} onClick={() => setSelected(top3[1])}/>}
            {/* 1st */}
            {top3[0] && <PodiumCard user={top3[0]} rank={1} isSelf={top3[0].id===currentUser.id} tall onClick={() => setSelected(top3[0])}/>}
            {/* 3rd */}
            {top3[2] && <PodiumCard user={top3[2]} rank={3} isSelf={top3[2].id===currentUser.id} onClick={() => setSelected(top3[2])}/>}
          </div>
        </div>
      )}

      {/* Monthly rewards */}
      {rewards.length > 0 && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '14px', padding: '16px 20px' }}>
          <p style={{ fontSize: '11px', color: '#F59E0B', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Crown size={13}/> Reward Bulan Ini
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {rewards.map(r => (
              <div key={r.rank} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '10px', padding: '10px 14px' }}>
                <span style={{ fontSize: '18px' }}>{RANK_LABELS[r.rank]}</span>
                {r.rewardImageLink && (
                  <img src={r.rewardImageLink} alt={r.rewardName} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(245,158,11,0.3)' }} />
                )}
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.rewardName}</p>
                  {r.winnerName && <p style={{ fontSize: '11px', color: '#F59E0B', marginTop: '1px' }}>→ {r.winnerName}</p>}
                  {r.notes && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{r.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full ranking table */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
          <Trophy size={36} style={{ color: 'var(--text-faint)', margin: '0 auto 12px' }}/>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Belum ada data poin untuk periode ini</p>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '40px 1fr 70px' : '48px 1fr 120px 80px', gap: '12px', padding: '10px 16px', background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)' }}>
            {(isMobile ? ['#','Anggota','Poin'] : ['#','Anggota','Divisi','Poin']).map(h => (
              <div key={h} style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {filtered.map((u, i) => {
            const isMe = u.id === currentUser.id
            const rankColor = u.rank === 1 ? '#F59E0B' : u.rank === 2 ? 'var(--text-faint)' : u.rank === 3 ? '#B45309' : 'var(--text-faint)'
            return (
              <div key={u.id} onClick={() => setSelected(u)}
                title="Lihat kartu karakter"
                style={{ display: 'grid', gridTemplateColumns: isMobile ? '40px 1fr 70px' : '48px 1fr 120px 80px', gap: '12px', padding: '12px 16px', borderBottom: i<filtered.length-1?'1px solid var(--surface-hover)':'none', background: isMe?'rgba(255,106,26,0.04)':'transparent', alignItems: 'center', cursor: 'pointer', transition: 'background 0.12s' }}
                onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = 'var(--surface-hover)' }}
                onMouseLeave={e => { if (!isMe) e.currentTarget.style.background = 'transparent' }}>
                {/* Rank */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {u.rank <= 3
                    ? <span style={{ fontSize: '18px' }}>{RANK_LABELS[u.rank]}</span>
                    : <span style={{ fontSize: '13px', fontWeight: 700, color: rankColor, fontFamily: "'IBM Plex Mono', monospace" }}>#{u.rank}</span>
                  }
                </div>
                {/* User */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,106,26,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: isMe ? '2px solid #FF6A1A' : '2px solid var(--border)' }}>
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      : <span style={{ fontSize: '12px', fontWeight: 700, color: '#FF8A4C' }}>{u.fullName.charAt(0)}</span>
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: isMe ? 700 : 600, color: isMe ? '#FF8A4C' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.fullName}{isMe && ' (Kamu)'}
                    </p>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isMobile ? (u.divisionName ?? ROLE_LABELS[u.role] ?? u.role) : (ROLE_LABELS[u.role] ?? u.role)}
                      </span>
                      {u.badges.slice(0,3).map((b, bi) => (
                        <span key={bi} title={b.badgeName ?? ''} style={{ fontSize: '11px' }}>{b.badgeIcon ?? '🏅'}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Division (desktop only) */}
                {!isMobile && <p style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.divisionName ?? '—'}</p>}
                {/* Points */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: u.points>0 ? '#F59E0B' : 'var(--text-faint)', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {u.points.toLocaleString('id-ID')}
                  </span>
                  {u.points > 0 && <Zap size={11} style={{ color: '#F59E0B' }}/>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Points Modal */}
      {showAddPoints && (
        <AddPointsModal
          users={allUsers}
          onClose={() => setShowAddPoints(false)}
          onAdded={() => { setShowAddPoints(false); window.location.reload() }}
        />
      )}

      {/* Character card modal */}
      {selected && (
        <CharacterCard
          user={selected}
          expBySource={expBySource[selected.id] ?? {}}
          mood={moodByUser[selected.id] ?? null}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

/* ── Podium Card ─────────────────────────────────────── */
function PodiumCard({ user, rank, isSelf, tall, onClick }: { user: ReturnType<typeof buildRanking>[0]; rank: number; isSelf: boolean; tall?: boolean; onClick?: () => void }) {
  const c = rank===1 ? '#F59E0B' : rank===2 ? 'var(--text-faint)' : '#B45309'
  const h = tall ? 110 : 80
  return (
    <div onClick={onClick} title="Lihat kartu karakter"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '160px', cursor: 'pointer' }}>
      {/* Avatar */}
      <div style={{ position: 'relative' }}>
        <div style={{ width: tall ? '72px' : '60px', height: tall ? '72px' : '60px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${c}`, background: 'var(--surface-hover)' }}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize: tall?'24px':'20px', fontWeight:800, color:c }}>{user.fullName.charAt(0)}</div>
          }
        </div>
        <div style={{ position:'absolute', top:'-8px', left:'50%', transform:'translateX(-50%)', fontSize: tall?'24px':'18px' }}>
          {RANK_LABELS[rank]}
        </div>
      </div>
      {/* Info */}
      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize: tall?'13px':'12px', fontWeight:700, color: isSelf?'#FF8A4C':'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'140px' }}>
          {user.fullName}
        </p>
        <p style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'2px' }}>{user.divisionName ?? '—'}</p>
        <p style={{ fontSize: tall?'18px':'15px', fontWeight:800, color:c, fontFamily:"'Space Grotesk',sans-serif", marginTop:'4px' }}>
          {user.points.toLocaleString('id-ID')} <span style={{ fontSize:'10px', fontWeight:400, color:'var(--text-muted)' }}>poin</span>
        </p>
        {/* Badges */}
        {user.badges.length > 0 && (
          <div style={{ display:'flex', justifyContent:'center', gap:'2px', marginTop:'4px' }}>
            {user.badges.slice(0,4).map((b, i) => <span key={i} title={b.badgeName??''} style={{ fontSize:'13px' }}>{b.badgeIcon??'🏅'}</span>)}
          </div>
        )}
      </div>
      {/* Podium base */}
      <div style={{ width:'100%', height:`${h}px`, background:`linear-gradient(180deg,${c}22,${c}11)`, border:`1px solid ${c}33`, borderRadius:'12px 12px 0 0', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:'28px', fontWeight:800, color:`${c}88`, fontFamily:"'Space Grotesk',sans-serif" }}>{rank}</span>
      </div>
    </div>
  )
}

/* ── Add Points Modal ────────────────────────────────── */
function AddPointsModal({ users, onClose, onAdded }: { users: UserRow[]; onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ userId:'', points:'', reason:'', sourceType:'manual' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string|null>(null)

  const inp: React.CSSProperties = { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'10px', padding:'10px 12px', color:'var(--text-primary)', fontSize:'13px', outline:'none', width:'100%', fontFamily:"'Plus Jakarta Sans',sans-serif" }
  const lbl: React.CSSProperties = { fontSize:'10px', color:'var(--text-muted)', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.06em', textTransform:'uppercase', display:'block', marginBottom:'5px' }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.userId || !form.points || !form.reason) { setError('Semua field wajib diisi'); return }
    setLoading(true); setError(null)
    const res = await fetch('/api/points', {
      method: 'POST', headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ userId:form.userId, points:Number(form.points), reason:form.reason, sourceType:form.sourceType }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Gagal'); setLoading(false); return }
    onAdded()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 py-8" style={{ background:'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-md rounded-2xl flex flex-col max-h-[90vh]" style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-strong)' }}>
        <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <h2 className="font-grotesk font-bold text-[16px] text-[var(--text-primary)]">Beri Poin</h2>
          <button onClick={onClose} style={{ color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', display:'flex' }}><X size={18}/></button>
        </div>
        <form onSubmit={submit} style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'14px', flex:1, overflowY:'auto' }}>
          {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'9px', padding:'10px 14px', fontSize:'13px', color:'var(--red)' }}>{error}</div>}
          <div>
            <label style={lbl}>Anggota *</label>
            <select style={inp} value={form.userId} onChange={e => setForm(f=>({...f,userId:e.target.value}))} required>
              <option value="">— Pilih anggota —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName} — {u.divisionName??'—'}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div>
              <label style={lbl}>Jumlah Poin *</label>
              <input style={inp} type="number" value={form.points} onChange={e => setForm(f=>({...f,points:e.target.value}))} placeholder="100" required/>
            </div>
            <div>
              <label style={lbl}>Kategori</label>
              <select style={inp} value={form.sourceType} onChange={e => setForm(f=>({...f,sourceType:e.target.value}))}>
                {['manual','task','project','kpi','kudos','bonus'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>Alasan / Keterangan *</label>
            <input style={inp} value={form.reason} onChange={e => setForm(f=>({...f,reason:e.target.value}))} placeholder="Contoh: Selesaikan project lebih awal" required/>
          </div>
          <div style={{ display:'flex', gap:'10px', paddingTop:'4px' }}>
            <button type="button" onClick={onClose} style={{ flex:1, background:'var(--border)', border:'1px solid var(--border-strong)', color:'var(--text-secondary)', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, fontSize:'14px' }}>Batal</button>
            <button type="submit" disabled={loading} style={{ flex:2, background:loading?'rgba(245,158,11,0.4)':'rgba(245,158,11,0.9)', border:'none', color: 'var(--on-accent)', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'14px' }}>
              {loading ? 'Menyimpan...' : '⚡ Beri Poin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
