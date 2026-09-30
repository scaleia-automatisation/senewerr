import Link from 'next/link'
import { PublicHeader } from '@/components/layout/public-header'
import { PublicFooter } from '@/components/layout/public-footer'
import { Button } from '@/components/ui/button'
import { Heart, Globe, Shield, Users, Stethoscope, Building2 } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "À propos — Séné Wérr",
  description: "Séné Wérr connecte patients, professionnels de santé, pharmacies et organismes de couverture au Sénégal dans un écosystème numérique unifié.",
}

const STATS = [
  { value: '4', label: 'Acteurs connectés' },
  { value: '3', label: 'Langues supportées' },
  { value: '100%', label: 'Données chiffrées' },
  { value: '0 F', label: "Pour les patients" },
]

const VALUES = [
  {
    icon: Heart,
    title: "Accessibilité universelle",
    desc: "La santé numérique doit être accessible à tous — patients urbains comme ruraux, avec ou sans smartphone haut de gamme. Séné Wérr fonctionne sur les connexions lentes et les appareils abordables.",
  },
  {
    icon: Shield,
    title: "Sécurité des données médicales",
    desc: "Vos données de santé sont des données sensibles. Nous appliquons le chiffrement bout en bout, la conformité CDPD, et ne revendons aucune donnée personnelle ou médicale.",
  },
  {
    icon: Globe,
    title: "Ancrage local",
    desc: "Interface en français, wolof et anglais. Paiements via Orange Money et Wave. Terminologie adaptée aux réalités sénégalaises : structures publiques EPS1/EPS2/EPS3, IPM, mutuelles communautaires.",
  },
  {
    icon: Users,
    title: "Coordination des soins",
    desc: "Un dossier médical partagé, des ordonnances numériques vérifiables, un tiers payant instantané — tout pour réduire les frictions entre les acteurs du système de santé.",
  },
]

const ACTORS = [
  {
    icon: Users,
    color: "bg-teal-50 text-teal-700",
    title: "Patients",
    desc: "Accès gratuit au dossier médical, réservation de médicaments, tiers payant automatique, gestion de la famille.",
  },
  {
    icon: Stethoscope,
    color: "bg-purple-50 text-purple-700",
    title: "Professionnels de santé",
    desc: "Prescriptions numériques, agenda intelligent, dossiers partagés, statistiques de patientèle.",
  },
  {
    icon: Building2,
    color: "bg-orange-50 text-orange-700",
    title: "Pharmacies",
    desc: "Gestion du stock en temps réel, traitement des réservations, intégration tiers payant, historique complet.",
  },
  {
    icon: Shield,
    color: "bg-green-50 text-green-700",
    title: "Organismes de couverture",
    desc: "Gestion des adhérents, traitement des demandes de prise en charge, rapports et statistiques.",
  },
]

export default function AProposPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--sw-surface)]">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 px-4 text-center bg-gradient-to-b from-[var(--sw-primary-subtle)] to-[var(--sw-surface)]">
          <div className="max-w-3xl mx-auto space-y-4">
            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium bg-[var(--sw-primary-muted)] text-[var(--sw-primary-dark)]">
              Séné Wérr — "la santé de tout un chacun"
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-[var(--sw-ink)] leading-tight">
              Une plateforme de santé<br />conçue pour le Sénégal
            </h1>
            <p className="text-lg text-[var(--sw-ink-2)] max-w-2xl mx-auto leading-relaxed">
              Nous connectons patients, professionnels de santé, pharmacies et organismes de couverture
              dans un écosystème numérique unifié, adapté aux réalités locales.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="py-10 px-4 border-b border-[var(--sw-line)]">
          <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STATS.map(({ value, label }) => (
              <div key={label} className="sw-card p-5 text-center">
                <p className="text-3xl font-bold text-[var(--sw-primary)]">{value}</p>
                <p className="text-xs text-[var(--sw-ink-2)] mt-1">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Mission */}
        <section className="py-14 px-4">
          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-[var(--sw-ink)]">Notre mission</h2>
            <div className="space-y-4 text-[var(--sw-ink-2)] leading-relaxed">
              <p>
                Au Sénégal, la coordination entre les différents acteurs de santé reste un défi
                quotidien : dossiers papier perdus, ordonnances illisibles, tiers payant manuel,
                stocks de médicaments non visibles. Séné Wérr résout ces frictions une par une.
              </p>
              <p>
                Notre plateforme est développée en partenariat avec des professionnels de santé
                sénégalais. Elle respecte les réglementations locales et les normes internationales
                de sécurité des données de santé (CDPD, chiffrement AES-256, hébergement sécurisé).
              </p>
              <p>
                L'accès patient est et restera gratuit. Nous croyons que l'accès à ses propres
                données de santé est un droit fondamental, pas un service premium.
              </p>
            </div>
          </div>
        </section>

        {/* Acteurs */}
        <section className="py-14 px-4 bg-[var(--sw-surface-2)]">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-2xl font-bold text-[var(--sw-ink)]">Les quatre acteurs</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {ACTORS.map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="sw-card p-5 space-y-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--sw-ink)]">{title}</p>
                    <p className="text-sm text-[var(--sw-ink-2)] mt-1 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Valeurs */}
        <section className="py-14 px-4">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-2xl font-bold text-[var(--sw-ink)]">Nos valeurs</h2>
            <div className="space-y-6">
              {VALUES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[var(--sw-primary)]" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-[var(--sw-ink)]">{title}</p>
                    <p className="text-sm text-[var(--sw-ink-2)] leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-14 px-4 bg-[var(--sw-primary)] text-white text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold">Rejoignez l'écosystème</h2>
            <p className="text-white/80">
              Que vous soyez patient, professionnel de santé, pharmacie ou organisme de couverture,
              Séné Wérr a un espace conçu pour vous.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/inscription">
                <Button size="lg" className="bg-white text-[var(--sw-primary)] hover:bg-white/90 w-full sm:w-auto">
                  Créer un compte gratuit
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="ghost" className="text-white border border-white/40 hover:bg-white/10 w-full sm:w-auto">
                  Nous contacter
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
