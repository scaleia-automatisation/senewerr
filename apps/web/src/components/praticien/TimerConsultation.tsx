import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Timer, Square } from 'lucide-react'

interface TimerConsultationProps {
  running?: boolean
  onStop?: (durationSeconds: number) => void
  className?: string
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function TimerConsultation({ running = true, onStop, className }: TimerConsultationProps) {
  const [seconds, setSeconds] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      if (ref.current) clearInterval(ref.current)
    }
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  function stop() {
    if (ref.current) clearInterval(ref.current)
    onStop?.(seconds)
  }

  return (
    <div className={cn('flex items-center gap-s-3', className)}>
      <div className="flex items-center gap-s-2 rounded-pill bg-primary/10 px-s-3 py-s-1.5">
        <Timer className="h-4 w-4 text-primary" />
        <span className="font-mono text-small font-semibold tabular-nums text-primary">
          {h > 0 && `${pad(h)}:`}{pad(m)}:{pad(s)}
        </span>
      </div>
      {onStop && (
        <button
          onClick={stop}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600 transition-colors hover:bg-red-200"
          title="Terminer la consultation"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
