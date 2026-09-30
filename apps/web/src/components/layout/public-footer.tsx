import Link from 'next/link'
import { Logo } from '@/components/ui/logo'

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--sw-line)] bg-[var(--sw-surface)] py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <Link href="/" className="shrink-0">
            <Logo size="sm" />
          </Link>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 flex-1">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[var(--sw-ink)] uppercase tracking-wider">Espaces</p>
              <ul className="space-y-2">
                <li><Link href="/patients" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Patients</Link></li>
                <li><Link href="/pharmacies" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Pharmacies</Link></li>
                <li><Link href="/professionnels" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Professionnels</Link></li>
                <li><Link href="/mutuelles" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Mutuelles</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-[var(--sw-ink)] uppercase tracking-wider">Découvrir</p>
              <ul className="space-y-2">
                <li><Link href="/fonctionnalites" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Fonctionnalités</Link></li>
                <li><Link href="/comment-ca-marche" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Comment ça marche</Link></li>
                <li><Link href="/tarifs" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Tarifs</Link></li>
                <li><Link href="/a-propos" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">À propos</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-[var(--sw-ink)] uppercase tracking-wider">Support</p>
              <ul className="space-y-2">
                <li><Link href="/faq" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">FAQ</Link></li>
                <li><Link href="/contact" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-[var(--sw-ink)] uppercase tracking-wider">Légal</p>
              <ul className="space-y-2">
                <li><Link href="/cgu" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">CGU</Link></li>
                <li><Link href="/politique-confidentialite" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Confidentialité</Link></li>
                <li><Link href="/mentions-legales" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Mentions légales</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--sw-line)] pt-6">
          <p className="text-xs text-[var(--sw-ink-3)] text-center sm:text-left">
            © 2026 Séné Wérr — Plateforme de santé connectée au Sénégal
          </p>
        </div>
      </div>
    </footer>
  )
}
