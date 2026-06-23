'use client'

import { useRef, useState, useCallback } from 'react'

interface Props {
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
  background?: string
  border?: string
}

export function ModalSheet({
  onClose,
  children,
  maxWidth = 'max-w-lg',
  background = 'var(--bg-elevated)',
  border = '1px solid var(--border-strong)',
}: Props) {
  const [translateY, setTranslateY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startY = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    setIsDragging(true)
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0) setTranslateY(dy)
  }, [])

  const onTouchEnd = useCallback(() => {
    setIsDragging(false)
    if (translateY > 80) {
      onClose()
    } else {
      setTranslateY(0)
    }
  }, [translateY, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.75)' }}
        onClick={onClose}
      />

      {/* Sheet: bottom on mobile, centered on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-50 lg:inset-0 lg:flex lg:items-center lg:justify-center lg:p-4">
        <div
          className={`w-full ${maxWidth} flex flex-col max-h-[92vh] lg:max-h-[90vh] rounded-t-2xl lg:rounded-2xl`}
          style={{
            background,
            border,
            transform: `translateY(${translateY}px)`,
            transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.32,0.72,0,1)',
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Drag handle — mobile only */}
          <div className="lg:hidden pt-3 pb-1 flex justify-center flex-shrink-0" style={{ cursor: 'grab' }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--border-strong)' }} />
          </div>
          {children}
        </div>
      </div>
    </>
  )
}
