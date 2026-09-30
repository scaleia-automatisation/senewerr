'use client'
import { useState, useTransition } from 'react'
import { Bell, Mail, BellOff, CheckCircle2, Loader2 } from 'lucide-react'

export type PrefCategory = {
  key: string
  label: string
  description: string
  mandatory?: boolean // spec 19.3 — certains rappels ne peuvent être désactivés
}

export type PrefRow = {
  event_category: string
  in_app: boolean
  email: boolean
}

type Props = {
  categories: PrefCategory[]
  prefs: PrefRow[]
  hasEmail: boolean
  onSave: (prefs: PrefRow[]) => Promise<{ ok: boolean; error?: string }>
}

export function NotificationPreferences({ categories, prefs: initialPrefs, hasEmail, onSave }: Props) {
  const [prefs, setPrefs] = useState<PrefRow[]>(
    categories.map(cat => {
      const existing = initialPrefs.find(p => p.event_category === cat.key)
      return existing ?? { event_category: cat.key, in_app: true, email: hasEmail }
    })
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function toggle(category: string, channel: 'in_app' | 'email') {
    const cat = categories.find(c => c.key === category)
    if (cat?.mandatory && channel === 'in_app') return // can't disable mandatory in-app
    setPrefs(p => p.map(r => r.event_category === category ? { ...r, [channel]: !r[channel] } : r))
    setSaved(false)
  }

  function handleSave() {
    setError('')
    startTransition(async () => {
      const result = await onSave(prefs)
      if (result.ok) setSaved(true)
      else setError(result.error ?? 'Erreur lors de la sauvegarde')
    })
  }

  return (
    <div className="space-y-4">
      {/* En-tête colonnes */}
      <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--sw-ink-3)] uppercase tracking-wide">
        <div className="flex-1">Événement</div>
        <div className="w-20 text-center flex items-center justify-center gap-1">
          <Bell className="w-3 h-3" /> App
        </div>
        {hasEmail && (
          <div className="w-20 text-center flex items-center justify-center gap-1">
            <Mail className="w-3 h-3" /> E-mail
          </div>
        )}
      </div>

      <div className="sw-card overflow-hidden">
        <div className="divide-y divide-[var(--sw-line)]">
          {categories.map(cat => {
            const pref = prefs.find(p => p.event_category === cat.key)!
            return (
              <div key={cat.key} className="flex items-center gap-2 px-4 py-3.5">
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--sw-ink)]">{cat.label}</p>
                  <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">{cat.description}</p>
                  {cat.mandatory && (
                    <p className="text-xs text-[var(--sw-primary)] mt-0.5">Notifications obligatoires</p>
                  )}
                </div>

                {/* Toggle in-app */}
                <div className="w-20 flex items-center justify-center">
                  <button
                    onClick={() => toggle(cat.key, 'in_app')}
                    disabled={cat.mandatory}
                    className={`relative w-11 h-6 rounded-full transition-colors ${pref.in_app ? 'bg-[var(--sw-primary)]' : 'bg-[var(--sw-line)]'} ${cat.mandatory ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${pref.in_app ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

                {/* Toggle email */}
                {hasEmail && (
                  <div className="w-20 flex items-center justify-center">
                    <button
                      onClick={() => toggle(cat.key, 'email')}
                      className={`relative w-11 h-6 rounded-full transition-colors ${pref.email ? 'bg-[var(--sw-primary)]' : 'bg-[var(--sw-line)]'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${pref.email ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {!hasEmail && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-surface-2)]">
          <Mail className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--sw-ink-3)]">
            Ajoutez une adresse e-mail à votre profil pour activer les notifications par e-mail.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-[var(--sw-danger)] text-sm">
          <BellOff className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium disabled:opacity-60">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Enregistrer les préférences
        </button>
        {saved && (
          <div className="flex items-center gap-1 text-sm text-[var(--sw-success)]">
            <CheckCircle2 className="w-4 h-4" /> Sauvegardé
          </div>
        )}
      </div>
    </div>
  )
}
