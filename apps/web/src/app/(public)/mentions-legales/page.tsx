import { PublicFooter } from '@/components/layout/public-footer'
import { PublicHeader } from '@/components/layout/public-header'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mentions légales' }

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--sw-surface)]">
      <PublicHeader showBack backLabel="Accueil" />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 space-y-8 w-full">
        <h1 className="text-3xl font-bold text-[var(--sw-ink)]">Mentions légales</h1>
        <div className="prose prose-slate max-w-none space-y-6 text-[var(--sw-ink-2)]">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">Éditeur</h2>
            <p>Séné Wérr — Plateforme de santé numérique pour le Sénégal<br />
            NINEA : [À compléter]<br />
            RCCM : [À compléter]<br />
            Adresse : Dakar, Sénégal<br />
            Email : contact@senewerr.sn</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">Hébergement</h2>
            <p>Supabase Inc. — San Francisco, CA, USA<br />
            Vercel Inc. — San Francisco, CA, USA</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">Propriété intellectuelle</h2>
            <p>L'ensemble des contenus présents sur la plateforme Séné Wérr (textes, images, logos, interfaces) est protégé par le droit d'auteur et appartient exclusivement à Séné Wérr ou à ses partenaires. Toute reproduction est interdite sans autorisation préalable.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">Responsabilité</h2>
            <p>Séné Wérr est une plateforme de mise en relation. Elle ne se substitue pas aux professionnels de santé et ne peut être tenue responsable des consultations ou traitements médicaux. En cas d'urgence médicale, appelez le 15 (SAMU) ou le 1515.</p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
