'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Calendar, Plus, X, MapPin, ExternalLink, Clock, Search, ChevronRight, Pencil, Trash2, Filter, Users, UserPlus, Briefcase } from 'lucide-react'

interface EventRow {
  id: string; title: string; eventName: string|null; notes: string|null; eventType: string
  startAt: string; endAt: string|null; allDay: boolean
  location: string|null; link: string|null
  divisionId: string|null; divisionName: string|null
  createdBy: string|null; creatorName: string|null; createdAt: string
}

interface ParticipantRow {
  eventId: string; userId: string; jobdesk: string|null; userName: string|null; userRole: string|null
}

interface UserOption { id: string; fullName: string; divisionId: string|null; role: string }
interface Division { id: string; name: string }

interface Props {
  events: EventRow[]
  divisions: Division[]
  allUsers: UserOption[]
  participantRows: ParticipantRow[]
  currentUser: { id: string; role: string }
}

const EVENT_TYPES = [
  'Event Internal',
  'Event External',
  'Meeting',
  'Shooting',
  'Photoshoot',
  'Training',
  'Visit',
  'Deadline',
  'Lainnya',
  'Other',
]

const TYPE_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  'Event Internal': { bg:'rgba(255,106,26,0.12)', border:'#FF6A1A', text:'#FFA77A' },
  'Event External': { bg:'rgba(168,85,247,0.12)', border:'#A855F7', text:'#D8B4FE' },
  'Meeting':        { bg:'rgba(74,158,255,0.12)', border:'var(--blue)', text:'#93C5FD' },
  'Shooting':       { bg:'rgba(236,72,153,0.12)', border:'#EC4899', text:'#F9A8D4' },
  'Photoshoot':     { bg:'rgba(236,72,153,0.10)', border:'#EC4899', text:'#F9A8D4' },
  'Training':       { bg:'rgba(16,185,129,0.12)', border:'#10B981', text:'#6EE7B7' },
  'Visit':          { bg:'rgba(245,158,11,0.12)', border:'#F59E0B', text:'#FCD34D' },
  'Deadline':       { bg:'rgba(239,68,68,0.12)',  border:'#EF4444', text:'var(--red)' },
  'Lainnya':        { bg:'rgba(107,115,133,0.12)', border:'var(--text-muted)', text:'var(--text-secondary)' },
  'Other':          { bg:'rgba(107,115,133,0.12)', border:'var(--text-muted)', text:'var(--text-secondary)' },
}

const TYPE_ICONS: Record<string, string> = {
  'Event Internal':'🎪', 'Event External':'🌐', 'Meeting':'📅',
  'Shooting':'🎥', 'Photoshoot':'📸', 'Training':'📚',
  'Visit':'🏃', 'Deadline':'⚑', 'Lainnya':'📌', 'Other':'📌',
}

function getTypeColor(type: string) {
  return TYPE_COLOR[type] ?? TYPE_COLOR['Lainnya']
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short', year:'numeric' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })
}
function groupByMonth(events: EventRow[]) {
  const groups = new Map<string, EventRow[]>()
  for (const e of events) {
    const d = new Date(e.startAt)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(e)
  }
  return groups
}
function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m)-1).toLocaleDateString('id-ID', { month:'long', year:'numeric' })
}
function isUpcoming(iso: string) { return new Date(iso) >= new Date() }
const canManage = (role: string) => ['super_admin','spv_manager','head_director','leader_divisi'].includes(role)

const ROLE_LABELS: Record<string, string> = {
  super_admin:'Super Admin', spv_manager:'Manager', head_director:'Direktur',
  leader_divisi:'SPV', staff:'Staff',
}

export function EventsContent({ events: init, divisions, allUsers, participantRows: initParticipants, currentUser }: Props) {
  const [events, setEvents] = useState(init)
  const [participants, setParticipants] = useState(initParticipants)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('Semua')
  const [divFilter, setDivFilter] = useState('Semua')
  const [timeFilter, setTimeFilter] = useState<'all'|'upcoming'|'past'>('all')
  const [selected, setSelected] = useState<EventRow|null>(null)
  const [modal, setModal] = useState<'create'|'edit'|null>(null)
  const [editTarget, setEditTarget] = useState<EventRow|null>(null)

  const participantMap = useMemo(() => {
    const map = new Map<string, ParticipantRow[]>()
    for (const p of participants) {
      if (!map.has(p.eventId)) map.set(p.eventId, [])
      map.get(p.eventId)!.push(p)
    }
    return map
  }, [participants])

  const filtered = useMemo(() => events.filter(e => {
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !(e.eventName ?? '').toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter !== 'Semua' && e.eventType !== typeFilter) return false
    if (divFilter !== 'Semua' && e.divisionName !== divFilter) return false
    if (timeFilter === 'upcoming' && !isUpcoming(e.startAt)) return false
    if (timeFilter === 'past' && isUpcoming(e.startAt)) return false
    return true
  }), [events, search, typeFilter, divFilter, timeFilter])

  const grouped = useMemo(() => groupByMonth(filtered), [filtered])
  const sortedKeys = [...grouped.keys()].sort((a,b) => b.localeCompare(a))
  const upcomingCount = events.filter(e => isUpcoming(e.startAt)).length

  function openEdit(e: EventRow) { setEditTarget(e); setModal('edit') }
  function openCreate() { setEditTarget(null); setModal('create') }

  async function deleteEvent(id: string) {
    if (!confirm('Hapus event ini?')) return
    await fetch(`/api/calendar/${id}`, { method:'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  function onSaved(ev: EventRow, newParticipants: ParticipantRow[], isEdit: boolean) {
    if (isEdit) setEvents(prev => prev.map(e => e.id === ev.id ? ev : e))
    else setEvents(prev => [ev, ...prev])
    setParticipants(prev => [...prev.filter(p => p.eventId !== ev.id), ...newParticipants])
    setSelected(ev)
    setModal(null)
  }

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const inp: React.CSSProperties = { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'10px', padding:'10px 12px', color:'var(--text-primary)', fontSize:'13px', outline:'none', width:'100%', fontFamily:"'Plus Jakarta Sans',sans-serif" }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-grotesk font-bold text-2xl text-[var(--text-primary)] flex items-center gap-3">
            <Calendar size={22} style={{ color:'var(--blue)' }}/>
            Events & Agenda
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">{upcomingCount} mendatang · {events.length} total event</p>
        </div>
        {canManage(currentUser.role) && (
          <button onClick={openCreate}
            style={{ display:'flex', alignItems:'center', gap:'6px', background:'rgba(74,158,255,0.12)', border:'1px solid rgba(74,158,255,0.3)', borderRadius:'11px', padding:'9px 16px', cursor:'pointer', color:'#93C5FD', fontSize:'13px', fontWeight:600, fontFamily:"'Space Grotesk',sans-serif" }}>
            <Plus size={14}/> Buat Event
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div style={{ position:'relative', flex:'1', minWidth:'200px', maxWidth:'280px' }}>
          <Search size={14} style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari event atau nama acara..." style={{ ...inp, paddingLeft:'32px' }}/>
        </div>

        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {['Semua', ...EVENT_TYPES].map(t => {
            const c = t === 'Semua' ? null : getTypeColor(t)
            const active = typeFilter === t
            return (
              <button key={t} onClick={() => setTypeFilter(t)} style={{ padding:'5px 12px', borderRadius:'100px', fontSize:'11px', fontWeight:600, cursor:'pointer', border:`1px solid ${active ? (c?.border ?? '#FF6A1A') : 'var(--border)'}`, background: active ? (c?.bg ?? 'rgba(255,106,26,0.12)') : 'transparent', color: active ? (c?.text ?? '#FF8A4C') : 'var(--text-muted)' }}>
                {t !== 'Semua' && (TYPE_ICONS[t] ?? '')} {t}
              </button>
            )
          })}
        </div>

        <select value={divFilter} onChange={e => setDivFilter(e.target.value)} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'10px', padding:'8px 12px', color:'var(--text-primary)', fontSize:'12px', outline:'none', cursor:'pointer' }}>
          <option value="Semua">Semua Divisi</option>
          {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>

        <div style={{ display:'flex', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'10px', padding:'3px', gap:'2px' }}>
          {([['all','Semua'],['upcoming','Mendatang'],['past','Lalu']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setTimeFilter(k)} style={{ padding:'5px 10px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:700, background: timeFilter===k ? 'var(--blue)' : 'transparent', color: timeFilter===k ? 'var(--bg-base)' : 'var(--text-muted)', fontFamily:"'Space Grotesk',sans-serif" }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div style={{ display:'grid', gridTemplateColumns: (selected && !isMobile) ? '1fr 400px' : '1fr', gap:'20px', alignItems:'start' }}>
        {/* Event list */}
        <div>
          {filtered.length === 0 ? (
            <div style={{ background:'var(--bg-elevated)', border:'1px dashed var(--border-strong)', borderRadius:'16px', padding:'60px 24px', textAlign:'center' }}>
              <Calendar size={36} style={{ color:'var(--text-faint)', margin:'0 auto 12px' }}/>
              <p style={{ color:'var(--text-muted)', fontSize:'14px' }}>Tidak ada event ditemukan</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedKeys.map(key => (
                <div key={key}>
                  <p style={{ fontSize:'10px', color:'var(--text-faint)', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'10px', paddingLeft:'4px' }}>
                    {monthLabel(key)}
                  </p>
                  <div className="space-y-2">
                    {grouped.get(key)!.map(ev => {
                      const c = getTypeColor(ev.eventType)
                      const past = !isUpcoming(ev.startAt)
                      const isSelected = selected?.id === ev.id
                      const evParticipants = participantMap.get(ev.id) ?? []
                      return (
                        <div key={ev.id} onClick={() => setSelected(isSelected ? null : ev)}
                          style={{ display:'grid', gridTemplateColumns:'56px 1fr auto', gap:'12px', background: isSelected ? `${c.bg}` : 'var(--bg-elevated)', border:`1px solid ${isSelected ? c.border+'60' : 'var(--border)'}`, borderRadius:'14px', padding:'14px 16px', cursor:'pointer', opacity: past ? 0.7 : 1, transition:'all 0.15s', alignItems:'center' }}
                          onMouseEnter={e => !isSelected && (e.currentTarget.style.borderColor='var(--border-strong)')}
                          onMouseLeave={e => !isSelected && (e.currentTarget.style.borderColor='var(--border)')}>

                          <div style={{ textAlign:'center', background:'var(--surface-hover)', borderRadius:'10px', padding:'8px 4px' }}>
                            <p style={{ fontSize:'20px', fontWeight:800, color:'var(--text-primary)', fontFamily:"'Space Grotesk',sans-serif", lineHeight:1 }}>
                              {new Date(ev.startAt).getDate()}
                            </p>
                            <p style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:"'IBM Plex Mono',monospace", textTransform:'uppercase' }}>
                              {new Date(ev.startAt).toLocaleDateString('id-ID',{month:'short'})}
                            </p>
                          </div>

                          <div style={{ minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                              <span style={{ fontSize:'12px' }}>{TYPE_ICONS[ev.eventType] ?? '📌'}</span>
                              <p style={{ fontSize:'14px', fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</p>
                            </div>
                            {ev.eventName && (
                              <p style={{ fontSize:'11px', color:'var(--text-secondary)', marginBottom:'4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontStyle:'italic' }}>"{ev.eventName}"</p>
                            )}
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', alignItems:'center' }}>
                              <span style={{ fontSize:'11px', background:c.bg, color:c.text, padding:'1px 8px', borderRadius:'100px', fontWeight:600, border:`1px solid ${c.border}33` }}>{ev.eventType}</span>
                              <span style={{ fontSize:'11px', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'3px' }}><Clock size={10}/>{ev.allDay ? 'Seharian' : fmtTime(ev.startAt)}</span>
                              {ev.location && <span style={{ fontSize:'11px', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'3px' }}><MapPin size={10}/>{ev.location}</span>}
                              {evParticipants.length > 0 && <span style={{ fontSize:'11px', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'3px' }}><Users size={10}/>{evParticipants.length} orang</span>}
                            </div>
                          </div>

                          <ChevronRight size={14} style={{ color: isSelected ? c.border : 'var(--text-faint)', transform: isSelected ? 'rotate(90deg)' : 'none', transition:'transform 0.2s', flexShrink:0 }}/>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (() => {
          const c = getTypeColor(selected.eventType)
          const past = !isUpcoming(selected.startAt)
          const isOwner = selected.createdBy === currentUser.id || ['super_admin','spv_manager','head_director'].includes(currentUser.role)
          const evParticipants = participantMap.get(selected.id) ?? []
          const panelStyle: React.CSSProperties = isMobile
            ? { background:'var(--bg-elevated)', border:`1px solid ${c.border}40`, borderRadius:'20px 20px 0 0', overflow:'hidden', position:'fixed', bottom:0, left:0, right:0, maxHeight:'85vh', overflowY:'auto', zIndex:50, boxShadow:'0 -8px 40px rgba(0,0,0,0.6)' }
            : { background:'var(--bg-elevated)', border:`1px solid ${c.border}40`, borderRadius:'18px', overflow:'hidden', position:'sticky', top:'80px', maxHeight:'calc(100vh - 120px)', overflowY:'auto' }
          return (
            <>
            {isMobile && <div onClick={() => setSelected(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:49 }}/>}
            <div style={panelStyle}>
              {/* Panel header */}
              <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:c.bg, position:'sticky', top:0, zIndex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'20px' }}>{TYPE_ICONS[selected.eventType]??'📌'}</span>
                  <div>
                    <span style={{ fontSize:'11px', fontWeight:700, color:c.text, fontFamily:"'Space Grotesk',sans-serif", textTransform:'uppercase', letterSpacing:'0.05em' }}>{selected.eventType}</span>
                    {selected.eventName && <p style={{ fontSize:'11px', color:c.text, opacity:0.7, marginTop:'1px' }}>{selected.eventName}</p>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  {isOwner && <button onClick={() => openEdit(selected)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:'4px' }}><Pencil size={14}/></button>}
                  {isOwner && <button onClick={() => deleteEvent(selected.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', display:'flex', padding:'4px' }}><Trash2 size={14}/></button>}
                  <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:'4px' }}><X size={16}/></button>
                </div>
              </div>

              <div style={{ padding:'20px' }}>
                <h2 style={{ fontSize:'18px', fontWeight:800, color:'var(--text-primary)', fontFamily:"'Space Grotesk',sans-serif", marginBottom:'4px', lineHeight:1.3 }}>{selected.title}</h2>
                {selected.eventName && (
                  <p style={{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'16px', fontStyle:'italic' }}>Nama Acara: "{selected.eventName}"</p>
                )}

                <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
                  <MetaItem icon={<Clock size={13}/>} label="Waktu">
                    {selected.allDay
                      ? `Seharian · ${fmtDateShort(selected.startAt)}`
                      : `${fmtDate(selected.startAt)} ${fmtTime(selected.startAt)}${selected.endAt ? ` – ${fmtTime(selected.endAt)}` : ''}`
                    }
                  </MetaItem>
                  {selected.location && <MetaItem icon={<MapPin size={13}/>} label="Lokasi">{selected.location}</MetaItem>}
                  {selected.divisionName && <MetaItem icon={<Filter size={13}/>} label="Divisi">{selected.divisionName}</MetaItem>}
                  {selected.creatorName && <MetaItem icon={<Calendar size={13}/>} label="Dibuat oleh">{selected.creatorName}</MetaItem>}
                </div>

                {selected.notes && (
                  <div style={{ background:'var(--surface-subtle)', borderRadius:'10px', padding:'12px', marginBottom:'16px' }}>
                    <p style={{ fontSize:'12px', color:'var(--text-secondary)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{selected.notes}</p>
                  </div>
                )}

                {/* Participants */}
                {evParticipants.length > 0 && (
                  <div style={{ marginBottom:'16px' }}>
                    <p style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }}>
                      <Users size={11}/> Tim ({evParticipants.length} orang)
                    </p>
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      {evParticipants.map(p => (
                        <div key={p.userId} style={{ display:'flex', alignItems:'center', gap:'10px', background:'var(--surface-subtle)', borderRadius:'9px', padding:'8px 12px' }}>
                          <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:c.bg, border:`1px solid ${c.border}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <span style={{ fontSize:'11px', fontWeight:700, color:c.text }}>{(p.userName??'?').charAt(0)}</span>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:'12px', fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.userName ?? '—'}</p>
                            {p.jobdesk && <p style={{ fontSize:'11px', color:c.text, marginTop:'1px', display:'flex', alignItems:'center', gap:'4px' }}><Briefcase size={9}/> {p.jobdesk}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {past && (
                  <div style={{ background:'rgba(107,115,133,0.1)', border:'1px solid rgba(107,115,133,0.2)', borderRadius:'9px', padding:'8px 12px', marginBottom:'14px' }}>
                    <p style={{ fontSize:'11px', color:'var(--text-muted)' }}>Event ini sudah berlalu</p>
                  </div>
                )}

                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {selected.link && (
                    <a href={selected.link} target="_blank" rel="noreferrer"
                      style={{ display:'flex', alignItems:'center', gap:'6px', background:c.bg, border:`1px solid ${c.border}40`, borderRadius:'9px', padding:'8px 14px', color:c.text, fontSize:'12px', fontWeight:600, textDecoration:'none', fontFamily:"'Space Grotesk',sans-serif" }}>
                      <ExternalLink size={12}/> Link Event
                    </a>
                  )}
                  <Link href="/calendar"
                    style={{ display:'flex', alignItems:'center', gap:'6px', background:'var(--surface-hover)', border:'1px solid var(--border-strong)', borderRadius:'9px', padding:'8px 14px', color:'var(--text-secondary)', fontSize:'12px', fontWeight:600, textDecoration:'none', fontFamily:"'Space Grotesk',sans-serif" }}>
                    <Calendar size={12}/> Lihat di Kalender
                  </Link>
                </div>
              </div>
            </div>
            </>
          )
        })()}
      </div>

      {modal && (
        <EventModal
          mode={modal}
          event={editTarget}
          existingParticipants={editTarget ? (participantMap.get(editTarget.id) ?? []) : []}
          divisions={divisions}
          allUsers={allUsers}
          currentUser={currentUser}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

/* ── MetaItem ────────────────────────────────────────── */
function MetaItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
      <div style={{ color:'var(--text-muted)', paddingTop:'1px', flexShrink:0 }}>{icon}</div>
      <div>
        <p style={{ fontSize:'10px', color:'var(--text-faint)', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:'1px' }}>{label}</p>
        <p style={{ fontSize:'13px', color:'var(--text-secondary)' }}>{children}</p>
      </div>
    </div>
  )
}

/* ── EventModal ──────────────────────────────────────── */
interface FormParticipant { userId: string; jobdesk: string }

function EventModal({ mode, event, existingParticipants, divisions, allUsers, currentUser, onClose, onSaved }:
  { mode:'create'|'edit'; event:EventRow|null; existingParticipants:ParticipantRow[]; divisions:Division[]; allUsers:UserOption[]; currentUser:{id:string;role:string}; onClose:()=>void; onSaved:(ev:EventRow,participants:ParticipantRow[],isEdit:boolean)=>void }) {

  const [form, setForm] = useState({
    title: event?.title ?? '',
    eventName: event?.eventName ?? '',
    notes: event?.notes ?? '',
    eventType: event?.eventType ?? 'Event Internal',
    startAt: event?.startAt ? new Date(event.startAt).toISOString().slice(0,16) : '',
    endAt: event?.endAt ? new Date(event.endAt).toISOString().slice(0,16) : '',
    allDay: event?.allDay ?? false,
    location: event?.location ?? '',
    link: event?.link ?? '',
    divisionId: event?.divisionId ?? '',
  })
  const [participants, setParticipants] = useState<FormParticipant[]>(
    existingParticipants.map(p => ({ userId: p.userId, jobdesk: p.jobdesk ?? '' }))
  )
  const [userSearch, setUserSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)

  const inp: React.CSSProperties = { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'10px', padding:'10px 12px', color:'var(--text-primary)', fontSize:'13px', outline:'none', width:'100%', fontFamily:"'Plus Jakarta Sans',sans-serif" }
  const lbl: React.CSSProperties = { fontSize:'10px', color:'var(--text-muted)', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.06em', textTransform:'uppercase', display:'block', marginBottom:'5px' }

  const addedIds = new Set(participants.map(p => p.userId))
  const availableUsers = allUsers.filter(u =>
    !addedIds.has(u.id) &&
    (u.fullName.toLowerCase().includes(userSearch.toLowerCase()))
  )

  function addParticipant(userId: string) {
    setParticipants(prev => [...prev, { userId, jobdesk:'' }])
    setUserSearch('')
  }
  function removeParticipant(userId: string) {
    setParticipants(prev => prev.filter(p => p.userId !== userId))
  }
  function updateJobdesk(userId: string, jobdesk: string) {
    setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, jobdesk } : p))
  }

  const getUserName = (id: string) => allUsers.find(u => u.id === id)?.fullName ?? id

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.startAt) { setError('Judul dan waktu mulai wajib diisi'); return }

    // endAt required unless allDay
    const endAtVal = form.allDay
      ? (form.endAt || form.startAt.slice(0,10) + 'T23:59')
      : form.endAt || form.startAt

    setLoading(true); setError(null)
    const body = {
      title: form.title,
      eventName: form.eventName || null,
      notes: form.notes || null,
      eventType: form.eventType,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(endAtVal).toISOString(),
      allDay: form.allDay,
      location: form.location || null,
      link: form.link || null,
      divisionId: form.divisionId || null,
      participants: participants.map(p => ({ userId: p.userId, jobdesk: p.jobdesk || null })),
    }

    const url = mode === 'edit' ? `/api/calendar/${event!.id}` : '/api/calendar'
    const method = mode === 'edit' ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Gagal menyimpan'); setLoading(false); return }

    const savedId = mode === 'edit' ? event!.id : data.id
    const savedEvent: EventRow = {
      ...(event ?? {}),
      ...body,
      id: savedId,
      eventName: body.eventName,
      notes: body.notes,
      divisionName: divisions.find(d => d.id === body.divisionId)?.name ?? event?.divisionName ?? null,
      createdBy: event?.createdBy ?? currentUser.id,
      creatorName: event?.creatorName ?? null,
      createdAt: event?.createdAt ?? new Date().toISOString(),
    } as EventRow

    const savedParticipants: ParticipantRow[] = participants.map(p => ({
      eventId: savedId,
      userId: p.userId,
      jobdesk: p.jobdesk || null,
      userName: getUserName(p.userId),
      userRole: allUsers.find(u => u.id === p.userId)?.role ?? null,
    }))

    onSaved(savedEvent, savedParticipants, mode === 'edit')
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 py-8" style={{ background:'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh]" style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-strong)' }}>
        {/* Modal header */}
        <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-elevated)', flexShrink:0 }}>
          <h2 className="font-grotesk font-bold text-[16px] text-[var(--text-primary)]">{mode==='create'?'Buat Event Baru':'Edit Event'}</h2>
          <button onClick={onClose} style={{ color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', display:'flex' }}><X size={18}/></button>
        </div>

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
          <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'14px', overflowY:'auto', flex:1 }}>
            {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'9px', padding:'10px 14px', fontSize:'13px', color:'var(--red)' }}>{error}</div>}

            {/* Tipe */}
            <div>
              <label style={lbl}>Tipe Event *</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {EVENT_TYPES.map(t => {
                  const c = getTypeColor(t)
                  const active = form.eventType === t
                  return (
                    <button key={t} type="button" onClick={() => setForm(f=>({...f,eventType:t}))}
                      style={{ padding:'6px 12px', borderRadius:'100px', fontSize:'11px', fontWeight:600, cursor:'pointer', border:`1px solid ${active ? c.border : 'var(--border)'}`, background: active ? c.bg : 'transparent', color: active ? c.text : 'var(--text-muted)', transition:'all 0.12s' }}>
                      {TYPE_ICONS[t]} {t}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={lbl}>Judul / Kode Event *</label>
                <input style={inp} value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="mis. Event 001, Meeting Bulanan" required/>
              </div>
              <div>
                <label style={lbl}>Nama Acara (Resmi)</label>
                <input style={inp} value={form.eventName} onChange={e => setForm(f=>({...f,eventName:e.target.value}))} placeholder="mis. Festival Brand Goda 2025"/>
              </div>
            </div>

            <div>
              <label style={lbl}>Divisi</label>
              <select style={inp} value={form.divisionId} onChange={e => setForm(f=>({...f,divisionId:e.target.value}))}>
                <option value="">— Semua Divisi —</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <input type="checkbox" id="allDay" checked={form.allDay} onChange={e => setForm(f=>({...f,allDay:e.target.checked}))} style={{ accentColor:'var(--blue)', width:'16px', height:'16px' }}/>
              <label htmlFor="allDay" style={{ fontSize:'13px', color:'var(--text-secondary)', cursor:'pointer' }}>Seharian (All Day)</label>
            </div>

            {!form.allDay ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={lbl}>Mulai *</label>
                  <input style={inp} type="datetime-local" value={form.startAt} onChange={e => setForm(f=>({...f,startAt:e.target.value}))} required/>
                </div>
                <div>
                  <label style={lbl}>Selesai</label>
                  <input style={inp} type="datetime-local" value={form.endAt} onChange={e => setForm(f=>({...f,endAt:e.target.value}))}/>
                </div>
              </div>
            ) : (
              <div>
                <label style={lbl}>Tanggal *</label>
                <input style={inp} type="date" value={form.startAt.slice(0,10)} onChange={e => setForm(f=>({...f,startAt:e.target.value+'T00:00',endAt:e.target.value+'T23:59'}))} required/>
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={lbl}>Lokasi</label>
                <input style={inp} value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} placeholder="Ruangan / alamat / online"/>
              </div>
              <div>
                <label style={lbl}>Link External</label>
                <input style={inp} value={form.link} onChange={e => setForm(f=>({...f,link:e.target.value}))} placeholder="https://..."/>
              </div>
            </div>

            <div>
              <label style={lbl}>Catatan / Deskripsi</label>
              <textarea style={{ ...inp, minHeight:'70px', resize:'vertical' }} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Brief, detail rundown, dll..."/>
            </div>

            {/* Participants */}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:'14px' }}>
              <label style={{ ...lbl, display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
                <UserPlus size={11}/> Assign Tim & Jobdesk
              </label>

              {/* Added participants */}
              {participants.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'10px' }}>
                  {participants.map(p => (
                    <div key={p.userId} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:'8px', alignItems:'center', background:'var(--surface-subtle)', borderRadius:'9px', padding:'8px 10px' }}>
                      <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{getUserName(p.userId)}</p>
                      <input
                        style={{ background:'var(--surface-hover)', border:'1px solid var(--border-strong)', borderRadius:'7px', padding:'5px 8px', color:'var(--text-primary)', fontSize:'12px', outline:'none', fontFamily:"'Plus Jakarta Sans',sans-serif" }}
                        placeholder="Jobdesk (mis. Fotografer, MC...)"
                        value={p.jobdesk}
                        onChange={e => updateJobdesk(p.userId, e.target.value)}
                      />
                      <button type="button" onClick={() => removeParticipant(p.userId)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', display:'flex', padding:'2px' }}><X size={13}/></button>
                    </div>
                  ))}
                </div>
              )}

              {/* User search to add */}
              <div style={{ position:'relative' }}>
                <Search size={13} style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
                <input
                  style={{ ...inp, paddingLeft:'30px' }}
                  placeholder="Cari dan tambah anggota tim..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
                {userSearch && availableUsers.length > 0 && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg-card)', border:'1px solid var(--border-strong)', borderRadius:'10px', zIndex:10, overflow:'hidden', marginTop:'4px', maxHeight:'180px', overflowY:'auto' }}>
                    {availableUsers.slice(0,8).map(u => (
                      <button key={u.id} type="button" onClick={() => addParticipant(u.id)}
                        style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', color:'var(--text-primary)', textAlign:'left' }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--border)'}
                        onMouseLeave={e => e.currentTarget.style.background='none'}>
                        <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:'rgba(255,106,26,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span style={{ fontSize:'10px', fontWeight:700, color:'#FF8A4C' }}>{u.fullName.charAt(0)}</span>
                        </div>
                        <div>
                          <p style={{ fontSize:'12px', fontWeight:600 }}>{u.fullName}</p>
                          <p style={{ fontSize:'10px', color:'var(--text-muted)' }}>Staff</p>
                        </div>
                        <Plus size={12} style={{ marginLeft:'auto', color:'#4ADE80' }}/>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {participants.length > 0 && (
                <p style={{ fontSize:'11px', color:'var(--text-faint)', marginTop:'6px' }}>{participants.length} orang di-assign ke event ini</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', gap:'10px', background:'var(--bg-elevated)', flexShrink:0 }}>
            <button type="button" onClick={onClose} style={{ flex:1, background:'var(--border)', border:'1px solid var(--border-strong)', color:'var(--text-secondary)', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, fontSize:'14px' }}>Batal</button>
            <button type="submit" disabled={loading} style={{ flex:2, background:loading?'rgba(74,158,255,0.4)':'rgba(74,158,255,0.9)', border:'none', color: 'var(--on-accent)', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'14px' }}>
              {loading ? 'Menyimpan...' : mode==='create' ? '+ Buat Event' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
