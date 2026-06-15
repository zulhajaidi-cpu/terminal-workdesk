import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

export function Card({ children, className, style, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border',
        'bg-[#141925] border-[rgba(255,255,255,0.06)]',
        onClick && 'cursor-pointer hover:border-[rgba(255,255,255,0.12)] transition-colors',
        className
      )}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('p-4 border-b border-[rgba(255,255,255,0.06)]', className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-4', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('font-grotesk font-semibold text-[15px] text-[#EDF0F5]', className)}>
      {children}
    </h3>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  valueColor?: string
}

export function StatCard({ label, value, sub, valueColor = '#fff' }: StatCardProps) {
  return (
    <Card>
      <div className="p-3 sm:p-4">
        <div className="font-mono text-[10px] tracking-widest text-[#6B7385] uppercase mb-1">{label}</div>
        <div className="font-grotesk font-bold text-2xl" style={{ color: valueColor }}>{value}</div>
        {sub && <div className="text-[11px] mt-1" style={{ color: valueColor === '#fff' ? '#6B7385' : valueColor }}>{sub}</div>}
      </div>
    </Card>
  )
}
