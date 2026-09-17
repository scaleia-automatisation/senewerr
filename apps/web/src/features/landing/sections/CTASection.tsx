import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Building2, ShieldCheck } from 'lucide-react'

const ease = [0.2, 0.8, 0.2, 1] as const

export function CTASection() {
  const navigate = useNavigate()

  return (
    <section className="bg-bg py-s-8">
      <div className="mx-auto grid max-w-container gap-s-5 px-s-4 sm:px-s-6 lg:grid-cols-2">
        {/* Pharmacien — carte dégradé turquoise → pétrole */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease }}
          className="rounded-lg bg-gradient-teal p-s-6 shadow-2"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-white/15">
            <Building2 className="h-6 w-6 text-white" />
          </span>
          <h3 className="mt-s-4 font-display text-h2 font-bold text-white">Vous êtes pharmacien ?</h3>
          <p className="mt-s-2 max-w-md text-body text-white/85">
            Publiez votre stock, recevez commandes et réservations, encaissez, et laissez Medikool gérer les factures mutuelles.
          </p>
          <button
            onClick={() => navigate('/auth/inscription')}
            className="mt-s-5 rounded-md bg-primary px-s-5 py-s-3 text-body font-semibold text-primary-fg transition-colors duration-fast hover:bg-primary-hover active:scale-[.97]"
          >
            Rejoindre Medikool
          </button>
        </motion.div>

        {/* Mutuelle — carte blanche */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.08, ease }}
          className="rounded-lg border border-line bg-surface p-s-6 shadow-1"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-navy-soft">
            <ShieldCheck className="h-6 w-6 text-navy" />
          </span>
          <h3 className="mt-s-4 font-display text-h2 font-bold text-navy">Vous êtes mutuelle ?</h3>
          <p className="mt-s-2 max-w-md text-body text-ink-2">
            Validez vos assurés, suivez les factures à rembourser, et centralisez vos remboursements sur une seule plateforme.
          </p>
          <button
            onClick={() => navigate('/auth/inscription')}
            className="mt-s-5 rounded-md bg-primary px-s-5 py-s-3 text-body font-semibold text-primary-fg transition-colors duration-fast hover:bg-primary-hover active:scale-[.97]"
          >
            Espace mutuelle
          </button>
        </motion.div>
      </div>
    </section>
  )
}
