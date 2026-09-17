import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronUp, Zap, Building2, Pill, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'

interface PlanFeature { feature_key: string; value: string }
interface Plan {
  id: string
  code: string
  name: string
  actor_type: string
  monthly_price: number
  yearly_price: number
  trial_days: number
  included_ai_credits: number
  transaction_fee_percent: number
  is_recommended?: boolean
  plan_features?: PlanFeature[]
}

const RECOMMENDED: Record<string, string> = {
  professional: 'pro_solo',
  establishment: 'est_cabinet',
  pharmacy: 'pharmacy_start',
  insurance_provider: 'mutual_pro',
}

const TABS = [
  { key: 'professional',       label: 'Professionnels', icon: Zap },
  { key: 'establishment',      label: 'Établissements', icon: Building2 },
  { key: 'pharmacy',           label: 'Pharmacies',     icon: Pill },
  { key: 'insurance_provider', label: 'Mutuelles',      icon: Shield },
]

const FAQ = [
  { q: 'Le patient paie-t-il des frais à MediKool ?', a: "Non, jamais. MediKool est 100% gratuit pour les patients. Seuls les frais du prestataire de paiement peuvent s'appliquer selon votre moyen de paiement, et ils sont absorbés par MediKool." },
  { q: 'Puis-je changer de plan à tout moment ?', a: "Oui. Un upgrade est effectif immédiatement avec proratisation. Un downgrade s'applique en fin de période en cours, avec un message si vos quotas actuels dépassent le nouveau plan." },
  { q: "Que se passe-t-il à la fin de l'essai gratuit ?", a: "Pour les établissements et mutuelles (14 jours d'essai), sans souscription votre compte passe en lecture seule avec un bandeau explicatif. Vos données sont conservées." },
  { q: 'Les crédits IA non utilisés sont-ils reportés ?', a: "Les crédits de plan se réinitialisent chaque mois. Les crédits achetés séparément (packs) n'expirent jamais et sont consommés après les crédits de plan." },
  { q: 'Comment fonctionne la commission sur les pharmacies ?', a: "La commission varie selon le plan pharmacie (de 2% à 7%, plafonnée à 5 000 FCFA par réservation). Elle est calculée sur le montant total retiré. Le plan Découverte applique 7%, le plan Premium 2%." },
]

function getFeatures(plan: Plan): string[] {
  const features = plan.plan_features ?? []
  const get = (key: string) => features.find(f => f.feature_key === key)?.value
  const lines: string[] = []

  if (plan.actor_type === 'professional') {
    const appts = get('appointments_monthly')
    lines.push(appts === 'unlimited' ? 'Rendez-vous illimités' : `${appts} rendez-vous/mois`)
    const estabs = get('max_establishments')
    lines.push(estabs === 'unlimited' ? 'Établissements illimités' : `${estabs} établissement${estabs !== '1' ? 's' : ''}`)
    const assistants = get('assistants_included')
    if (assistants && assistants !== '0') lines.push(`${assistants} assistant(s) inclus`)
    if (get('ai_enabled') === 'true') lines.push(`${plan.included_ai_credits} crédits IA/mois`)
    if (get('transcription') === 'true') lines.push('Transcription audio IA')
    if (get('multi_establishment') === 'true') lines.push('Agenda multi-établissements')
    if (get('advanced_stats') === 'true') lines.push('Statistiques avancées')
    if (get('priority_support') === 'true') lines.push('Support prioritaire')
  }

  if (plan.actor_type === 'establishment') {
    const pros = get('max_professionals')
    lines.push(pros === 'unlimited' ? 'Professionnels illimités' : `${pros} professionnels`)
    const users = get('max_users')
    lines.push(users === 'unlimited' ? 'Secrétaires illimitées' : `${users} secrétaire(s)`)
    if (plan.included_ai_credits > 0) lines.push(`${plan.included_ai_credits} crédits IA/mois`)
    lines.push('Gestion des plannings')
    lines.push('Notifications automatiques')
  }

  if (plan.actor_type === 'pharmacy') {
    if (plan.transaction_fee_percent > 0) lines.push(`Commission ${plan.transaction_fee_percent}% (plafond 5 000 FCFA)`)
    else lines.push('0% de commission')
    const users = get('max_users')
    lines.push(users === 'unlimited' ? 'Utilisateurs illimités' : `${users} utilisateur(s)`)
    if (plan.included_ai_credits > 0) lines.push(`${plan.included_ai_credits} crédits IA/mois`)
    lines.push('Réservations en ligne')
    lines.push('Gestion des ordonnances')
  }

  if (plan.actor_type === 'insurance_provider') {
    const members = get('max_members')
    lines.push(members === 'unlimited' ? 'Assurés illimités' : `Jusqu'à ${Number(members).toLocaleString('fr-FR')} assurés`)
    const users = get('max_users')
    lines.push(users === 'unlimited' ? 'Utilisateurs illimités' : `${users} utilisateurs`)
    if (plan.included_ai_credits > 0) lines.push(`${plan.included_ai_credits} crédits IA/mois`)
    lines.push('Validation des demandes PEC')
    lines.push('Dashboard et statistiques')
  }

  return lines
}

function PlanCard({ plan, billingInterval }: { plan: Plan; billingInterval: 'monthly' | 'annual' }) {
  const recommended = RECOMMENDED[plan.actor_type] === plan.code
  const monthlyPrice = billingInterval === 'annual' ? Math.round(plan.yearly_price / 12) : plan.monthly_price

  return (
    <div className={`relative p-s-5 flex flex-col gap-s-4 border-2 rounded-md bg-surface ${recommended ? 'border-primary' : 'border-line'}`}>
      {recommended && <Badge variant="primary" className="self-start">Recommandé</Badge>}
      <div>
        <p className="text-h3 font-display font-semibold text-ink">{plan.name}</p>
        <div className="mt-s-2 flex items-end gap-s-1">
          {plan.monthly_price === 0
            ? <p className="text-h1 font-display font-bold text-ink">Gratuit</p>
            : <>
                <p className="text-h1 font-display font-bold text-ink">{monthlyPrice.toLocaleString('fr-FR')}</p>
                <p className="text-body text-ink-3 mb-s-1">FCFA/mois</p>
              </>
          }
        </div>
        {billingInterval === 'annual' && plan.yearly_price > 0 && (
          <p className="text-small text-status-success">2 mois offerts ({plan.yearly_price.toLocaleString('fr-FR')} FCFA/an)</p>
        )}
        {plan.trial_days > 0 && (
          <p className="text-small text-accent">{plan.trial_days} jours d'essai gratuit</p>
        )}
      </div>

      <ul className="flex flex-col gap-s-2">
        {getFeatures(plan).map(f => (
          <li key={f} className="flex items-start gap-s-2 text-small text-ink-2">
            <Check className="w-4 h-4 text-status-success mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        {plan.monthly_price === 0
          ? <Button variant="secondary" className="w-full" asChild><Link to="/auth/inscription">Commencer gratuitement</Link></Button>
          : <Button variant={recommended ? 'primary' : 'secondary'} className="w-full" asChild>
              <Link to={`/auth/inscription?plan=${plan.code}&interval=${billingInterval}`}>
                {plan.trial_days > 0 ? "Commencer l'essai" : 'Choisir ce plan'}
              </Link>
            </Button>
        }
      </div>
    </div>
  )
}

export default function PricingPage() {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly')
  const [activeTab, setActiveTab] = useState('professional')
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  useEffect(() => {
    async function fetchPlans() {
      const { data } = await supabase
        .from('subscription_plans')
        .select('*, plan_features(*)')
        .eq('public', true)
        .order('monthly_price')
      if (data) setPlans(data as Plan[])
      setLoading(false)
    }
    fetchPlans()
  }, [])

  const tabPlans = plans.filter(p => p.actor_type === activeTab)

  return (
    <div className="min-h-screen bg-surface">
      {/* Hero */}
      <section className="py-s-6 px-s-4 text-center flex flex-col items-center gap-s-4">
        <span className="inline-flex items-center gap-s-2 rounded-pill bg-accent/10 px-s-3 py-s-1 text-small font-semibold text-accent">
          <Check className="w-4 h-4" /> Le patient, c'est gratuit
        </span>
        <h1 className="font-display text-display font-bold text-ink max-w-2xl">
          Des tarifs simples, transparents
        </h1>
        <p className="text-body text-ink-2 max-w-xl">
          Un plan pour chaque acteur de santé. Pas de frais cachés, pas d'engagement minimum.
        </p>

        {/* Billing toggle */}
        <div className="flex items-center gap-s-3 justify-center mt-s-2">
          <button onClick={() => setBillingInterval('monthly')} className={`text-small font-medium transition-colors ${billingInterval === 'monthly' ? 'text-ink' : 'text-ink-3'}`}>
            Mensuel
          </button>
          <button
            onClick={() => setBillingInterval(p => p === 'monthly' ? 'annual' : 'monthly')}
            className="relative w-12 h-6 rounded-pill bg-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Basculer facturation annuelle"
          >
            <span className={`absolute top-1 w-4 h-4 rounded-pill bg-white transition-transform ${billingInterval === 'annual' ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
          <button onClick={() => setBillingInterval('annual')} className={`flex items-center gap-s-1 text-small font-medium transition-colors ${billingInterval === 'annual' ? 'text-ink' : 'text-ink-3'}`}>
            Annuel <Badge variant="success" className="ml-s-1">2 mois offerts</Badge>
          </button>
        </div>
      </section>

      {/* Tabs */}
      <div className="px-s-4 flex justify-center">
        <div className="flex gap-s-2 bg-surface-2 p-s-1 rounded-md overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-s-2 px-s-4 py-s-2 rounded-md text-small font-medium whitespace-nowrap transition-colors ${activeTab === key ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <section className="px-s-4 py-s-5 max-w-6xl mx-auto">
        {loading
          ? <div className="flex justify-center py-s-6"><Spinner /></div>
          : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-s-4">
              {tabPlans.map(plan => (
                <PlanCard key={plan.id} plan={plan} billingInterval={billingInterval} />
              ))}
            </div>
        }
      </section>

      {/* FAQ */}
      <section className="px-s-4 py-s-5 max-w-3xl mx-auto">
        <h2 className="font-display text-h2 font-semibold text-ink text-center mb-s-5">Questions fréquentes</h2>
        <div className="flex flex-col gap-s-2">
          {FAQ.map((item, i) => (
            <div key={i} className="border border-line rounded-md bg-surface overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-s-4 text-left text-body font-medium text-ink hover:bg-surface-2 transition-colors"
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
              >
                <span>{item.q}</span>
                {faqOpen === i ? <ChevronUp className="w-5 h-5 text-ink-3 shrink-0" /> : <ChevronDown className="w-5 h-5 text-ink-3 shrink-0" />}
              </button>
              {faqOpen === i && (
                <div className="px-s-4 pb-s-4 text-small text-ink-2 border-t border-line pt-s-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
