import { PublicFooter } from '@/components/layout/public-footer'
import { PublicHeader } from '@/components/layout/public-header'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: "Conditions générales d'utilisation" }

export default function CguPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--sw-surface)]">
      <PublicHeader showBack backLabel="Accueil" />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 space-y-8 w-full">
        <h1 className="text-3xl font-bold text-[var(--sw-ink)]">Conditions générales d'utilisation</h1>
        <div className="space-y-6 text-[var(--sw-ink-2)]">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">1. Objet</h2>
            <p>Les présentes CGU définissent les conditions d'accès et d'utilisation de la plateforme Séné Wérr par tout utilisateur (patient, professionnel de santé, pharmacie, organisme de couverture).</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">2. Accès à la plateforme</h2>
            <p>L'accès Patient est gratuit. Les espaces professionnels (Santé, Pharmacie, Couverture) sont soumis à abonnement et à une vérification de conformité par nos équipes.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">3. Obligations des utilisateurs</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Fournir des informations exactes et à jour</li>
              <li>Respecter le secret médical pour les professionnels</li>
              <li>Ne pas utiliser la plateforme à des fins frauduleuses</li>
              <li>Respecter les droits des autres utilisateurs</li>
            </ul>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">4. Réservations</h2>
            <p>Sans paiement : réservation valable 3h. Avec paiement : réservation valable 72h après confirmation du paiement. Passé ce délai, la réservation est automatiquement annulée et les médicaments remis en stock.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">5. Droit applicable</h2>
            <p>Les présentes CGU sont soumises au droit sénégalais. Tout litige sera soumis aux tribunaux compétents de Dakar.</p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
