// Codemod sekali-pakai: ganti warna hardcoded (hex + putih-alpha) → var(--token) tema.
// Aman untuk inline style ('#xxx' → 'var(--x)') maupun Tailwind arbitrary (text-[#xxx] → text-[var(--x)]),
// karena var(--x) tak mengandung spasi. Aksen (orange/ungu/pink/amber dll) sengaja TIDAK diubah.
// Idempotent: setelah jadi var(...), pola hex/rgba lama tak ditemukan lagi.
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// Daftar file .tsx (pakai git ls-files biar tak kena node_modules/.next).
const files = execSync('git ls-files "src/**/*.tsx"', { encoding: 'utf8' })
  .split('\n').map(s => s.trim()).filter(Boolean)
  // layout.tsx punya themeColor meta (butuh hex asli) → dikecualikan.
  .filter(f => f !== 'src/app/layout.tsx')

// Mapping hex (case-insensitive) → token. Hanya NETRAL + accent-text yg perlu varian light.
const HEX = new Map(Object.entries({
  // surfaces
  '#0C0F16': 'var(--bg-base)',
  '#0E1219': 'var(--bg-sidebar)',
  '#141925': 'var(--bg-card)',
  '#161A23': 'var(--bg-card)',
  '#10141D': 'var(--bg-elevated)',
  '#1A2030': 'var(--bg-hover)',
  // text
  '#EDF0F5': 'var(--text-primary)',
  '#F4F6FA': 'var(--text-primary)',
  '#A5AEC0': 'var(--text-secondary)',
  '#6B7385': 'var(--text-muted)',
  '#4A5160': 'var(--text-faint)',
  '#94A3B8': 'var(--text-faint)',
  // accent text dgn varian kontras di light
  '#F5C451': 'var(--gold)',
  '#FFB489': 'var(--peach)',
  '#3FD08A': 'var(--green)',
  '#FF6B6B': 'var(--red)',
  '#4A9EFF': 'var(--blue)',
  '#56A9E8': 'var(--blue)',
}).map(([k, v]) => [k.toUpperCase(), v]))

// Putih-alpha → token border/surface berdasar tingkat alpha.
function whiteAlphaToken(a) {
  if (a <= 0.035) return 'var(--surface-subtle)'
  if (a <= 0.055) return 'var(--surface-hover)'
  if (a <= 0.09)  return 'var(--border)'
  return 'var(--border-strong)'
}

let totalHex = 0, totalRgba = 0
const perFile = []

for (const file of files) {
  let src = readFileSync(file, 'utf8')
  const before = src
  let nHex = 0, nRgba = 0

  // 1) hex 6-digit (case-insensitive), word-boundary di akhir supaya tak makan #RRGGBBAA.
  src = src.replace(/#[0-9A-Fa-f]{6}\b/g, (m) => {
    const tok = HEX.get(m.toUpperCase())
    if (tok) { nHex++; return tok }
    return m
  })

  // 2) rgba(255,255,255,a) dgn/ tanpa spasi → token.
  src = src.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)/gi, (m, a) => {
    nRgba++
    return whiteAlphaToken(parseFloat(a))
  })

  if (src !== before) {
    writeFileSync(file, src)
    totalHex += nHex; totalRgba += nRgba
    perFile.push({ file, nHex, nRgba })
  }
}

perFile.sort((a, b) => (b.nHex + b.nRgba) - (a.nHex + a.nRgba))
for (const p of perFile) console.log(`  ${p.file}  (hex ${p.nHex}, rgba ${p.nRgba})`)
console.log(`\n✅ ${perFile.length} file diubah · ${totalHex} hex netral · ${totalRgba} putih-alpha`)
