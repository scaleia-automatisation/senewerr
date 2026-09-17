import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Search, Zap, Smartphone, Clock, Heart, ArrowRight } from 'lucide-react'

const ease = [0.2, 0.8, 0.2, 1] as const

export function HeroSection() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    navigate(`/auth/inscription${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  }

  return (
    <section className="relative overflow-hidden">
      {/* Bloc dégradé */}
      <div className="relative bg-gradient-hero px-s-4 pb-s-8 pt-s-7 sm:px-s-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="inline-flex items-center gap-s-2 rounded-pill bg-white/15 px-s-3 py-s-1 text-small font-medium text-white backdrop-blur-sm"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-pill bg-white/25 text-[9px] font-bold">SN</span>
            Sénégal · Bientôt dans toute l'Afrique
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease }}
            className="mt-s-4 font-display text-display font-bold leading-tight text-white"
          >
            Votre médicament trouvé et réservé{' '}
            <span className="whitespace-nowrap rounded-md bg-white/20 px-s-2 py-s-1 backdrop-blur-sm">en 1 clic.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease }}
            className="mt-s-3 text-h3 font-semibold text-white/90"
          >
            Zéro stress, zéro tracas.
          </motion.p>

          {/* Barre de recherche */}
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease }}
            className="mx-auto mt-s-6 flex max-w-2xl items-center gap-s-2 rounded-lg bg-surface p-s-2 shadow-2"
          >
            <Search className="ml-s-2 h-5 w-5 shrink-0 text-accent" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Ex. Doliprane 1000mg, Amoxicilline…"
              className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-3 focus:outline-none"
              aria-label="Rechercher un médicament"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-primary px-s-5 py-s-3 text-body font-semibold text-primary-fg transition-colors duration-fast hover:bg-primary-hover active:scale-[.97]"
            >
              Trouver
            </button>
          </motion.form>

          {/* Ligne de confiance */}
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-s-5 flex flex-col items-center justify-center gap-s-3 text-small font-medium text-white sm:flex-row sm:gap-s-5"
          >
            <li className="flex items-center gap-s-2"><Zap className="h-4 w-4" /> Disponibilité temps réel</li>
            <li className="flex items-center gap-s-2"><Smartphone className="h-4 w-4" /> Wave · Orange Money · Carte</li>
            <li className="flex items-center gap-s-2"><Clock className="h-4 w-4" /> Retrait en 30 min</li>
          </motion.ul>
        </div>

        {/* vague de séparation */}
        <svg className="absolute inset-x-0 bottom-0 h-8 w-full text-bg" viewBox="0 0 1440 40" preserveAspectRatio="none" aria-hidden="true">
          <path fill="currentColor" d="M0,40 L0,20 C240,40 480,0 720,10 C960,20 1200,40 1440,16 L1440,40 Z" />
        </svg>
      </div>

      {/* Bannière pharmacies de garde */}
      <div className="mx-auto -mt-s-2 max-w-container px-s-4 sm:px-s-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5, ease }}
          className="flex flex-col items-start justify-between gap-s-4 rounded-lg bg-gradient-green p-s-5 shadow-2 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-s-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-white/15">
              <Heart className="h-6 w-6 text-white" />
            </span>
            <div>
              <p className="font-display text-h3 font-bold text-white">Pharmacies de garde 24/7</p>
              <p className="text-small text-white/90">Trouvez une pharmacie ouverte cette nuit près de chez vous.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/auth/inscription')}
            className="inline-flex shrink-0 items-center gap-s-2 rounded-pill bg-surface px-s-4 py-s-2 text-small font-semibold text-primary transition-transform hover:scale-[1.02] active:scale-[.98]"
          >
            Voir la garde <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    </section>
  )
}
