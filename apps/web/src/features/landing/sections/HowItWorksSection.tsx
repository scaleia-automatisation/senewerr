import { motion } from 'framer-motion'
import { Search, Package, MapPin } from 'lucide-react'

const STEPS = [
  { icon: Search, num: '01', title: 'Cherchez', description: 'Tapez le nom du médicament. Nous scannons les pharmacies proches en temps réel.' },
  { icon: Package, num: '02', title: 'Réservez ou achetez', description: 'Payez avec Wave, Orange Money, Free Money ou carte. Ou payez sur place.' },
  { icon: MapPin, num: '03', title: 'Récupérez', description: 'Recevez un code à 4 chiffres. Retrait en pharmacie en 30 min ou livraison.' },
]

export function HowItWorksSection() {
  return (
    <section id="comment" className="bg-bg py-s-8">
      <div className="mx-auto max-w-container px-s-4 sm:px-s-6">
        <div className="mb-s-7 text-center">
          <h2 className="mx-auto max-w-2xl font-display text-h1 font-bold text-navy">
            Trouver un médicament express peut sauver une vie
          </h2>
          <p className="mt-s-3 font-display text-h3 font-semibold text-accent">
            3 étapes. Zéro stress, zéro tracas.
          </p>
        </div>

        <div className="grid gap-s-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
              className="relative rounded-lg border border-line bg-surface p-s-5 shadow-1"
            >
              <span className="absolute right-s-5 top-s-4 font-display text-h1 font-bold text-surface-2">
                {step.num}
              </span>
              <div className="mb-s-4 inline-flex h-12 w-12 items-center justify-center rounded-pill bg-accent-soft">
                <step.icon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="mb-s-2 font-display text-h3 font-semibold text-navy">{step.title}</h3>
              <p className="text-small leading-relaxed text-ink-2">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
