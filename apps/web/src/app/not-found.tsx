import Link from 'next/link'
import { PublicHeader } from '@/components/layout/public-header'
import { PublicFooter } from '@/components/layout/public-footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page introuvable — Séné Wérr',
  description: "Cette page n'existe pas ou a été déplacée.",
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--sw-surface)]">
      <PublicHeader />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="space-y-6 max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--sw-primary-subtle)] mx-auto">
            <span className="text-4xl font-bold text-[var(--sw-primary)]">404</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Page introuvable</h1>
            <p className="text-[var(--sw-ink-2)]">
              Cette page n'existe pas ou a été déplacée.
              Vérifiez l'URL ou revenez à l'accueil.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium hover:bg-[var(--sw-primary-dark)] transition-colors"
            >
              Accueil
            </Link>
            <Link
              href="/faq"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-[var(--sw-line)] text-sm font-medium text-[var(--sw-ink)] hover:bg-[var(--sw-surface-2)] transition-colors"
            >
              Centre d'aide
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
