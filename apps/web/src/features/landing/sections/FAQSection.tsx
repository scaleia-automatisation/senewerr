import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'

const FAQ_ITEMS = [
  {
    q: 'Séne Wérr est-il sécurisé pour mes données de santé ?',
    a: 'Oui. Vos données de santé sont chiffrées et ne sont jamais partagées sans votre consentement explicite. L\'accès est strictement contrôlé selon votre rôle.',
  },
  {
    q: 'Comment fonctionne la prise en charge par ma mutuelle ?',
    a: 'Après votre consultation, le médecin génère une ordonnance numérique. Vous la partagez avec la pharmacie et votre mutuelle via Séne Wérr, qui valide la couverture et paie sa part.',
  },
  {
    q: 'Puis-je utiliser Séne Wérr sans connexion internet ?',
    a: 'Partiellement. L\'application affiche vos données en cache hors-ligne (rendez-vous, ordonnances). Les actions nécessitant une connexion sont synchronisées automatiquement au retour du réseau.',
  },
  {
    q: 'Les professionnels doivent-ils payer pour s\'inscrire ?',
    a: 'Non. L\'inscription est gratuite avec 20 rendez-vous par mois. Les abonnements payants débloquent l\'agenda illimité, l\'IA et les statistiques.',
  },
  {
    q: 'Comment puis-je payer ? Wave et Orange Money sont-ils acceptés ?',
    a: 'Oui. Séne Wérr accepte les cartes bancaires, Wave et Orange Money. Le paiement en pharmacie peut aussi se faire sur place selon les options proposées.',
  },
  {
    q: 'Mes ordonnances sont-elles reconnues ?',
    a: 'Les ordonnances numériques sont signées électroniquement par le professionnel et incluent un QR code vérifiable par toute pharmacie partenaire.',
  },
]

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="bg-bg py-s-8">
      <div className="mx-auto max-w-3xl px-s-4 sm:px-s-6">
        <h2 className="mb-s-6 text-center font-display text-h1 font-semibold text-ink">Questions fréquentes</h2>

        <div className="flex flex-col gap-s-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-line bg-surface">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-s-3 px-s-5 py-s-4 text-left"
                aria-expanded={open === i}
              >
                <span className="text-body font-medium text-ink">{item.q}</span>
                {open === i
                  ? <Minus className="h-4 w-4 shrink-0 text-primary" />
                  : <Plus className="h-4 w-4 shrink-0 text-ink-3" />}
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    <p className="px-s-5 pb-s-5 text-small leading-relaxed text-ink-2">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
