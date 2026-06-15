import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  imageUrl?: string | null
  className?: string
}

const sizeMap = {
  xs: { box: 'w-5 h-5', text: 'text-[9px]' },
  sm: { box: 'w-7 h-7', text: 'text-[11px]' },
  md: { box: 'w-9 h-9', text: 'text-sm' },
  lg: { box: 'w-12 h-12', text: 'text-lg' },
  xl: { box: 'w-16 h-16', text: 'text-2xl' },
}

export function Avatar({ name, size = 'md', imageUrl, className }: AvatarProps) {
  const { box, text } = sizeMap[size]
  const initials = getInitials(name)

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn('rounded-full object-cover flex-shrink-0', box, className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center flex-shrink-0 font-grotesk font-bold',
        box, text, className
      )}
      style={{ background: 'linear-gradient(135deg,#FF8A4C,#E2540A)', color: '#0C0F16' }}
    >
      {initials}
    </div>
  )
}
