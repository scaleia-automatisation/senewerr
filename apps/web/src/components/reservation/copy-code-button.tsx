'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={copy}
      className="p-2 rounded-xl text-[var(--sw-ink-3)] hover:text-[var(--sw-primary)] hover:bg-[var(--sw-primary-subtle)] transition-colors"
      title="Copier le code"
    >
      {copied ? <Check className="w-5 h-5 text-[var(--sw-success)]" /> : <Copy className="w-5 h-5" />}
    </button>
  )
}
