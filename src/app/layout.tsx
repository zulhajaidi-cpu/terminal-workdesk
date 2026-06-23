import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Terminal Workdesk — Department GODA',
  description: 'Sistem kerja terpusat Department Terminal GODA',
  icons: { icon: '/favicon.ico' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0C0F16',
}

// Set data-theme dari localStorage SEBELUM paint → tak ada kedipan dark→light saat reload.
const themeInit = `(function(){try{if(localStorage.getItem('tw-theme')==='light'){document.documentElement.dataset.theme='light'}}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
