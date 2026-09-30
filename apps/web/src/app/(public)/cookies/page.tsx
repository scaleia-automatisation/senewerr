import { PublicFooter } from '@/components/layout/public-footer'
import { PublicHeader } from '@/components/layout/public-header'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Politique cookies' }

export default function CookiesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--sw-surface)]">
      <PublicHeader showBack backLabel="Accueil" />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 space-y-8 w-full">
        <h1 className="text-3xl font-bold text-[var(--sw-ink)]">Politique cookies</h1>
        <div className="space-y-6 text-[var(--sw-ink-2)]">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">Cookies utilisés</h2>
            <p>Séné Wérr n'utilise que des cookies strictement nécessaires au fonctionnement de la session authentifiée. Aucun cookie de tracking ou publicitaire n'est déposé.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">Cookies de session Supabase</h2>
            <p>Ces cookies permettent de maintenir votre connexion sécurisée. Ils expirent à la fermeture de la session ou après 7 jours d'inactivité.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">Gestion des cookies</h2>
            <p>Vous pouvez désactiver les cookies dans les paramètres de votre navigateur, mais cela empêchera la connexion à la plateforme.</p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
