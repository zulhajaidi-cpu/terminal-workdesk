import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'orange' | 'green' | 'red' | 'blue' | 'yellow' | 'ghost'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-white/8 text-[var(--text-secondary)] border border-white/10',
  orange: 'bg-[rgba(255,106,26,0.12)] text-[var(--peach)] border border-[rgba(255,106,26,0.3)]',
  green: 'bg-[rgba(63,208,138,0.12)] text-[var(--green)] border border-[rgba(63,208,138,0.25)]',
  red: 'bg-[rgba(255,107,107,0.12)] text-[var(--red)] border border-[rgba(255,107,107,0.25)]',
  blue: 'bg-[rgba(86,169,232,0.12)] text-[var(--blue)] border border-[rgba(86,169,232,0.25)]',
  yellow: 'bg-[rgba(255,180,137,0.12)] text-[var(--peach)] border border-[rgba(255,180,137,0.25)]',
  ghost: 'text-[var(--text-muted)] border border-white/8',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-mono tracking-wide whitespace-nowrap',
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, BadgeVariant> = {
    Urgent: 'red', High: 'orange', Medium: 'blue', Low: 'ghost',
  }
  return <Badge variant={map[priority] ?? 'default'}>{priority}</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    'Completed': 'green',
    'In Progress': 'orange',
    'Need Review': 'blue',
    'To Do': 'ghost',
    'Overdue': 'red',
    'Deadline Alert': 'red',
    'On Hold': 'yellow',
    'Cancelled': 'ghost',
    'Draft': 'ghost',
    'Waiting Approval': 'yellow',
    'Not Started': 'ghost',
    'Revision': 'yellow',
  }
  return <Badge variant={map[status] ?? 'default'}>{status}</Badge>
}
