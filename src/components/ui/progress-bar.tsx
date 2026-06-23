import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  height?: number
  showLabel?: boolean
  className?: string
  animated?: boolean
}

export function ProgressBar({
  value,
  max = 100,
  color = '#FF6A1A',
  height = 6,
  showLabel = false,
  className,
  animated = true,
}: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height, background: 'var(--border)' }}>
        <div
          className={animated ? 'animate-grow-bar' : ''}
          style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }}
        />
      </div>
      {showLabel && (
        <span className="font-mono text-[11px] text-[var(--text-primary)] w-9 text-right flex-shrink-0">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  )
}

export function getProgressColor(pct: number): string {
  if (pct >= 80) return 'var(--green)'
  if (pct >= 50) return '#FF8A4C'
  return 'var(--red)'
}
