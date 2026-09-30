'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { href: '/patients',         label: 'Patients' },
  { href: '/pharmacies',       label: 'Pharmacies' },
  { href: '/professionnels',   label: 'Professionnels' },
  { href: '/mutuelles',        label: 'Mutuelles' },
  { href: '/fonctionnalites',  label: 'Fonctionnalités' },
  { href: '/comment-ca-marche', label: 'Comment ça marche' },
  { href: '/tarifs',           label: 'Tarifs' },
  { href: '/a-propos',         label: 'À propos' },
  { href: '/faq',              label: 'FAQ' },
  { href: '/contact',          label: 'Contact' },
]

export function MobileMenu() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={open}
        className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-[var(--sw-ink-2)] hover:bg-[var(--sw-surface-2)] transition-colors"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-[var(--sw-surface)] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation"
        >
          <div className="px-4 h-14 flex items-center justify-between border-b border-[var(--sw-line)]">
            <span className="font-semibold text-[var(--sw-ink)]">Menu</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fermer le menu"
              className="flex items-center justify-center w-9 h-9 rounded-lg text-[var(--sw-ink-2)] hover:bg-[var(--sw-surface-2)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center px-3 py-3 rounded-xl text-base font-medium text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] hover:bg-[var(--sw-primary-subtle)] transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="px-4 py-6 border-t border-[var(--sw-line)] space-y-3">
            <Link
              href="/connexion"
              onClick={() => setOpen(false)}
              className="block w-full text-center py-3 rounded-xl border border-[var(--sw-line)] text-sm font-medium text-[var(--sw-ink)] hover:bg-[var(--sw-surface-2)] transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/inscription"
              onClick={() => setOpen(false)}
              className="block w-full text-center py-3 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium hover:bg-[var(--sw-primary-dark)] transition-colors"
            >
              S'inscrire gratuitement
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
