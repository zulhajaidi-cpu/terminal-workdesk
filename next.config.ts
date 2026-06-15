import type { NextConfig } from "next";

const securityHeaders = [
  // Paksa HTTPS selama 1 tahun (aktif hanya di production karena Vercel handle HTTPS)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Cegah clickjacking — halaman tidak boleh dimuat dalam iframe pihak lain
  { key: 'X-Frame-Options', value: 'DENY' },
  // Cegah browser menebak MIME type dari konten
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Batasi info referrer saat navigasi ke domain lain
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Matikan akses ke kamera/mikrofon/geolokasi yang tidak dipakai
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig;
