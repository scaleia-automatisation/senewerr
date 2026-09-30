'use client'
// Spec 24.1 — sélecteur de langue, disponible dès la page d'accueil
// et depuis les paramètres (spec 24.1 : modifiable à tout moment)
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LOCALES, LOCALE_LABELS, DEFAULT_LOCALE, type Locale } from '@/lib/i18n'
import { Globe } from 'lucide-react'

function readLocaleCookie(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const match = document.cookie.match(/(?:^|;\s*)sw-locale=([^;]+)/)
  if (match && (LOCALES as readonly string[]).includes(match[1])) return match[1] as Locale
  return DEFAULT_LOCALE
}

type Props = {
  compact?: boolean  // compact = icône seule + menu déroulant
}

export default function LanguageSwitcher({ compact = false }: Props) {
  const router = useRouter()
  const [current, setCurrent] = useState<Locale>(DEFAULT_LOCALE)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setCurrent(readLocaleCookie())
  }, [])

  function selectLocale(locale: Locale) {
    // Durée d'1 an
    const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toUTCString()
    document.cookie = `sw-locale=${locale};path=/;expires=${expires};SameSite=Lax`
    setCurrent(locale)
    setOpen(false)
    router.refresh()
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          aria-label={LOCALE_LABELS[current]}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-medium
            text-[var(--sw-ink-2)] hover:bg-[var(--sw-surface-2)] transition-colors"
        >
          <Globe className="w-4 h-4" aria-hidden="true" />
          <span>{current.toUpperCase()}</span>
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              aria-hidden="true"
              onClick={() => setOpen(false)}
            />
            <ul
              role="listbox"
              aria-label="Sélectionner une langue"
              className="absolute right-0 top-full mt-1 z-20 sw-card py-1 min-w-[140px] shadow-lg"
            >
              {LOCALES.map(locale => (
                <li key={locale}>
                  <button
                    role="option"
                    aria-selected={locale === current}
                    onClick={() => selectLocale(locale)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors
                      ${locale === current
                        ? 'text-[var(--sw-primary)] font-semibold bg-[var(--sw-primary-subtle)]'
                        : 'text-[var(--sw-ink)] hover:bg-[var(--sw-surface-2)]'
                      }`}
                  >
                    {LOCALE_LABELS[locale]}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    )
  }

  // Version étendue — pour la page paramètres et la page d'accueil
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Langue de l'interface">
      {LOCALES.map(locale => (
        <button
          key={locale}
          role="radio"
          aria-checked={locale === current}
          onClick={() => selectLocale(locale)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
            ${locale === current
              ? 'bg-[var(--sw-primary)] text-white'
              : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)] hover:bg-[var(--sw-surface-3)]'
            }`}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  )
}
