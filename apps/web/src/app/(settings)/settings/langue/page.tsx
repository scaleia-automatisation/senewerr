import { AlertTriangle, Globe, Eye, Smartphone, Contrast } from 'lucide-react'
import { getLocale, getT } from '@/lib/i18n/server'
import LanguageSwitcher from '@/components/shared/LanguageSwitcher'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Langue & accessibilité' }

// Spec 24 — paramètres de langue et d'accessibilité
export default async function LanguePage() {
  const locale = await getLocale()
  const tr = await getT()

  const accessibilityItems = [
    { icon: Eye, label: tr('accessibility.readable_text'), desc: 'Taille de police adaptée, interlignage suffisant' },
    { icon: Contrast, label: tr('accessibility.color_contrast'), desc: 'Ratio de contraste WCAG AA minimum' },
    { icon: Smartphone, label: tr('accessibility.mobile_friendly'), desc: 'Gutter 16 px, zones de touche ≥ 44 × 44 px' },
    { icon: Globe, label: tr('accessibility.screen_reader'), desc: 'Balises ARIA, labels, rôles sémantiques' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Langue & accessibilité</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 24.1–24.3</p>
      </div>

      {/* Sélection de la langue — spec 24.1 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Langue de l'interface</h2>
        <LanguageSwitcher />
        <p className="text-xs text-[var(--sw-ink-3)]">
          Langue active : <strong>{locale === 'fr' ? 'Français' : locale === 'wo' ? 'Wolof' : 'English'}</strong>.
          Le changement est appliqué immédiatement.
        </p>
      </section>

      {/* Note wolof — spec 24.3 */}
      {locale === 'wo' && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-warning-bg)]">
          <AlertTriangle className="w-4 h-4 text-[var(--sw-warning)] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-[var(--sw-warning)]">
            {tr('i18n.wolof_review_note')}
          </p>
        </div>
      )}

      {/* Règles de traduction — spec 24.2 */}
      <section className="sw-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Règles de traduction</h2>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--sw-primary)] mt-1.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-[var(--sw-ink-2)]">{tr('i18n.data_not_translated')}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--sw-primary)] mt-1.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-[var(--sw-ink-2)]">{tr('i18n.doc_original_content')}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--sw-primary)] mt-1.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-[var(--sw-ink-2)]">
              Sont traduisibles : menus, boutons, formulaires, messages d'erreur, notifications,
              e-mails, statuts, aide et consignes.
            </p>
          </div>
        </div>
      </section>

      {/* Accessibilité — spec 24.3 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)]">{tr('accessibility.title')}</h2>
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {accessibilityItems.map(item => (
              <div key={item.label} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--sw-ink)]">{item.label}</p>
                  <p className="text-xs text-[var(--sw-ink-3)]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-[var(--sw-ink-3)]">
          Navigation simple, messages d'erreur compréhensibles, utilisation confortable sur petit écran (spec 24.3).
        </p>
      </section>

      {/* Éléments traduisibles — démo */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Aperçu de l'interface traduite</h2>
        <div className="sw-card p-4 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {([
              ['common.save', 'common.cancel'],
              ['nav.dashboard', 'nav.appointments'],
              ['nav.prescriptions', 'nav.documents'],
              ['status.confirmed', 'status.pending'],
              ['status.active', 'status.suspended'],
              ['error.required_field', 'error.network_error'],
            ] as [string, string][]).map(([k1, k2]) => (
              <>
                <div key={k1} className="flex justify-between gap-2">
                  <span className="text-[var(--sw-ink-3)]">{k1.split('.')[1]}</span>
                  <span className="font-medium text-[var(--sw-ink)]">{tr(k1)}</span>
                </div>
                <div key={k2} className="flex justify-between gap-2">
                  <span className="text-[var(--sw-ink-3)]">{k2.split('.')[1]}</span>
                  <span className="font-medium text-[var(--sw-ink)]">{tr(k2)}</span>
                </div>
              </>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
