// Matematika level/tier MURNI (tanpa DB) — aman diimpor di komponen client maupun server.
// Threshold total EXP utk MENCAPAI level L = 50·(L-1)·L → L1:0, L2:100, L3:300, L4:600, L5:1000.

export function levelFromExp(total: number): number {
  if (total <= 0) return 1
  return Math.max(1, Math.floor((50 + Math.sqrt(2500 + 200 * total)) / 100))
}
export function levelFloor(level: number): number { return 50 * (level - 1) * level }
export function nextLevelExp(level: number): number { return 50 * level * (level + 1) }

const TIERS: { min: number; title: string }[] = [
  { min: 15, title: 'Legend' },
  { min: 10, title: 'Elite' },
  { min: 7,  title: 'Veteran' },
  { min: 5,  title: 'Hustler' },
  { min: 3,  title: 'Grinder' },
  { min: 1,  title: 'Rookie' },
]
export function tierTitle(level: number): string {
  return TIERS.find(t => level >= t.min)?.title ?? 'Rookie'
}

export interface LevelInfo {
  level: number; floor: number; next: number
  pct: number; title: string; intoLevel: number; span: number
}
export function levelProgress(total: number): LevelInfo {
  const level = levelFromExp(total)
  const floor = levelFloor(level)
  const next = nextLevelExp(level)
  const span = next - floor
  const intoLevel = total - floor
  const pct = span > 0 ? Math.min(100, Math.round((intoLevel / span) * 100)) : 0
  return { level, floor, next, pct, title: tierTitle(level), intoLevel, span }
}
