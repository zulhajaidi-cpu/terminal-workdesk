'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FolderKanban, Target, Calendar,
  CalendarRange, CheckSquare, Trophy, ClipboardCheck, Bell,
  FolderOpen, Wallet, Settings, X, ChevronRight, Gamepad2
} from 'lucide-react'
import { canViewBudget } from '@/lib/roles'

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
      style={{ background: '#0E1219', borderRight: '1px solid rgba(255,255,255,0.06)', width: '240px', minWidth: '240px' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#FF8A4C,#E2540A)' }}>
            <span className="font-grotesk font-bold text-[13px] text-[#0C0F16]">TW</span>
          </div>
          <div>
            <div className="font-grotesk font-semibold text-[13px] text-[#EDF0F5] leading-tight">Terminal</div>
            <div className="font-mono text-[9.5px] text-[#6B7385] tracking-widest uppercase leading-tight">Workdesk</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-[#6B7385] hover:text-[#EDF0F5] transition-colors lg:hidden">
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
                  : 'text-[#6B7385] hover:text-[#A5AEC0] hover:bg-[rgba(255,255,255,0.04)]'
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
      <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="font-mono text-[9.5px] text-[#4a5160] tracking-wider uppercase">
          Dept Terminal GODA · v2.1
        </div>
      </div>
    </aside>
  )
}
