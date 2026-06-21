'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Plus, X, MapPin, ExternalLink,
  Clock, Pencil, Trash2, FolderKanban, CheckSquare, ClipboardCheck,
  Calendar as CalIcon, ArrowRight, AlertCircle,
} from 'lucide-react'

/* ═══════════════════ CONSTANTS ═════════════════════════ */
const GRID_START = 7        // 7:00 AM
const GRID_END   = 22       // 10:00 PM
const HOUR_H     = 64       // px per hour
const HOURS      = Array.from({ length: GRID_END - GRID_START }, (_, i) => i + GRID_START)

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAYS_SHORT = ['Sen','Sel','Rab','Kam','Jum','Sab','Min']
const DAYS_FULL  = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu']
const EVENT_TYPES = ['Meeting','Shooting','Visit','Deadline','Other']

/* ═══════════════════ TYPES ═════════════════════════════ */
interface CalEventRow {
  id: string; title: string; eventType: string
  startAt: string; endAt: string; allDay: boolean
  location: string|null; link: string|null; notes: string|null
  divisionId: string|null; relatedProjectId: string|null
  createdBy: string; divisionName: string|null
}
interface ProjectRow {
  id: string; name: string; projectCode: string; status: string; priority: string
  startDate: string; deadline: string; divisionName: string|null; divisionId: string|null
}
interface TaskRow {
  id: string; name: string; dueDate: string; status: string; priority: string
  isOverdue: boolean; projectName: string|null; divisionName: string|null; divisionId: string|null
}
interface ApprovalRow {
  id: string; projectName: string|null; status: string
  currentStep: number; requesterName: string|null; createdAt: string
  divisionName: string|null; divisionId: string|null
}
interface DisplayEvent {
  key: string; id: string; title: string
  startAt: Date; endAt: Date; allDay: boolean
  src: 'event'|'project_start'|'project_deadline'|'task'|'approval'
  eventType?: string; priority?: string; status?: string; isOverdue?: boolean
  location?: string; extLink?: string; intLink?: string; notes?: string
  divisionName?: string; divisionId?: string|null; projectName?: string; requesterName?: string; createdBy?: string
  bg: string; border: string; text: string; dot: string
  icon: string
}
interface Props {
  calEvents: CalEventRow[]
  projectRows: ProjectRow[]
  taskRows: TaskRow[]
  approvalRows: ApprovalRow[]
  divisions: { id: string; name: string }[]
  projectsForForm: { id: string; name: string }[]
  currentUser: { id: string; role: string; divisionId: string|null }
}

/* ═══════════════════ COLORS — per division (fixed) ═════ */
// Setiap divisi punya warna tetap supaya kalender langsung kebaca "ini punya siapa".
const DIVISION_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'Branding':           { bg:'rgba(236,72,153,0.18)', border:'#EC4899', text:'#F9A8D4', dot:'#EC4899' },
  'Creative Marketing': { bg:'rgba(74,158,255,0.18)',  border:'#4A9EFF', text:'#93C5FD', dot:'#4A9EFF' },
  'Retail':              { bg:'rgba(16,185,129,0.18)', border:'#10B981', text:'#6EE7B7', dot:'#10B981' },
}
const NO_DIVISION_COLOR = { bg:'rgba(148,163,184,0.16)', border:'#94A3B8', text:'#CBD5E1', dot:'#94A3B8' }

function colorForDivision(name?: string | null) {
  if (!name) return NO_DIVISION_COLOR
  return DIVISION_COLORS[name] ?? NO_DIVISION_COLOR
}

/* Icon per tipe/sumber event — warna sekarang ditentukan oleh divisi, bukan tipe. */
const ICON: Record<string, string> = {
  Meeting:'📅', Shooting:'📅', Visit:'📅', Deadline:'📅', Other:'📅',
  project_start:'🚀', project_deadline:'⚑', task:'✓', task_overdue:'✓', approval:'⏳',
}

/* ═══════════════════ HELPERS ═══════════════════════════ */
function sd(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function fmtTime(d: Date) { return d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',hour12:false}) }
function fmtShortDate(d: Date) { return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}` }
function fmtFullDate(d: Date) { return `${DAYS_FULL[(d.getDay()+6)%7]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` }
function localStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function eventTop(ev: DisplayEvent) {
  const h = ev.startAt.getHours() + ev.startAt.getMinutes()/60
  return Math.max(0, (h - GRID_START) * HOUR_H)
}
function eventHeight(ev: DisplayEvent) {
  const dur = (ev.endAt.getTime() - ev.startAt.getTime()) / 3_600_000
  return Math.max(26, Math.min(dur, GRID_END - GRID_START) * HOUR_H)
}
function nowY() {
  const n = new Date()
  return (n.getHours() + n.getMinutes()/60 - GRID_START) * HOUR_H
}

/* ═══════════════════ BUILD DISPLAY EVENTS ══════════════ */
function buildEvents(
  cal: CalEventRow[], projects: ProjectRow[], tasks: TaskRow[],
  approvals: ApprovalRow[], filters: Set<string>
): DisplayEvent[] {
  const evs: DisplayEvent[] = []

  if (filters.has('event')) {
    for (const e of cal) {
      evs.push({
        key:`ev-${e.id}`, id:e.id, title:e.title, icon:ICON[e.eventType] ?? '📅',
        startAt:new Date(e.startAt), endAt:new Date(e.endAt), allDay:e.allDay,
        src:'event', eventType:e.eventType,
        location:e.location??undefined, extLink:e.link??undefined, notes:e.notes??undefined,
        divisionName:e.divisionName??undefined, divisionId:e.divisionId, createdBy:e.createdBy,
        ...colorForDivision(e.divisionName),
      })
    }
  }

  if (filters.has('project')) {
    for (const p of projects) {
      if (p.startDate) {
        const d = new Date(p.startDate); d.setHours(8,0,0,0)
        evs.push({
          key:`ps-${p.id}`, id:p.id, title:p.name, icon:ICON.project_start,
          startAt:d, endAt:new Date(d.getTime()+3_600_000), allDay:true,
          src:'project_start', priority:p.priority, status:p.status,
          intLink:`/projects/${p.id}`, divisionName:p.divisionName??undefined, divisionId:p.divisionId,
          ...colorForDivision(p.divisionName),
        })
      }
      if (p.deadline) {
        const d = new Date(p.deadline); d.setHours(17,0,0,0)
        evs.push({
          key:`pd-${p.id}`, id:p.id, title:p.name, icon:ICON.project_deadline,
          startAt:d, endAt:new Date(d.getTime()+3_600_000), allDay:true,
          src:'project_deadline', priority:p.priority, status:p.status,
          intLink:`/projects/${p.id}`, divisionName:p.divisionName??undefined, divisionId:p.divisionId,
          ...colorForDivision(p.divisionName),
        })
      }
    }
  }

  if (filters.has('task')) {
    for (const t of tasks) {
      const d = new Date(t.dueDate)
      const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0
      if (!hasTime) d.setHours(0,0,0,0)
      evs.push({
        key:`tk-${t.id}`, id:t.id, title:t.name, icon:ICON.task,
        startAt:d, endAt:new Date(d.getTime()+3_600_000), allDay:!hasTime,
        src:'task', priority:t.priority, status:t.status, isOverdue:t.isOverdue,
        projectName:t.projectName??undefined, divisionName:t.divisionName??undefined, divisionId:t.divisionId,
        intLink:'/tasks', ...colorForDivision(t.divisionName),
      })
    }
  }

  if (filters.has('approval')) {
    for (const a of approvals) {
      if (a.status !== 'Pending') continue
      const d = new Date(a.createdAt)
      evs.push({
        key:`apv-${a.id}`, id:a.id, title:a.projectName??'Approval', icon:ICON.approval,
        startAt:d, endAt:d, allDay:true, src:'approval', status:a.status,
        projectName:a.projectName??undefined, requesterName:a.requesterName??undefined,
        divisionName:a.divisionName??undefined, divisionId:a.divisionId,
        intLink:'/approvals', ...colorForDivision(a.divisionName),
      })
    }
  }

  return evs
}

/* ═══════════════════ OVERLAP LAYOUT ════════════════════ */
function layoutTimed(evs: DisplayEvent[]) {
  const sorted = [...evs].sort((a,b) => a.startAt.getTime()-b.startAt.getTime())
  const cols: Date[] = []
  const assigned = sorted.map(ev => {
    let c = cols.findIndex(end => end <= ev.startAt)
    if (c < 0) { c = cols.length; cols.push(new Date(0)) }
    cols[c] = ev.endAt
    return { ev, col:c }
  })
  const numCols = cols.length || 1
  return assigned.map(({ ev, col }) => ({
    ev, col, numCols,
    left:`${col * (100/numCols)}%`,
    width:`${100/numCols}%`,
  }))
}

/* ═══════════════════ MAIN COMPONENT ════════════════════ */
type FilterKey = 'event'|'project'|'task'|'approval'

export function CalendarContent({ calEvents: initCal, projectRows, taskRows, approvalRows, divisions, projectsForForm, currentUser }: Props) {
  const today    = useMemo(() => new Date(), [])
  const [view, setView]         = useState<'month'|'week'>('month')
  const [anchor, setAnchor]     = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [filters, setFilters]   = useState<Set<FilterKey>>(new Set(['event','project','task','approval']))
  const [selDay, setSelDay]     = useState<Date>(today)
  const [selEvent, setSelEvent] = useState<DisplayEvent|null>(null)
  const [showModal, setShowModal]     = useState(false)
  const [editCalEv, setEditCalEv]     = useState<CalEventRow|null>(null)
  const [defaultDate, setDefaultDate] = useState<string|null>(null)
  const [calEvents, setCalEvents]     = useState<CalEventRow[]>(initCal)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [nowLine, setNowLine]   = useState(nowY())

  // Auto-scroll to current time on week view
  useEffect(() => {
    if (view === 'week' && scrollRef.current) {
      const top = Math.max(0, nowY() - 120)
      scrollRef.current.scrollTop = top
    }
  }, [view])

  // Update now-line every minute
  useEffect(() => {
    const id = setInterval(() => setNowLine(nowY()), 60_000)
    return () => clearInterval(id)
  }, [])

  const allEvs = useMemo(
    () => buildEvents(calEvents, projectRows, taskRows, approvalRows, filters),
    [calEvents, projectRows, taskRows, approvalRows, filters]
  )

  const periodLabel = useMemo(() => {
    if (view === 'week') {
      const end = new Date(anchor); end.setDate(end.getDate()+6)
      return anchor.getMonth()===end.getMonth()
        ? `${anchor.getDate()}–${end.getDate()} ${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
        : `${anchor.getDate()} ${MONTHS[anchor.getMonth()].slice(0,3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0,3)} ${end.getFullYear()}`
    }
    return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
  }, [anchor, view])

  const navigate = useCallback((dir: -1|1) => {
    setAnchor(prev => {
      const d = new Date(prev)
      view==='week' ? d.setDate(d.getDate()+dir*7) : d.setMonth(d.getMonth()+dir)
      return d
    })
  }, [view])

  function goToday() {
    setSelDay(today)
    if (view==='week') {
      const d = new Date(today)
      const diff = d.getDay()===0 ? -6 : 1-d.getDay()
      d.setDate(d.getDate()+diff); setAnchor(d)
    } else {
      setAnchor(new Date(today.getFullYear(), today.getMonth(), 1))
    }
  }

  function switchView(v: 'month'|'week') {
    if (v===view) return
    if (v==='week') {
      const d = new Date(selDay)
      const diff = d.getDay()===0 ? -6 : 1-d.getDay()
      d.setDate(d.getDate()+diff); setAnchor(d)
    } else {
      setAnchor(new Date(selDay.getFullYear(), selDay.getMonth(), 1))
    }
    setView(v)
  }

  function toggleFilter(f: FilterKey) {
    setFilters(prev => {
      const s = new Set(prev)
      s.has(f) && s.size > 1 ? s.delete(f) : s.add(f)
      return s
    })
  }

  function evOn(date: Date) { return allEvs.filter(e => sd(e.startAt, date)) }
  function timedOn(date: Date) { return allEvs.filter(e => sd(e.startAt, date) && !e.allDay) }
  function allDayOn(date: Date) { return allEvs.filter(e => sd(e.startAt, date) && e.allDay) }

  const monthDays = useMemo(() => {
    const y=anchor.getFullYear(), m=anchor.getMonth()
    const first=new Date(y,m,1); const last=new Date(y,m+1,0)
    const startDow = first.getDay()===0 ? 6 : first.getDay()-1
    const days: Date[] = []
    for (let i=startDow;i>0;i--) days.push(new Date(y,m,1-i))
    for (let d=1;d<=last.getDate();d++) days.push(new Date(y,m,d))
    while (days.length%7!==0) days.push(new Date(days[days.length-1].getTime()+86_400_000))
    return days
  }, [anchor])

  const weekDays = useMemo(() => {
    const days: Date[] = []
    for (let i=0;i<7;i++) { const d=new Date(anchor); d.setDate(anchor.getDate()+i); days.push(d) }
    return days
  }, [anchor])

  const upcoming = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0)
    const lim = new Date(now); lim.setDate(lim.getDate()+14)
    return allEvs.filter(e => e.startAt>=now && e.startAt<=lim)
      .sort((a,b) => a.startAt.getTime()-b.startAt.getTime())
      .slice(0,25)
  }, [allEvs])

  const selDayEvs = evOn(selDay)

  async function handleDelete(id: string) {
    if (!confirm('Hapus event ini?')) return
    const res = await fetch(`/api/calendar/${id}`, { method:'DELETE' })
    if (res.ok) { setCalEvents(p => p.filter(e => e.id!==id)); setSelEvent(null) }
  }

  function onSaved(saved: CalEventRow, isNew: boolean) {
    setCalEvents(p => isNew ? [...p, saved] : p.map(e => e.id===saved.id ? saved : e))
    setShowModal(false); setEditCalEv(null); setDefaultDate(null)
  }

  function openCreate(date?: Date) {
    setEditCalEv(null)
    setDefaultDate(localStr(date ?? selDay))
    setShowModal(true)
  }

  /* Filter chip config */
  const CHIPS: { key: FilterKey; label: string; color: string; icon: React.ReactNode; count: number }[] = [
    { key:'event',    label:'Events',    color:'#FF8A4C', icon:<CalIcon size={10}/>,        count:calEvents.length },
    { key:'project',  label:'Projects',  color:'#10B981', icon:<FolderKanban size={10}/>,   count:projectRows.length },
    { key:'task',     label:'Tasks',     color:'#F59E0B', icon:<CheckSquare size={10}/>,    count:taskRows.length },
    { key:'approval', label:'Approvals', color:'#7C3AED', icon:<ClipboardCheck size={10}/>, count:approvalRows.filter(a=>a.status==='Pending').length },
  ]

  return (
    <div className="flex flex-col animate-fade-in" style={{ gap:'14px' }}>

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex" style={{ background:'#141925', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'3px' }}>
            <button onClick={() => navigate(-1)} style={navBtn}><ChevronLeft size={14}/></button>
            <button onClick={() => navigate(1)}  style={navBtn}><ChevronRight size={14}/></button>
          </div>
          <h1 className="font-grotesk font-bold text-[18px] text-[#EDF0F5]" style={{ minWidth:'220px' }}>{periodLabel}</h1>
          <button onClick={goToday} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'5px 13px', cursor:'pointer', color:'#A5AEC0', fontSize:'12px', fontWeight:600 }}>Hari ini</button>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ display:'flex', background:'#141925', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'3px', gap:'2px' }}>
            {(['month','week'] as const).map(v => (
              <button key={v} onClick={() => switchView(v)}
                style={{ padding:'5px 16px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:700, background:view===v?'#FF6A1A':'transparent', color:view===v?'#0C0F16':'#6B7385', fontFamily:"'Space Grotesk',sans-serif", transition:'all 0.15s' }}>
                {v==='month'?'Bulan':'Minggu'}
              </button>
            ))}
          </div>
          <button onClick={() => openCreate()}
            style={{ background:'#FF6A1A', color:'#0C0F16', border:'none', borderRadius:'10px', padding:'8px 16px', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'13px', display:'flex', alignItems:'center', gap:'5px' }}>
            <Plus size={14}/> Tambah Event
          </button>
        </div>
      </div>

      {/* ── SOURCE FILTERS ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span style={{ fontSize:'11px', color:'#4a5160', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.05em' }}>TAMPILKAN:</span>
        {CHIPS.map(fc => (
          <button key={fc.key} onClick={() => toggleFilter(fc.key)}
            style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 12px', borderRadius:'100px', border:`1px solid ${filters.has(fc.key)?fc.color+'55':'rgba(255,255,255,0.07)'}`, background:filters.has(fc.key)?`${fc.color}18`:'transparent', color:filters.has(fc.key)?fc.color:'#4a5160', cursor:'pointer', fontSize:'11px', fontWeight:600, transition:'all 0.15s' }}>
            <span style={{ opacity:filters.has(fc.key)?1:0.4 }}>{fc.icon}</span>
            {fc.label}
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', opacity:0.65 }}>{fc.count}</span>
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:'10px', color:'#4a5160', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.05em' }}>DIVISI:</span>
          {[...Object.entries(DIVISION_COLORS), ['Tanpa divisi', NO_DIVISION_COLOR] as const].map(([name, c]) => (
            <div key={name} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:c.dot, flexShrink:0 }}/>
              <span style={{ fontSize:'10px', color:'#4a5160' }}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN LAYOUT: Calendar + Sidebar ── */}
      <div className="flex flex-col lg:flex-row gap-4" style={{ alignItems:'flex-start' }}>

        {/* Calendar */}
        <div style={{ flex:1, minWidth:0, background:'#10141d', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', overflow:'hidden' }}>
          {view==='month'
            ? <MonthView days={monthDays} anchor={anchor} today={today} selDay={selDay}
                evOn={evOn} onSelDay={d=>{setSelDay(d);setSelEvent(null)}} onSelEvent={setSelEvent} onAdd={d=>openCreate(d)} />
            : <WeekView days={weekDays} today={today} selDay={selDay}
                timedOn={timedOn} allDayOn={allDayOn} nowLine={nowLine}
                onSelDay={d=>{setSelDay(d);setSelEvent(null)}} onSelEvent={setSelEvent} onAdd={openCreate} scrollRef={scrollRef} />
          }
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-3 lg:w-[260px] w-full" style={{ flexShrink:0 }}>

          {/* Selected day */}
          <div style={{ background:'#10141d', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <div>
                <p style={{ fontSize:'10px', color:sd(selDay,today)?'#FF8A4C':'#6B7385', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'2px' }}>
                  {sd(selDay,today)?'HARI INI':'TERPILIH'}
                </p>
                <p className="font-grotesk font-bold text-[15px] text-[#EDF0F5]">{fmtShortDate(selDay)}</p>
                <p style={{ fontSize:'11px', color:'#6B7385', marginTop:'1px' }}>{DAYS_FULL[(selDay.getDay()+6)%7]}</p>
              </div>
              <button onClick={() => openCreate(selDay)}
                style={{ background:'rgba(255,106,26,0.12)', border:'1px solid rgba(255,106,26,0.3)', borderRadius:'9px', padding:'6px 10px', cursor:'pointer', color:'#FF8A4C', fontSize:'11px', fontWeight:700, display:'flex', alignItems:'center', gap:'4px' }}>
                <Plus size={11}/> Tambah
              </button>
            </div>
            {selDayEvs.length===0 ? (
              <p style={{ fontSize:'12px', color:'#4a5160', textAlign:'center', padding:'16px 0' }}>Tidak ada agenda</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {selDayEvs.map(ev => <SidebarEventItem key={ev.key} ev={ev} onClick={() => setSelEvent(ev)} />)}
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div style={{ background:'#10141d', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'16px', maxHeight:'400px', overflowY:'auto' }}>
            <p style={{ fontSize:'10px', color:'#6B7385', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'10px' }}>
              Upcoming · 14 Hari
            </p>
            {upcoming.length===0 ? (
              <p style={{ fontSize:'12px', color:'#4a5160', textAlign:'center', padding:'16px 0' }}>Tidak ada agenda mendatang</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                {upcoming.map((ev, i) => {
                  const prev = upcoming[i-1]
                  const showDate = !prev || !sd(prev.startAt, ev.startAt)
                  return (
                    <div key={ev.key}>
                      {showDate && (
                        <p style={{ fontSize:'10px', color:'#6B7385', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.05em', marginTop: i>0?'10px':'0', marginBottom:'4px' }}>
                          {sd(ev.startAt,today)?'Hari ini':fmtShortDate(ev.startAt)}
                        </p>
                      )}
                      <SidebarEventItem ev={ev} onClick={() => { setSelDay(ev.startAt); setSelEvent(ev) }} compact />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── EVENT DETAIL PANEL ── */}
      {selEvent && (
        <EventDetailPanel
          ev={selEvent}
          currentUser={currentUser}
          onClose={() => setSelEvent(null)}
          onEdit={() => {
            if (selEvent.src==='event') {
              const orig = calEvents.find(e => e.id===selEvent.id)
              if (orig) { setEditCalEv(orig); setShowModal(true); setSelEvent(null) }
            }
          }}
          onDelete={() => handleDelete(selEvent.id)}
        />
      )}

      {/* ── CREATE/EDIT MODAL ── */}
      {showModal && (
        <EventModal
          event={editCalEv}
          defaultDate={defaultDate}
          divisions={divisions}
          projects={projectsForForm}
          currentUser={currentUser}
          onClose={() => { setShowModal(false); setEditCalEv(null); setDefaultDate(null) }}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

/* ═══════════════════ MONTH VIEW ════════════════════════ */
function MonthView({ days, anchor, today, selDay, evOn, onSelDay, onSelEvent, onAdd }: {
  days: Date[]; anchor: Date; today: Date; selDay: Date
  evOn: (d: Date) => DisplayEvent[]
  onSelDay: (d: Date) => void; onSelEvent: (e: DisplayEvent) => void; onAdd: (d: Date) => void
}) {
  return (
    <div>
      {/* Day headers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ padding:'10px 0', textAlign:'center', fontSize:'10px', color:'#4a5160', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.08em', textTransform:'uppercase' }}>{d}</div>
        ))}
      </div>
      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
        {days.map((day, i) => {
          const isCurMonth = day.getMonth()===anchor.getMonth()
          const isToday = sd(day, today)
          const isSel = sd(day, selDay)
          const dayEvs = evOn(day)
          const max = 3
          return (
            <div key={i}
              onClick={() => onSelDay(day)}
              style={{ minHeight:'70px', padding:'6px', cursor:'pointer', transition:'background 0.1s', borderRight: i%7!==6?'1px solid rgba(255,255,255,0.04)':'none', borderBottom:'1px solid rgba(255,255,255,0.04)', background: isSel?'rgba(255,106,26,0.06)': isToday?'rgba(255,106,26,0.03)':'transparent' }}
              onMouseEnter={e => { if(!isToday&&!isSel) e.currentTarget.style.background='rgba(255,255,255,0.025)' }}
              onMouseLeave={e => { e.currentTarget.style.background=isSel?'rgba(255,106,26,0.06)':isToday?'rgba(255,106,26,0.03)':'transparent' }}>
              {/* Date number */}
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'4px' }}>
                <span style={{ width:'26px', height:'26px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight: isToday?700:isSel?600:400, color: isToday?'#0C0F16': isSel?'#FF8A4C': isCurMonth?'#A5AEC0':'#4a5160', background: isToday?'#FF6A1A': isSel?'rgba(255,106,26,0.15)':'transparent' }}>
                  {day.getDate()}
                </span>
              </div>
              {/* Events — icon dots only */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:'3px', marginTop:'2px' }}>
                {dayEvs.slice(0,6).map(ev => (
                  <span key={ev.key}
                    onClick={e => { e.stopPropagation(); onSelEvent(ev) }}
                    title={ev.title}
                    style={{ width:'18px', height:'18px', borderRadius:'5px', background:ev.bg, border:`1px solid ${ev.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:'10px', flexShrink:0 }}>
                    {ev.icon}
                  </span>
                ))}
                {dayEvs.length > 6 && (
                  <span style={{ width:'18px', height:'18px', borderRadius:'5px', background:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'8px', color:'#6B7385', fontFamily:"'IBM Plex Mono',monospace" }}>
                    +{dayEvs.length-6}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════ WEEK VIEW ════════════════════════ */
function WeekView({ days, today, selDay, timedOn, allDayOn, nowLine, onSelDay, onSelEvent, onAdd, scrollRef }: {
  days: Date[]; today: Date; selDay: Date; nowLine: number
  timedOn: (d: Date) => DisplayEvent[]; allDayOn: (d: Date) => DisplayEvent[]
  onSelDay: (d: Date) => void; onSelEvent: (e: DisplayEvent) => void
  onAdd: (d: Date) => void; scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  const isToday = (d: Date) => sd(d, today)

  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      {/* Week header */}
      <div style={{ display:'grid', gridTemplateColumns:'52px repeat(7,1fr)', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)', flexShrink:0 }}>
        <div/>
        {days.map((day, i) => {
          const tod = isToday(day); const sel = sd(day, selDay)
          return (
            <div key={i} onClick={() => onSelDay(day)} style={{ padding:'10px 6px', textAlign:'center', borderLeft:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
              <div style={{ fontSize:'10px', color: tod?'#FF8A4C':'#4a5160', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'4px' }}>
                {DAYS_SHORT[i]}
              </div>
              <div style={{ width:'30px', height:'30px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto', background: tod?'#FF6A1A':sel?'rgba(255,106,26,0.15)':'transparent', fontSize:'16px', fontWeight: tod||sel?700:400, color: tod?'#0C0F16':sel?'#FF8A4C':'#EDF0F5' }}>
                {day.getDate()}
              </div>
              <div style={{ fontSize:'9px', color:'#4a5160', marginTop:'2px' }}>{MONTHS[day.getMonth()].slice(0,3)}</div>
            </div>
          )
        })}
      </div>

      {/* All-day row */}
      {days.some(d => allDayOn(d).length > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'52px repeat(7,1fr)', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.01)', flexShrink:0, minHeight:'28px' }}>
          <div style={{ padding:'4px 6px', fontSize:'9px', color:'#4a5160', fontFamily:"'IBM Plex Mono',monospace", textTransform:'uppercase', letterSpacing:'0.06em', display:'flex', alignItems:'flex-start', paddingTop:'6px' }}>
            All day
          </div>
          {days.map((day, i) => {
            const evs = allDayOn(day)
            return (
              <div key={i} style={{ borderLeft:'1px solid rgba(255,255,255,0.04)', padding:'3px 3px', display:'flex', flexDirection:'column', gap:'2px' }}>
                {evs.slice(0,3).map(ev => (
                  <div key={ev.key} onClick={() => onSelEvent(ev)}
                    style={{ background:ev.bg, borderLeft:`2px solid ${ev.border}`, borderRadius:'3px', padding:'2px 5px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:'3px', overflow:'hidden', minWidth:0 }}>
                    <span style={{ fontSize:'9px', flexShrink:0, marginTop:'1px' }}>{ev.icon}</span>
                    <span style={{ fontSize:'10px', color:ev.text, fontWeight:600, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', wordBreak:'break-word', overflowWrap:'anywhere', lineHeight:1.25, minWidth:0 }}>{ev.title}</span>
                  </div>
                ))}
                {evs.length > 3 && <div style={{ fontSize:'9px', color:'#6B7385', paddingLeft:'4px' }}>+{evs.length-3}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} style={{ overflowY:'auto', maxHeight:'560px', flexShrink:0 }}>
        <div style={{ display:'flex', position:'relative' }}>
          {/* Time labels */}
          <div style={{ width:'52px', flexShrink:0 }}>
            {HOURS.map(h => (
              <div key={h} style={{ height:`${HOUR_H}px`, display:'flex', alignItems:'flex-start', paddingTop:'4px', paddingRight:'8px', justifyContent:'flex-end', fontSize:'10px', color:'#4a5160', fontFamily:"'IBM Plex Mono',monospace", userSelect:'none' }}>
                {String(h).padStart(2,'0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div style={{ flex:1, display:'flex', position:'relative' }}>
            {/* Hour grid lines */}
            {HOURS.map((_, hi) => (
              <div key={hi} style={{ position:'absolute', top:`${hi*HOUR_H}px`, left:0, right:0, borderTop:`1px solid rgba(255,255,255,${hi===0?'0.08':'0.04'})`, zIndex:0, pointerEvents:'none' }} />
            ))}

            {days.map((day, di) => {
              const tod = isToday(day)
              const layouts = layoutTimed(timedOn(day))
              return (
                <div key={di}
                  onClick={() => onSelDay(day)}
                  style={{ flex:1, position:'relative', borderLeft:'1px solid rgba(255,255,255,0.04)', height:`${HOURS.length*HOUR_H}px`, cursor:'pointer', background:tod?'rgba(255,106,26,0.025)':'transparent', minWidth:0 }}>
                  {/* Hover overlay for click to add */}
                  <div style={{ position:'absolute', inset:0, zIndex:1 }}
                    onDoubleClick={e => { e.stopPropagation(); onAdd(day) }}/>

                  {/* Current time line */}
                  {tod && nowLine >= 0 && nowLine <= HOURS.length*HOUR_H && (
                    <div style={{ position:'absolute', top:`${nowLine}px`, left:0, right:0, height:'2px', background:'#FF6A1A', zIndex:5, pointerEvents:'none' }}>
                      <div style={{ position:'absolute', left:'-5px', top:'-4px', width:'10px', height:'10px', borderRadius:'50%', background:'#FF6A1A' }}/>
                    </div>
                  )}

                  {/* Timed events */}
                  {layouts.map(({ ev, col, numCols }) => {
                    const top = eventTop(ev)
                    const height = eventHeight(ev)
                    const colW = 100 / numCols
                    return (
                      <div key={ev.key}
                        onClick={e => { e.stopPropagation(); onSelEvent(ev) }}
                        style={{ position:'absolute', top:`${top}px`, height:`${height}px`, left:`${col*colW+1}%`, width:`${colW-1}%`, background:ev.bg, border:`1px solid ${ev.border}`, borderRadius:'6px', padding:'3px 6px', overflow:'hidden', cursor:'pointer', zIndex:3, minWidth:'30px', boxSizing:'border-box' }}>
                        <div style={{ fontSize:'10px', color:ev.text, fontWeight:700, lineHeight:1.2, overflow:'hidden', display:'-webkit-box', WebkitLineClamp: height > 50 ? 3 : 2, WebkitBoxOrient:'vertical', wordBreak:'break-word', overflowWrap:'anywhere', maxWidth:'100%' }}>
                          {ev.icon} {ev.title}
                        </div>
                        {height > 52 && !ev.allDay && (
                          <div style={{ fontSize:'9px', color:ev.text, opacity:0.7, fontFamily:"'IBM Plex Mono',monospace", marginTop:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {fmtTime(ev.startAt)}–{fmtTime(ev.endAt)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════ SIDEBAR EVENT ITEM ════════════════ */
function SidebarEventItem({ ev, onClick, compact=false }: { ev: DisplayEvent; onClick: () => void; compact?: boolean }) {
  return (
    <div onClick={onClick}
      style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding: compact?'5px 8px':'8px 10px', borderRadius:'9px', cursor:'pointer', background:'rgba(255,255,255,0.03)', border:`1px solid ${ev.border}22`, transition:'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
      onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
      <div style={{ width:'3px', alignSelf:'stretch', borderRadius:'2px', background:ev.border, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <span style={{ fontSize:'10px' }}>{ev.icon}</span>
          <p style={{ fontSize:'12px', fontWeight:600, color:ev.isOverdue?'#EF4444':ev.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</p>
        </div>
        {!compact && (
          <p style={{ fontSize:'10px', color:'#6B7385', marginTop:'2px' }}>
            {ev.allDay ? fmtShortDate(ev.startAt) : `${fmtTime(ev.startAt)} – ${fmtTime(ev.endAt)}`}
            {ev.divisionName && ` · ${ev.divisionName}`}
          </p>
        )}
        {compact && (
          <p style={{ fontSize:'10px', color:'#4a5160', marginTop:'1px' }}>
            {ev.allDay ? '' : `${fmtTime(ev.startAt)} `}
            {ev.divisionName ?? ev.projectName ?? ''}
          </p>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════ EVENT DETAIL PANEL ════════════════ */
function EventDetailPanel({ ev, currentUser, onClose, onEdit, onDelete }: {
  ev: DisplayEvent; currentUser: { id: string; role: string }
  onClose: () => void; onEdit: () => void; onDelete: () => void
}) {
  const isCalEv = ev.src === 'event'
  const canEdit = isCalEv && (ev.createdBy===currentUser.id || currentUser.role==='super_admin')

  const SRC_LABEL: Record<string, string> = {
    event:'Event Kalender', project_start:'Mulai Project', project_deadline:'Deadline Project', task:'Task', approval:'Approval Pending',
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background:'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:'380px', background:'#10141d', borderLeft:'1px solid rgba(255,255,255,0.1)', height:'100%', overflowY:'auto', padding:'24px' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
              <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:ev.dot }}/>
              <span style={{ fontSize:'10px', color:ev.text, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:600 }}>
                {SRC_LABEL[ev.src]}
              </span>
              {ev.isOverdue && <span style={{ fontSize:'9px', background:'rgba(239,68,68,0.2)', color:'#FCA5A5', padding:'1px 6px', borderRadius:'100px', fontWeight:700 }}>OVERDUE</span>}
            </div>
            <h2 className="font-grotesk font-bold text-[17px] text-[#EDF0F5]" style={{ lineHeight:1.3 }}>{ev.title}</h2>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#6B7385', display:'flex', flexShrink:0 }}><X size={15}/></button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {/* Time */}
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'10px', padding:'12px 14px', display:'flex', alignItems:'center', gap:'8px' }}>
            <Clock size={14} style={{ color:'#6B7385', flexShrink:0 }}/>
            <div>
              <p style={{ fontSize:'12px', color:'#EDF0F5', fontWeight:600 }}>
                {ev.allDay
                  ? fmtFullDate(ev.startAt)
                  : `${fmtFullDate(ev.startAt)}`
                }
              </p>
              {!ev.allDay && (
                <p style={{ fontSize:'11px', color:'#6B7385', marginTop:'2px', fontFamily:"'IBM Plex Mono',monospace" }}>
                  {fmtTime(ev.startAt)} – {fmtTime(ev.endAt)}
                </p>
              )}
            </div>
          </div>

          {/* Meta grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
            {ev.divisionName && <MetaBox label="Divisi" val={ev.divisionName}/>}
            {ev.projectName && <MetaBox label="Project" val={ev.projectName}/>}
            {ev.priority && <MetaBox label="Prioritas" val={ev.priority}/>}
            {ev.status && <MetaBox label="Status" val={ev.status}/>}
            {ev.requesterName && <MetaBox label="Diajukan" val={ev.requesterName}/>}
            {ev.eventType && <MetaBox label="Tipe" val={ev.eventType}/>}
          </div>

          {/* Location */}
          {ev.location && (
            <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:'10px' }}>
              <MapPin size={13} style={{ color:'#6B7385', flexShrink:0 }}/>
              <p style={{ fontSize:'13px', color:'#A5AEC0' }}>{ev.location}</p>
            </div>
          )}

          {/* Notes */}
          {ev.notes && (
            <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'10px', padding:'12px 14px' }}>
              <p style={{ fontSize:'10px', color:'#6B7385', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'6px' }}>Catatan</p>
              <p style={{ fontSize:'13px', color:'#A5AEC0', lineHeight:1.6 }}>{ev.notes}</p>
            </div>
          )}

          {/* Links */}
          {ev.extLink && (
            <a href={ev.extLink} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:'7px', background:'rgba(74,158,255,0.08)', border:'1px solid rgba(74,158,255,0.2)', borderRadius:'10px', padding:'11px 14px', color:'#4A9EFF', fontSize:'13px', textDecoration:'none', fontWeight:600 }}>
              <ExternalLink size={14}/> Buka Link
            </a>
          )}
          {ev.intLink && (
            <Link href={ev.intLink}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', padding:'11px 14px', color:'#A5AEC0', fontSize:'13px', textDecoration:'none', fontWeight:600 }}>
              <span style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                {ev.src==='task' ? <CheckSquare size={14}/> : ev.src==='approval' ? <ClipboardCheck size={14}/> : <FolderKanban size={14}/>}
                Lihat {SRC_LABEL[ev.src]}
              </span>
              <ArrowRight size={14}/>
            </Link>
          )}

          {/* Actions */}
          {canEdit && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginTop:'4px' }}>
              <button onClick={onEdit}
                style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', padding:'10px', cursor:'pointer', color:'#A5AEC0', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, fontSize:'13px', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' }}>
                <Pencil size={13}/> Edit
              </button>
              <button onClick={onDelete}
                style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'10px', padding:'10px', cursor:'pointer', color:'#FCA5A5', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, fontSize:'13px', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' }}>
                <Trash2 size={13}/> Hapus
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetaBox({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'9px', padding:'9px 12px' }}>
      <p style={{ fontSize:'10px', color:'#6B7385', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'3px' }}>{label}</p>
      <p style={{ fontSize:'12px', color:'#A5AEC0', fontWeight:500 }}>{val}</p>
    </div>
  )
}

/* ═══════════════════ EVENT MODAL ═══════════════════════ */
function EventModal({ event, defaultDate, divisions, projects, currentUser, onClose, onSaved }: {
  event: CalEventRow|null; defaultDate: string|null
  divisions: { id: string; name: string }[]
  projects: { id: string; name: string }[]
  currentUser: { id: string; role: string; divisionId: string|null }
  onClose: () => void
  onSaved: (e: CalEventRow, isNew: boolean) => void
}) {
  const isNew = !event
  const defStart = defaultDate ? `${defaultDate}T09:00` : ''
  const defEnd   = defaultDate ? `${defaultDate}T10:00` : ''

  const [form, setForm] = useState({
    title:           event?.title ?? '',
    eventType:       event?.eventType ?? 'Meeting',
    divisionId:      event?.divisionId ?? currentUser.divisionId ?? '',
    relatedProjectId:event?.relatedProjectId ?? '',
    startAt:         event ? event.startAt.slice(0,16) : defStart,
    endAt:           event ? event.endAt.slice(0,16)   : defEnd,
    allDay:          event?.allDay ?? false,
    location:        event?.location ?? '',
    link:            event?.link ?? '',
    notes:           event?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string|null>(null)

  const inp: React.CSSProperties = { background:'#141925', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'10px 12px', color:'#EDF0F5', fontSize:'13px', outline:'none', width:'100%', fontFamily:"'Plus Jakarta Sans',sans-serif" }
  const lbl: React.CSSProperties = { fontSize:'10px', color:'#6B7385', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'0.06em', textTransform:'uppercase', display:'block', marginBottom:'5px' }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title) { setError('Judul wajib diisi'); return }
    if (!form.allDay && (!form.startAt || !form.endAt)) { setError('Waktu mulai dan selesai wajib diisi'); return }
    setLoading(true); setError(null)

    const startAt = form.allDay
      ? new Date(form.startAt.slice(0,10)+'T00:00:00').toISOString()
      : new Date(form.startAt).toISOString()
    const endAt = form.allDay
      ? new Date(form.startAt.slice(0,10)+'T23:59:59').toISOString()
      : new Date(form.endAt).toISOString()

    const url = isNew ? '/api/calendar' : `/api/calendar/${event!.id}`
    const res = await fetch(url, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ ...form, startAt, endAt, divisionId:form.divisionId||null, relatedProjectId:form.relatedProjectId||null }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error??'Gagal menyimpan'); setLoading(false); return }

    const saved: CalEventRow = {
      id: data.id ?? event!.id,
      title:form.title, eventType:form.eventType,
      startAt, endAt, allDay:form.allDay,
      location:form.location||null, link:form.link||null, notes:form.notes||null,
      divisionId:form.divisionId||null, relatedProjectId:form.relatedProjectId||null,
      createdBy: event?.createdBy ?? currentUser.id,
      divisionName: divisions.find(d=>d.id===form.divisionId)?.name ?? null,
    }
    onSaved(saved, isNew)
  }

  const TYPE_COLORS: Record<string, string> = { Meeting:'#4A9EFF', Shooting:'#A855F7', Visit:'#10B981', Deadline:'#EF4444', Other:'#FF8A4C' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh]" style={{ background:'#10141d', border:'1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <h2 className="font-grotesk font-bold text-[16px] text-[#EDF0F5]">{isNew?'Tambah Event':'Edit Event'}</h2>
          <button onClick={onClose} style={{ color:'#6B7385', background:'none', border:'none', cursor:'pointer', fontSize:'20px', lineHeight:1 }}>&times;</button>
        </div>

        <form onSubmit={submit} style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'14px', flex:1, overflowY:'auto' }}>
          {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'9px', padding:'10px 14px', fontSize:'13px', color:'#FCA5A5' }}>{error}</div>}

          <div>
            <label style={lbl}>Judul Event *</label>
            <input style={inp} value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Nama event..." required />
          </div>

          {/* Event type chips */}
          <div>
            <label style={lbl}>Tipe Event</label>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {EVENT_TYPES.map(t => (
                <button type="button" key={t} onClick={() => setForm(f=>({...f,eventType:t}))}
                  style={{ padding:'5px 12px', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', border:`1px solid ${form.eventType===t?TYPE_COLORS[t]+'66':'rgba(255,255,255,0.08)'}`, background:form.eventType===t?`${TYPE_COLORS[t]}22`:'transparent', color:form.eventType===t?TYPE_COLORS[t]:'#6B7385' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div>
              <label style={lbl}>Divisi</label>
              <select style={inp} value={form.divisionId} onChange={e => setForm(f=>({...f,divisionId:e.target.value}))}>
                <option value="">— Semua —</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Project terkait</label>
              <select style={inp} value={form.relatedProjectId} onChange={e => setForm(f=>({...f,relatedProjectId:e.target.value}))}>
                <option value="">— Tidak ada —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ ...lbl, display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' }}>
              <input type="checkbox" checked={form.allDay} onChange={e => setForm(f=>({...f,allDay:e.target.checked}))} style={{ width:'14px', height:'14px' }}/>
              Sepanjang hari (All day)
            </label>
          </div>

          {form.allDay ? (
            <div>
              <label style={lbl}>Tanggal *</label>
              <input style={inp} type="date" value={form.startAt.slice(0,10)} onChange={e => setForm(f=>({...f,startAt:e.target.value,endAt:e.target.value}))} required />
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={lbl}>Mulai *</label>
                <input style={inp} type="datetime-local" value={form.startAt} onChange={e => setForm(f=>({...f,startAt:e.target.value}))} required />
              </div>
              <div>
                <label style={lbl}>Selesai *</label>
                <input style={inp} type="datetime-local" value={form.endAt} onChange={e => setForm(f=>({...f,endAt:e.target.value}))} required />
              </div>
            </div>
          )}

          <div>
            <label style={lbl}>Lokasi</label>
            <input style={inp} value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} placeholder="Ruangan, alamat, atau platform online..." />
          </div>

          <div>
            <label style={lbl}>Link (Meet, Zoom, Docs…)</label>
            <input style={inp} type="url" value={form.link} onChange={e => setForm(f=>({...f,link:e.target.value}))} placeholder="https://..." />
          </div>

          <div>
            <label style={lbl}>Catatan / Agenda</label>
            <textarea style={{ ...inp, minHeight:'72px', resize:'vertical' }} value={form.notes}
              onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Agenda rapat, deskripsi, atau catatan tambahan..." />
          </div>

          <div style={{ display:'flex', gap:'10px', paddingTop:'4px' }}>
            <button type="button" onClick={onClose} style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#A5AEC0', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, fontSize:'14px' }}>Batal</button>
            <button type="submit" disabled={loading} style={{ flex:2, background:loading?'rgba(255,106,26,0.5)':'#FF6A1A', border:'none', color:'#0C0F16', borderRadius:'10px', padding:'11px', cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'14px' }}>
              {loading?'Menyimpan...':isNew?'Buat Event':'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ═══════════════════ BUTTON STYLES ═════════════════════ */
const navBtn: React.CSSProperties = {
  background:'transparent', border:'none', borderRadius:'7px', padding:'6px 8px',
  cursor:'pointer', color:'#A5AEC0', display:'flex', alignItems:'center',
}
