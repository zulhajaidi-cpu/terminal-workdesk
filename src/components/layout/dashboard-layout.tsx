'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: React.ReactNode
  user?: { full_name: string; role: string; avatar_url?: string | null }
  title?: string
}

export function DashboardLayout({ children, user, title }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0C0F16' }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar role={user?.role} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative h-full animate-slide-in">
            <Sidebar onClose={() => setSidebarOpen(false)} role={user?.role} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
          title={title}
        />
        <main className={cn('flex-1 overflow-y-auto p-4 sm:p-6')}>
          {children}
        </main>
      </div>
    </div>
  )
}
