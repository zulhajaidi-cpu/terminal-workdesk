'use client'

// Util tema client-side. Default Dark (tanpa data-theme). Light = data-theme="light" di <html>.
// Persist di localStorage. Anti-FOUC ditangani inline-script di root layout (src/app/layout.tsx).

export type Theme = 'light' | 'dark'
const KEY = 'tw-theme'

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function setTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  if (theme === 'light') document.documentElement.dataset.theme = 'light'
  else delete document.documentElement.dataset.theme
  try { localStorage.setItem(KEY, theme) } catch {}
  // Beritahu komponen lain (mis. ikon toggle) agar ikut update.
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }))
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}
