import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { MobileMenu } from '@/components/layout/mobile-menu'

interface PublicHeaderProps {
  showBack?: boolean
  backHref?: string
  backLabel?: string
}

export function PublicHeader({ showBack, backHref = '/', backLabel = 'Retour' }: PublicHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-[var(--sw-surface)]/95 backdrop-blur-sm border-b border-[var(--sw-line)]">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 shrink-0">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          {showBack && (
            <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
              <ArrowLeft className="w-3.5 h-3.5" />
              {backLabel}
            </Link>
          )}
        </div>

        <nav className="hidden lg:flex items-center gap-5">
          <Link href="/patients" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Patients</Link>
          <Link href="/pharmacies" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Pharmacies</Link>
          <Link href="/professionnels" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Professionnels</Link>
          <Link href="/mutuelles" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Mutuelles</Link>
          <span className="w-px h-4 bg-[var(--sw-line)]" />
          <Link href="/fonctionnalites" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Fonctionnalités</Link>
          <Link href="/comment-ca-marche" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Comment ça marche</Link>
          <Link href="/tarifs" className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] transition-colors">Tarifs</Link>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-2">
            <Link href="/connexion">
              <Button variant="ghost" size="sm">Connexion</Button>
            </Link>
            <Link href="/inscription">
              <Button size="sm">S'inscrire</Button>
            </Link>
          </div>
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}
