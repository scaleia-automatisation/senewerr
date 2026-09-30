import { PublicHeader } from '@/components/layout/public-header'
import { PublicFooter } from '@/components/layout/public-footer'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'FAQ' }

const FAQ = [
  { q: 'Séné Wérr est-il gratuit pour les patients ?', a: "Oui, l'espace patient est entièrement gratuit. Créez votre compte en quelques secondes." },
  { q: 'Comment prendre un rendez-vous ?', a: 'Connectez-vous à votre espace patient, cliquez sur "Rendez-vous", cherchez un professionnel ou un établissement et choisissez un créneau disponible.' },
  { q: "Qu'est-ce que le code de retrait ?", a: 'Lorsque vous réservez des médicaments, un code à 6 caractères vous est attribué. Présentez-le à la pharmacie pour retirer votre commande.' },
  { q: 'Ma réservation expire-t-elle ?', a: 'Sans paiement : 3h. Avec paiement Orange Money ou Wave : 72h après confirmation du paiement.' },
  { q: 'Comment rejoindre la plateforme en tant que professionnel ?', a: "Créez un compte \"Professionnel de santé\", renseignez votre numéro d'ordre et attendez la validation de votre dossier (24-48h)." },
  { q: 'Mes données médicales sont-elles sécurisées ?', a: 'Oui. Vos données sont chiffrées et accessibles uniquement aux professionnels que vous autorisez, conformément au secret médical.' },
  { q: 'Quels modes de paiement sont acceptés ?', a: 'Orange Money et Wave pour les patients. Stripe (carte bancaire) pour les abonnements professionnels.' },
  { q: 'Puis-je ajouter ma famille sur mon compte ?', a: 'Oui. Dans "Ma famille", ajoutez vos proches (enfants, conjoint…) et gérez leurs rendez-vous et réservations depuis votre espace.' },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--sw-surface)]">
      <PublicHeader />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-10 space-y-8 w-full">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-[var(--sw-ink)]">Questions fréquentes</h1>
          <p className="text-[var(--sw-ink-2)]">Les réponses aux questions les plus courantes</p>
        </div>
        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <details
              key={i}
              className="sw-card group"
            >
              <summary className="flex cursor-pointer items-start justify-between gap-3 p-5 text-sm font-medium text-[var(--sw-ink)] list-none">
                <span>{item.q}</span>
                <span className="text-[var(--sw-ink-3)] shrink-0 mt-0.5 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div className="px-5 pb-5 text-sm text-[var(--sw-ink-2)] border-t border-[var(--sw-line)] pt-3">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
