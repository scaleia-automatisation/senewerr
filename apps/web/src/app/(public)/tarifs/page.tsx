import Link from 'next/link'
import { CheckCircle2, ArrowRight, Zap } from 'lucide-react'
import { PublicHeader } from '@/components/layout/public-header'
import { PublicFooter } from '@/components/layout/public-footer'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { formatCFA } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tarifs — Séné Wérr',
  description: 'Gratuit pour les patients. Plans abordables pour les professionnels, pharmacies et mutuelles.',
}

export default async function TarifsPage() {
  const supabase = await createClient()
  const { data: plansData } = await supabase
    .from('pricing_plans')
    .select('*')
    .eq('is_active', true)
    .order('actor_type')
    .order('sort_order')

  const plans = (plansData ?? []) as unknown as Record<string, unknown>[]
  const pharmaPlans = plans.filter(p => p.actor_type === 'pharmacie')
  const santePlans = plans.filter(p => p.actor_type === 'sante' && ['essentiel', 'pro', 'premium'].includes(p.plan_name as string))
  const coverturePlans = plans.filter(p => p.actor_type === 'couverture')

  function PlanCard({ plan }: { plan: Record<string, unknown> }) {
    const features = plan.features as string[]
    const isPopular = plan.plan_name === 'pro'
    return (
      <div className={`relative rounded-2xl p-7 flex flex-col gap-5 transition-all
        ${isPopular
          ? 'bg-[var(--sw-primary)] border-2 border-[var(--sw-primary)] text-white shadow-2xl shadow-[var(--sw-primary)]/25 scale-[1.04] z-10'
          : 'bg-[var(--sw-surface)] border border-[var(--sw-line)] hover:shadow-md hover:border-[var(--sw-primary-muted)]'
        }`}>
        {isPopular && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="bg-white text-[var(--sw-primary)] text-xs font-bold px-4 py-1.5 rounded-full shadow">
              ⭐ Recommandé
            </span>
          </div>
        )}
        <div>
          <h3 className={`text-lg font-bold ${isPopular ? 'text-white' : 'text-[var(--sw-ink)]'}`}>
            {plan.display_name as string}
          </h3>
          <p className={`text-sm mt-1 ${isPopular ? 'text-white/70' : 'text-[var(--sw-ink-2)]'}`}>
            {plan.description as string}
          </p>
        </div>
        <div>
          {(plan.price_monthly_fcfa as number) === 0 ? (
            <p className={`text-2xl font-bold whitespace-nowrap ${isPopular ? 'text-white' : 'text-[var(--sw-ink)]'}`}>Gratuit</p>
          ) : (
            <p className={`text-2xl font-bold whitespace-nowrap ${isPopular ? 'text-white' : 'text-[var(--sw-ink)]'}`}>
              {formatCFA(plan.price_monthly_fcfa as number)}
              <span className={`text-sm font-normal ml-1 ${isPopular ? 'text-white/70' : 'text-[var(--sw-ink-2)]'}`}>/mois</span>
            </p>
          )}
          {(plan.price_yearly_fcfa as number) > 0 && (
            <p className={`text-xs mt-1 ${isPopular ? 'text-white/70' : 'text-[var(--sw-success)]'}`}>
              {formatCFA(plan.price_yearly_fcfa as number)}/an — 2 mois offerts
            </p>
          )}
        </div>
        <ul className="space-y-2.5 flex-1">
          {features.map((f, i) => (
            <li key={i} className={`flex items-start gap-2 text-sm ${isPopular ? 'text-white/85' : 'text-[var(--sw-ink-2)]'}`}>
              <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${isPopular ? 'text-white' : 'text-[var(--sw-success)]'}`} />
              {f}
            </li>
          ))}
        </ul>
        <Link href={`/inscription?profil=${plan.actor_type as string}`}>
          <Button
            className={`w-full font-semibold ${isPopular ? 'bg-white text-[var(--sw-primary)] hover:bg-white/90' : ''}`}
            variant={isPopular ? 'primary' : 'outline'}
          >
            Commencer
            {isPopular && <ArrowRight className="w-4 h-4 ml-1" />}
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--sw-surface)]">
      <PublicHeader />

      {/* ── Hero ── */}
      <section className="pt-20 pb-16 px-4 sm:px-6 bg-gradient-to-b from-[var(--sw-primary-subtle)] to-[var(--sw-surface)]">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Tarifs</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--sw-ink)] leading-tight">
            Simple et transparent.
          </h1>
          <p className="text-lg text-[var(--sw-ink-2)] max-w-xl mx-auto">
            Gratuit pour les patients. Plans abordables pour les professionnels, pharmacies et mutuelles.
          </p>
        </div>
      </section>

      {/* ── Section Patients ── */}
      <section className="py-16 px-4 sm:px-6 border-t border-[var(--sw-line)]">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-[var(--sw-ink)]">Patients</h2>
            <p className="text-[var(--sw-ink-2)]">Accès complet à tous les services, sans frais</p>
          </div>
          <div className="max-w-sm mx-auto relative rounded-2xl p-8 border-2 border-[var(--sw-success)] bg-[var(--sw-surface)] text-center space-y-5 shadow-lg shadow-[var(--sw-success)]/10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="bg-[var(--sw-success)] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow">
                100 % Gratuit
              </span>
            </div>
            <div>
              <p className="text-5xl font-bold text-[var(--sw-ink)]">0 FCFA</p>
              <p className="text-sm text-[var(--sw-ink-2)] mt-1">pour toujours</p>
            </div>
            <ul className="space-y-2 text-left">
              {[
                'Rendez-vous en ligne',
                'Ordonnances numériques',
                'Réservation de médicaments',
                'Suivi des prises en charge',
                'Espace famille',
                'Rappels et notifications',
              ].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-[var(--sw-ink-2)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)] shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/inscription?profil=patient">
              <Button className="w-full bg-[var(--sw-success)] hover:bg-[var(--sw-success)]/90 text-white font-semibold">
                Créer mon compte gratuit
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section Professionnels ── */}
      {santePlans.length > 0 && (
        <section className="py-16 px-4 sm:px-6 border-t border-[var(--sw-line)] bg-[var(--sw-surface-2)]">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-[var(--sw-ink)]">Professionnels & Établissements</h2>
              <p className="text-[var(--sw-ink-2)]">Gérez votre agenda, vos patients et vos ordonnances</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6 items-start pt-4">
              {santePlans.map(plan => (
                <PlanCard key={plan.id as string} plan={plan} />
              ))}
            </div>
            <p className="text-center text-sm text-[var(--sw-ink-3)]">
              Premier mois offert · Engagement mensuel · Annulation à tout moment
            </p>
          </div>
        </section>
      )}

      {/* ── Section Pharmacies ── */}
      {pharmaPlans.length > 0 && (
        <section className="py-16 px-4 sm:px-6 border-t border-[var(--sw-line)]">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-[var(--sw-ink)]">Pharmacies</h2>
              <p className="text-[var(--sw-ink-2)]">Gérez vos réservations et votre catalogue en ligne</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start pt-4">
              {pharmaPlans.map(plan => (
                <PlanCard key={plan.id as string} plan={plan} />
              ))}
            </div>
            <p className="text-center text-sm text-[var(--sw-ink-3)]">
              3 mois d'essai gratuit · Annulation à tout moment
            </p>
          </div>
        </section>
      )}

      {/* ── Section Mutuelles ── */}
      {coverturePlans.length > 0 && (
        <section className="py-16 px-4 sm:px-6 border-t border-[var(--sw-line)] bg-[var(--sw-surface-2)]">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-[var(--sw-ink)]">Mutuelles & Assurances</h2>
              <p className="text-[var(--sw-ink-2)]">Gérez vos adhérents et vos prises en charge</p>
            </div>
            <div className="flex flex-wrap justify-center gap-6 pt-4">
              {coverturePlans.map(plan => (
                <div key={plan.id as string} className="w-full sm:w-72">
                  <PlanCard plan={plan} />
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-[var(--sw-ink-3)]">
              Intégration en moins d'une semaine · Accompagnement inclus
            </p>
          </div>
        </section>
      )}

      {/* ── FAQ tarifaire ── */}
      <section className="py-16 px-4 sm:px-6 border-t border-[var(--sw-line)]">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-2xl font-bold text-[var(--sw-ink)] text-center">Questions fréquentes</h2>
          <div className="space-y-4">
            {[
              { q: 'Puis-je changer de plan en cours de route ?', a: 'Oui, vous pouvez passer à un plan supérieur ou inférieur à tout moment, sans frais de changement.' },
              { q: "Y a-t-il un engagement de durée ?", a: "Non. Tous les plans sont sans engagement. Vous pouvez résilier à tout moment depuis votre espace." },
              { q: 'Comment se passe la facturation ?', a: 'La facturation est mensuelle ou annuelle (avec 2 mois offerts). Paiement par Orange Money, Wave ou virement.' },
              { q: "L'essai gratuit nécessite-t-il une carte bancaire ?", a: "Non. Aucun moyen de paiement n'est demandé pendant la période d'essai." },
            ].map(({ q, a }) => (
              <div key={q} className="sw-card p-5 space-y-1.5">
                <p className="font-semibold text-[var(--sw-ink)] text-sm">{q}</p>
                <p className="text-sm text-[var(--sw-ink-2)]">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--sw-primary)]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <Zap className="w-10 h-10 text-white/60 mx-auto" />
          <h2 className="text-3xl font-bold text-white">Prêt à commencer ?</h2>
          <p className="text-white/80 text-lg">
            Créez votre compte et accédez immédiatement à tous les services Séné Wérr.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/inscription">
              <Button size="xl" className="bg-white text-[var(--sw-primary)] hover:bg-white/90 w-full sm:w-auto">
                Commencer gratuitement
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="xl" variant="ghost" className="text-white border-white/30 hover:bg-white/10 w-full sm:w-auto">
                Nous contacter
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
