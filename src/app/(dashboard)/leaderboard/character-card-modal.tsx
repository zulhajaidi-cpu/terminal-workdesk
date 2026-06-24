'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { CharacterCard, type CharacterUser } from './character-card'

// Buka Character Card untuk userId apa pun (mis. dari Mading) — ambil data via /api/character/[id].
export function CharacterCardModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<any | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setData(null); setErr(null)
    fetch(`/api/character/${userId}`)
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Gagal memuat'); return r.json() })
      .then(d => { if (active) setData(d) })
      .catch(e => { if (active) setErr(e.message) })
    return () => { active = false }
  }, [userId])

  if (data) {
    const user: CharacterUser = {
      id: data.id, fullName: data.fullName, avatarUrl: data.avatarUrl, bio: data.bio,
      role: data.role, divisionName: data.divisionName, rank: data.rank ?? undefined,
      badges: data.badges ?? [],
    }
    return <CharacterCard user={user} expBySource={data.expBySource ?? {}} mood={data.mood} prestige={!!data.prestige} onClose={onClose} />
  }

  // Loading / error overlay
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)' }} onClick={onClose}>
      <div className="rounded-2xl flex flex-col items-center gap-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', padding: '32px 40px' }} onClick={e => e.stopPropagation()}>
        {err ? (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{err}</span>
        ) : (
          <>
            <Loader2 size={26} className="animate-spin" style={{ color: '#FF8A4C' }} />
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Memuat kartu karakter…</span>
          </>
        )}
      </div>
    </div>
  )
}
