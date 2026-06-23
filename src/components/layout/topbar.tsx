'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, Search, Menu, LogOut, Sun, Moon } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { getTheme, toggleTheme, type Theme } from '@/lib/theme'

interface TopbarProps {
  user?: { full_name: string; role: string; avatar_url?: string | null }
  onMenuClick?: () => void
  title?: string
  unreadCount?: number
}

export function Topbar({ user, onMenuClick, title, unreadCount = 0 }: TopbarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [theme, setThemeState] = useState<Theme>('dark')
  const router = useRouter()

  // Sinkronkan ikon dgn tema aktif (set oleh anti-FOUC script) + saat tema berubah di tab lain.
  useEffect(() => {
    setThemeState(getTheme())
    const sync = () => setThemeState(getTheme())
    window.addEventListener('themechange', sync)
    return () => window.removeEventListener('themechange', sync)
  }, [])

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
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-base)' }}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mr-1"
      >
        <Menu size={20} />
      </button>

      {/* Page title (mobile) */}
      {title && (
        <span className="lg:hidden font-grotesk font-semibold text-[15px] text-[var(--text-primary)] flex-1">{title}</span>
      )}

      {/* Search (desktop) */}
      <div className="hidden lg:flex flex-1 max-w-sm">
        <div className="flex items-center gap-2 w-full px-3 py-2 rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <Search size={14} className="text-[var(--text-muted)] flex-shrink-0" />
          <input
            placeholder="Cari project, task, user..."
            className="bg-transparent border-none outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] flex-1"
          />
          <kbd className="font-mono text-[10px] text-[var(--text-muted)] bg-white/5 px-1.5 py-0.5 rounded">⌘K</kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Theme toggle */}
        <button onClick={() => setThemeState(toggleTheme())}
          aria-label={theme === 'light' ? 'Ganti ke tema gelap' : 'Ganti ke tema terang'}
          title={theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all"
          style={{ border: '1px solid var(--border)' }}>
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Notifications */}
        <Link href="/notifications" aria-label={`Notifikasi${unreadCount > 0 ? ` (${unreadCount} belum dibaca)` : ''}`}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all"
          style={{ border: '1px solid var(--border)' }}>
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center font-grotesk font-bold text-[10px] text-white"
              style={{ background: '#FF6A1A', boxShadow: '0 0 0 2px var(--bg-base)' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* User menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-[var(--surface-hover)] transition-all"
            >
              <Avatar name={user.full_name} size="sm" imageUrl={user.avatar_url} />
              <div className="hidden sm:flex flex-col items-start">
                <span className="font-grotesk font-semibold text-[12px] text-[var(--text-primary)] leading-tight">{user.full_name}</span>
                <span className="font-mono text-[10px] text-[var(--text-muted)] leading-tight">
                  {roleLabels[user.role] ?? user.role}
                </span>
              </div>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl overflow-hidden"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.6)' }}>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-[13px] text-[var(--red)] hover:bg-[rgba(255,107,107,0.08)] transition-colors"
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
