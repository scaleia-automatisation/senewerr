import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface OTPInputProps {
  /** Nombre de cases : 6 (2FA), 4 (code retrait) */
  length?: 4 | 6
  value?: string
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
  error?: boolean
  autoFocus?: boolean
  className?: string
}

export function OTPInput({ length = 6, value = '', onChange, onComplete, error, autoFocus, className }: OTPInputProps) {
  const [internal, setInternal] = useState(value)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = internal.padEnd(length, ' ').slice(0, length).split('')

  function update(next: string) {
    setInternal(next)
    onChange?.(next)
    if (next.length === length) onComplete?.(next)
  }

  function handleChange(i: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const arr = internal.padEnd(length, ' ').split('')
    arr[i] = digit || ' '
    const next = arr.join('').replace(/\s+$/g, '')
    update(next)
    if (digit && i < length - 1) refs.current[i + 1]?.focus()
  }

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i].trim() && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (pasted) {
      update(pasted)
      refs.current[Math.min(pasted.length, length - 1)]?.focus()
    }
  }

  return (
    <div className={cn('flex gap-s-2', error && 'animate-shake allow-motion', className)}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          autoFocus={autoFocus && i === 0}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          aria-label={`Chiffre ${i + 1}`}
          className={cn(
            'h-14 w-12 rounded-md border bg-surface text-center font-display text-h2 font-semibold text-ink tabular-nums',
            'focus:outline-none focus:border-primary focus:shadow-focus',
            error ? 'border-status-danger' : 'border-line',
          )}
        />
      ))}
    </div>
  )
}
