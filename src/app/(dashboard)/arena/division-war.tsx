'use client'

import { useState } from 'react'
import { Swords, Users } from 'lucide-react'
import type { DivisionWar, DivisionStanding } from '@/lib/division-war'

const MEDAL = ['🥇', '🥈', '🥉']
const RANK_COLOR = ['#F5C451', '#C8D0DD', '#D9893E']
const BAR_COLOR = ['#FF6A1A', '#4A9EFF', '#A78BFA', '#3FD08A', '#FF6A8A', '#F5C451']

export function DivisionWar({ data }: { data: DivisionWar }) {
  const [tab, setTab] = useState<'weekly' | 'monthly'>('weekly')
  const rows = tab === 'weekly' ? data.weekly : data.monthly
  const max = Math.max(1, ...rows.map(r => r.totalExp))

  return (
    <div style={{ background: '#161a23', border: '1px solid rgba(74,158,255,0.16)', borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <Swords size={15} color="#4A9EFF" />
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: '#EDF0F5' }}>Divisi War</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 100, padding: 3 }}>
          {(['weekly', 'monthly'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 100, border: 'none', cursor: 'pointer',
                background: tab === t ? 'linear-gradient(90deg,#4A9EFF,#6BB6FF)' : 'transparent',
                color: tab === t ? '#fff' : '#6B7385',
              }}>
              {t === 'weekly' ? 'Minggu Ini' : 'Bulan Ini'}
            </button>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 11, color: '#6B7385', marginBottom: 14 }}>Divisi terkuat berdasarkan total EXP tim 🛡️</p>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#6B7385', fontSize: 13, padding: '24px 0' }}>
          Belum ada EXP terkumpul {tab === 'weekly' ? 'minggu ini' : 'bulan ini'}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((d, i) => <DivisionRow key={d.divisionId ?? 'none'} d={d} rank={i} pct={(d.totalExp / max) * 100} />)}
        </div>
      )}
    </div>
  )
}

function DivisionRow({ d, rank, pct }: { d: DivisionStanding; rank: number; pct: number }) {
  const color = BAR_COLOR[rank % BAR_COLOR.length]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: rank < 3 ? 16 : 13, fontWeight: 800, color: rank < 3 ? RANK_COLOR[rank] : '#6B7385', fontFamily: "'Space Grotesk',sans-serif", width: 22 }}>
          {rank < 3 ? MEDAL[rank] : `#${rank + 1}`}
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#EDF0F5', fontFamily: "'Space Grotesk',sans-serif", flex: 1 }}>{d.divisionName}</span>
        <span style={{ fontSize: 10.5, color: '#6B7385', display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: "'IBM Plex Mono',monospace" }}>
          <Users size={10} /> {d.memberCount} · avg {d.avgExp}
        </span>
        <span style={{ fontSize: 14, fontWeight: 800, color, fontFamily: "'Space Grotesk',sans-serif", minWidth: 64, textAlign: 'right' }}>
          {d.totalExp.toLocaleString('id-ID')}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 100, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(2, pct)}%`, borderRadius: 100, background: color, boxShadow: `0 0 10px ${color}99`, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}
