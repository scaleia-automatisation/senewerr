import { motion } from 'framer-motion'
import { Calendar, FileText, ShoppingBag, Shield, Sparkles, Bell } from 'lucide-react'

const FEATURES = [
  { icon: Calendar, title: 'Rendez-vous en ligne', description: 'Consultez les disponibilités et réservez chez votre médecin ou spécialiste en quelques secondes.' },
  { icon: FileText, title: 'Ordonnances numériques', description: 'Vos ordonnances signées électroniquement, accessibles partout et partagées en sécurité avec votre pharmacie.' },
  { icon: ShoppingBag, title: 'Réservation pharmacie', description: 'Vérifiez la disponibilité et réservez vos médicaments à l\'avance pour un retrait rapide.' },
  { icon: Shield, title: 'Prise en charge mutuelle', description: 'Soumettez vos demandes de remboursement directement depuis la plateforme, sans papier.' },
  { icon: Sparkles, title: 'Assistant IA médical', description: 'Analyse d\'ordonnances et résumés de consultations. L\'IA vous assiste, sans se substituer au soignant.' },
  { icon: Bell, title: 'Rappels intelligents', description: 'Ne manquez plus un rendez-vous ni une prise de médicament grâce aux notifications personnalisées.' },
]

export function FeaturesSection() {
  return (
    <section id="features" className="bg-surface-2 py-s-8">
      <div className="mx-auto max-w-container px-s-4 sm:px-s-6">
        <div className="mb-s-7 text-center">
          <p className="mb-s-2 text-small font-semibold text-accent">Fonctionnalités</p>
          <h2 className="font-display text-h1 font-semibold text-ink">Tout ce dont vous avez besoin</h2>
          <p className="mx-auto mt-s-3 max-w-xl text-body text-ink-2">
            De la prise de rendez-vous au remboursement, Séne Wérr couvre tout votre parcours de santé.
          </p>
        </div>

        <div className="grid gap-s-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="rounded-lg bg-surface p-s-5 shadow-1"
            >
              <div className="mb-s-4 inline-flex h-12 w-12 items-center justify-center rounded-md bg-accent-soft">
                <feat.icon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="mb-s-2 font-display text-h3 font-semibold text-ink">{feat.title}</h3>
              <p className="text-small leading-relaxed text-ink-2">{feat.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
