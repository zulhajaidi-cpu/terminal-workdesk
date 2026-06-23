'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, Search, Menu, LogOut } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'

interface TopbarProps {
  user?: { full_name: string; role: string; avatar_url?: string | null }
  onMenuClick?: () => void
  title?: string
  unreadCount?: number
}

export function Topbar({ user, onMenuClick, title, unreadCount = 0 }: TopbarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const router = useRouter()
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const roleLabels: Record<string, string> = {
    spectator:     'Spectator',
    staff:         'Staff',
    leader_divisi: 'SPV',
    spv_manager:   'Manager',
    head_director: 'Direktur',
    super_admin:   'Super Admin',
  }

  return (
    <header
      className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-6 h-14"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0C0F16' }}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-[#6B7385] hover:text-[#EDF0F5] transition-colors mr-1"
      >
        <Menu size={20} />
      </button>

      {/* Page title (mobile) */}
      {title && (
        <span className="lg:hidden font-grotesk font-semibold text-[15px] text-[#EDF0F5] flex-1">{title}</span>
      )}

      {/* Search (desktop) */}
      <div className="hidden lg:flex flex-1 max-w-sm">
        <div className="flex items-center gap-2 w-full px-3 py-2 rounded-xl"
          style={{ background: '#141925', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Search size={14} className="text-[#6B7385] flex-shrink-0" />
          <input
            placeholder="Cari project, task, user..."
            className="bg-transparent border-none outline-none text-[13px] text-[#EDF0F5] placeholder:text-[#6B7385] flex-1"
          />
          <kbd className="font-mono text-[10px] text-[#6B7385] bg-white/5 px-1.5 py-0.5 rounded">⌘K</kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <Link href="/notifications" aria-label={`Notifikasi${unreadCount > 0 ? ` (${unreadCount} belum dibaca)` : ''}`}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[#6B7385] hover:text-[#EDF0F5] hover:bg-white/5 transition-all"
          style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center font-grotesk font-bold text-[10px] text-white"
              style={{ background: '#FF6A1A', boxShadow: '0 0 0 2px #0C0F16' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* User menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-white/5 transition-all"
            >
              <Avatar name={user.full_name} size="sm" imageUrl={user.avatar_url} />
              <div className="hidden sm:flex flex-col items-start">
                <span className="font-grotesk font-semibold text-[12px] text-[#EDF0F5] leading-tight">{user.full_name}</span>
                <span className="font-mono text-[10px] text-[#6B7385] leading-tight">
                  {roleLabels[user.role] ?? user.role}
                </span>
              </div>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl overflow-hidden"
                  style={{ background: '#10141d', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.6)' }}>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-[13px] text-[#FF6B6B] hover:bg-[rgba(255,107,107,0.08)] transition-colors"
                  >
                    <LogOut size={14} />
                    Keluar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
