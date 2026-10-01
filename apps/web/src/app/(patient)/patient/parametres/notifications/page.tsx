'use client'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Mail, CheckCircle2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className="shrink-0 transition-colors"
      aria-pressed={enabled}
    >
      {enabled
        ? <ToggleRight className="w-8 h-8 text-[var(--sw-primary)]" />
        : <ToggleLeft className="w-8 h-8 text-[var(--sw-ink-3)]" />
      }
    </button>
  )
}

export default function PatientNotificationPrefsPage() {
  const [inApp, setInApp] = useState(true)
  const [email, setEmail] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Load current prefs on first render
  if (!loaded) {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('preferences_notifications')
        .select('in_app_enabled, email_enabled')
        .eq('profile_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const row = data as unknown as { in_app_enabled: boolean; email_enabled: boolean }
            setInApp(row.in_app_enabled ?? true)
            setEmail(row.email_enabled ?? true)
          }
          setLoaded(true)
        })
    })
  }

  function handleSave() {
    setError(''); setSaved(false)
    startTransition(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Non authentifié'); return }

      const { error: err } = await (supabase.from('preferences_notifications') as unknown as {
        upsert: (v: unknown, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>
      }).upsert({ profile_id: user.id, in_app_enabled: inApp, email_enabled: email }, { onConflict: 'profile_id' })

      if (err) { setError(err.message); return }
      setSaved(true)
    })
  }

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Préférences de notifications</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Choisissez comment vous souhaitez être informé</p>
      </div>

      <div className="sw-card divide-y divide-[var(--sw-line)]">
        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-[var(--sw-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--sw-ink)]">Notifications dans l'application</p>
            <p className="text-xs text-[var(--sw-ink-2)]">Alertes visibles dans votre espace patient</p>
          </div>
          <Toggle enabled={inApp} onChange={setInApp} />
        </div>

        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--sw-ink)]">Notifications par e-mail</p>
            <p className="text-xs text-[var(--sw-ink-2)]">Confirmations, rappels et mises à jour envoyés par e-mail</p>
          </div>
          <Toggle enabled={email} onChange={setEmail} />
        </div>
      </div>

      {error && <p className="text-sm text-[var(--sw-danger)]">{error}</p>}

      {saved && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--sw-success-bg)]">
          <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />
          <p className="text-sm text-[var(--sw-success)] font-medium">Préférences enregistrées.</p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="w-full py-3 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer les préférences'}
      </button>
    </div>
  )
}
