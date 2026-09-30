'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export function InviteActions({ attachmentId }: { attachmentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accept' | 'refuse' | null>(null)
  const [done,    setDone]    = useState(false)
  const [result,  setResult]  = useState<'accepted' | 'refused' | null>(null)

  async function handle(action: 'accept' | 'refuse') {
    setLoading(action)
    const supabase = createClient()
    const newStatus = action === 'accept' ? 'accepted' : 'refused'
    await (supabase.from('establishment_professionals') as unknown as {
      update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: unknown }> }
    }).update({ status: newStatus }).eq('id', attachmentId)
    setLoading(null)
    setDone(true)
    setResult(newStatus)
    router.refresh()
  }

  if (done) {
    return (
      <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
        result === 'accepted'
          ? 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]'
          : 'text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)]'
      }`}>
        {result === 'accepted' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
        {result === 'accepted' ? 'Accepté' : 'Refusé'}
      </span>
    )
  }

  return (
    <div className="flex gap-1.5 shrink-0">
      <button
        onClick={() => handle('refuse')}
        disabled={!!loading}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--sw-line)] text-xs font-medium text-[var(--sw-ink-2)] hover:border-[var(--sw-danger)] hover:text-[var(--sw-danger)] disabled:opacity-50 transition-colors"
      >
        {loading === 'refuse'
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <XCircle className="w-3 h-3" />
        }
        Refuser
      </button>
      <button
        onClick={() => handle('accept')}
        disabled={!!loading}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--sw-primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading === 'accept'
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <CheckCircle2 className="w-3 h-3" />
        }
        Accepter
      </button>
    </div>
  )
}
