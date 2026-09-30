'use client'
import { useEffect, useRef, type ReactNode } from 'react'

interface AnimateInProps {
  children: ReactNode
  className?: string
  delay?: number
  from?: 'bottom' | 'left' | 'right' | 'fade'
}

export function AnimateIn({ children, className = '', delay = 0, from = 'bottom' }: AnimateInProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.classList.add('sw-animate-in')
          }, delay)
          observer.unobserve(el)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])

  const baseClass = from === 'bottom' ? 'sw-animate-from-bottom'
    : from === 'left' ? 'sw-animate-from-left'
    : from === 'right' ? 'sw-animate-from-right'
    : 'sw-animate-from-fade'

  return (
    <div ref={ref} className={`${baseClass} ${className}`}>
      {children}
    </div>
  )
}
