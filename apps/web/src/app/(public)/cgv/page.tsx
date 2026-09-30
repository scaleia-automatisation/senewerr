import { PublicFooter } from '@/components/layout/public-footer'
import { PublicHeader } from '@/components/layout/public-header'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Conditions générales de vente' }

export default function CgvPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--sw-surface)]">
      <PublicHeader showBack backLabel="Accueil" />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 space-y-8 w-full">
        <h1 className="text-3xl font-bold text-[var(--sw-ink)]">Conditions générales de vente</h1>
        <div className="space-y-6 text-[var(--sw-ink-2)]">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">1. Abonnements professionnels</h2>
            <p>Les abonnements sont facturés mensuellement ou annuellement selon le plan choisi. Le paiement est effectué en FCFA via Stripe (carte bancaire). L'abonnement est reconduit tacitement sauf résiliation avant la date de renouvellement.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">2. Commissions sur réservations pharmacie</h2>
            <p>Séné Wérr perçoit une commission sur chaque réservation traitée via la plateforme, selon le plan souscrit (3% pour le plan Découverte, réduit pour les plans supérieurs). Cette commission est automatiquement déduite lors du virement mensuel.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">3. Paiements patients</h2>
            <p>Les patients peuvent payer leurs réservations via Orange Money ou Wave. Les paiements sont sécurisés et traités par les opérateurs agréés. En cas d'échec de paiement, la réservation reste active 3h.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">4. Remboursements</h2>
            <p>Toute demande de remboursement doit être formulée dans les 48h. Les remboursements sont traités sous 5 à 10 jours ouvrés par le même canal de paiement utilisé.</p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
