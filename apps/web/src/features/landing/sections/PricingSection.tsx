import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { cn, formatFCFA } from '@/lib/utils'

const PLANS = [
  {
    code: 'gratuit',
    name: 'Gratuit',
    price: 0,
    description: 'Pour découvrir Medikool',
    cta: 'Commencer',
    featured: false,
    features: ['20 rendez-vous / mois', 'Ordonnances numériques', 'Profil patient complet', 'Rappels par email'],
  },
  {
    code: 'standard',
    name: 'Standard',
    price: 9900,
    description: 'Pour les professionnels en solo',
    cta: 'Essai 14 jours',
    featured: true,
    features: [
      'Rendez-vous illimités',
      'Agenda en ligne partagé',
      'Téléconsultation intégrée',
      'Rappels SMS & WhatsApp',
      'Statistiques de base',
      'Support par email',
    ],
  },
  {
    code: 'premium',
    name: 'Premium',
    price: 29900,
    description: 'Pour les cabinets et cliniques',
    cta: 'Nous contacter',
    featured: false,
    features: [
      'Tout Standard, plus :',
      'Multi-praticiens illimité',
      'Assistant IA médical',
      'Gestion des salles',
      'Facturation intégrée',
      'Support prioritaire',
    ],
  },
]

export function PricingSection() {
  return (
    <section id="tarifs" className="bg-surface-2 py-s-8">
      <div className="mx-auto max-w-container px-s-4 sm:px-s-6">
        <div className="mb-s-7 text-center">
          <p className="mb-s-2 text-small font-semibold uppercase tracking-[0.06em] text-primary">Tarifs</p>
          <h2 className="font-display text-h1 font-semibold text-ink">Des tarifs adaptés à vos besoins</h2>
          <p className="mt-s-3 text-body text-ink-2">Commencez gratuitement. Évoluez quand vous êtes prêt.</p>
        </div>

        <div className="grid gap-s-4 sm:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.code}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className={cn(
                'flex h-full flex-col rounded-lg border bg-surface p-s-5 shadow-1',
                plan.featured ? 'border-primary ring-1 ring-primary' : 'border-line',
              )}
            >
              {plan.featured && (
                <span className="mb-s-3 inline-flex w-fit items-center rounded-pill bg-primary-soft px-s-3 py-s-1 text-micro font-semibold text-primary">
                  Le plus choisi
                </span>
              )}
              <h3 className="font-display text-h3 font-semibold text-ink">{plan.name}</h3>
              <p className="mt-s-1 text-small text-ink-3">{plan.description}</p>
              <div className="mt-s-4 flex items-baseline gap-s-1">
                {plan.price === 0 ? (
                  <span className="font-display text-h1 font-semibold text-ink">Gratuit</span>
                ) : (
                  <>
                    <span className="font-display text-h1 font-semibold text-ink tabular-nums">{formatFCFA(plan.price)}</span>
                    <span className="text-small text-ink-3">/mois</span>
                  </>
                )}
              </div>

              <ul className="my-s-5 flex flex-1 flex-col gap-s-3">
                {plan.features.map(feat => (
                  <li key={feat} className="flex items-start gap-s-2 text-small text-ink-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {feat}
                  </li>
                ))}
              </ul>

              <Button variant={plan.featured ? 'primary' : 'secondary'} fullWidth asChild>
                <Link to="/auth/inscription">{plan.cta}</Link>
              </Button>
            </motion.div>
          ))}
        </div>

        <p className="mt-s-6 text-center text-small text-ink-3">
          Paiement par carte, Wave ou Orange Money · Sans engagement
        </p>
      </div>
    </section>
  )
}
