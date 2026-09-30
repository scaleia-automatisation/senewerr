import { PublicFooter } from '@/components/layout/public-footer'
import { PublicHeader } from '@/components/layout/public-header'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Politique de confidentialité' }

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--sw-surface)]">
      <PublicHeader showBack backLabel="Accueil" />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 space-y-8 w-full">
        <h1 className="text-3xl font-bold text-[var(--sw-ink)]">Politique de confidentialité</h1>
        <div className="space-y-6 text-[var(--sw-ink-2)]">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">Données collectées</h2>
            <p>Séné Wérr collecte les données nécessaires à la fourniture de ses services : identité, coordonnées, informations de santé dans le cadre strict du suivi médical, données de paiement traitées par nos prestataires certifiés (Stripe, Orange Money, Wave).</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">Finalités</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Gestion des rendez-vous et consultations</li>
              <li>Gestion des ordonnances et réservations de médicaments</li>
              <li>Coordination avec les organismes de couverture santé</li>
              <li>Amélioration des services et expérience utilisateur</li>
              <li>Respect des obligations légales (Code de la santé publique du Sénégal)</li>
            </ul>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">Vos droits</h2>
            <p>Conformément à la loi sénégalaise sur la protection des données personnelles (loi n° 2008-12), vous disposez d'un droit d'accès, de rectification, d'opposition et de suppression de vos données. Exercez ces droits à : donnees@senewerr.sn</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">Sécurité</h2>
            <p>Vos données sont chiffrées en transit (TLS) et au repos. L'accès aux données de santé est strictement limité aux professionnels autorisés selon le principe du secret médical.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sw-ink)]">Cookies</h2>
            <p>Nous utilisons uniquement des cookies strictement nécessaires au fonctionnement de la session. Voir notre <a href="/cookies" className="text-[var(--sw-primary)] hover:underline">politique cookies</a>.</p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
