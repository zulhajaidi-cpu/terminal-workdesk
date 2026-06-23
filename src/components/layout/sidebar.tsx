'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FolderKanban, Target, Calendar,
  CalendarRange, CheckSquare, Trophy, ClipboardCheck, Bell,
  FolderOpen, Wallet, Settings, X, ChevronRight, Gamepad2
} from 'lucide-react'
import { canViewBudget, isSpectator } from '@/lib/roles'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/projects', icon: FolderKanban, label: 'Projects' },
  { href: '/kpi', icon: Target, label: 'KPI Individu' },
  { href: '/calendar', icon: Calendar, label: 'Kalender' },
  { href: '/events', icon: CalendarRange, label: 'Events / Agenda' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { href: '/arena', icon: Gamepad2, label: 'GODA Arena' },
  { href: '/approvals', icon: ClipboardCheck, label: 'Approvals' },
  { href: '/notifications', icon: Bell, label: 'Notifikasi' },
  { href: '/assets', icon: FolderOpen, label: 'Assets' },
  { href: '/budget', icon: Wallet, label: 'Budget', requiresBudgetAccess: true },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

interface SidebarProps {
  onClose?: () => void
  role?: string
}

export function Sidebar({ onClose, role }: SidebarProps) {
  const pathname = usePathname()
  const items = navItems.filter(item => !item.requiresBudgetAccess || canViewBudget(role ?? ''))

  return (
    <aside
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)', width: '240px', minWidth: '240px' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#FF8A4C,#E2540A)' }}>
            <span className="font-grotesk font-bold text-[13px] text-[var(--on-accent)]">TW</span>
          </div>
          <div>
            <div className="font-grotesk font-semibold text-[13px] text-[var(--text-primary)] leading-tight">Terminal</div>
            <div className="font-mono text-[9.5px] text-[var(--text-muted)] tracking-widest uppercase leading-tight">Workdesk</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-0.5 hide-scroll">
        {items.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group',
                isActive
                  ? 'bg-[rgba(255,106,26,0.12)] text-[#FF8A4C]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              )}
            >
              <Icon size={17} className="flex-shrink-0" strokeWidth={isActive ? 2 : 1.7} />
              <span className={cn('text-[13px]', isActive ? 'font-semibold' : 'font-medium')}>{label}</span>
              {isActive && <ChevronRight size={13} className="ml-auto opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom accent */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
        {isSpectator(role ?? '') && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 700, color: '#8B93A6', background: 'rgba(139,147,166,0.12)', border: '1px solid rgba(139,147,166,0.3)', borderRadius: '100px', padding: '3px 10px', marginBottom: '8px' }}>
            👁️ Mode Spectator · Lihat Saja
          </div>
        )}
        <div className="font-mono text-[9.5px] text-[var(--text-faint)] tracking-wider uppercase">
          Dept Terminal GODA · v2.1
        </div>
      </div>
    </aside>
  )
}
