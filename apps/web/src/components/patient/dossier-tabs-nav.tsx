'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/patient/dossier',              label: 'Identité',      exact: true },
  { href: '/patient/dossier/sante',         label: 'Santé' },
  { href: '/patient/dossier/consultations', label: 'Consultations' },
  { href: '/patient/dossier/ordonnances',   label: 'Ordonnances' },
  { href: '/patient/dossier/examens',       label: 'Examens' },
  { href: '/patient/dossier/rendez-vous',   label: 'Rendez-vous' },
  { href: '/patient/dossier/couverture',    label: 'Couverture' },
  { href: '/patient/dossier/pharmacie',     label: 'Pharmacie' },
  { href: '/patient/dossier/paiements',     label: 'Paiements' },
  { href: '/patient/dossier/documents',     label: 'Documents' },
  { href: '/patient/dossier/historique',    label: 'Historique' },
]

export function DossierTabsNav() {
  const pathname = usePathname()
  return (
    <div className="flex gap-0.5 overflow-x-auto px-3 py-2" style={{ scrollbarWidth: 'none' }}>
      {TABS.map(t => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              active
                ? 'bg-[var(--sw-primary)] text-white'
                : 'text-[var(--sw-ink-2)] hover:text-[var(--sw-ink)] hover:bg-[var(--sw-surface-2)]'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
