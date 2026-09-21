/**
 * Widgets supplémentaires du dashboard praticien :
 *   - JaugePatients      : SVG radial gauge (arrivés / total)
 *   - DashboardTendances : Graphiques Semaine/Mois (Recharts)
 *   - ActionsRapides     : 4 CTA rapides
 *   - UsagePlan          : Jauges quotas RDV + crédits IA
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, FileText, Bell, BanknoteIcon, Calendar,
  ChevronRight, CreditCard, Zap, TrendingUp, ArrowUpRight,
} from 'lucide-react'
import { format, subDays, parseISO, startOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

// ── Couleurs établissements (6 teintes désaturées dérivées des tokens) ─────────
export const ETABLISSEMENT_COLORS = [
  'hsl(157 45% 40%)',  // vert primaire désaturé
  'hsl(199 50% 42%)',  // bleu secondaire désaturé
  'hsl(258 30% 52%)',  // violet accent désaturé
  'hsl(38 55% 48%)',   // ocre
  'hsl(10 45% 50%)',   // terracotta
  'hsl(180 35% 42%)',  // teal
]

// ── Jauge circulaire SVG ────────────────────────────────────────────────────────
export function JaugePatients({ arrives, total }: { arrives: number; total: number }) {
  const pct    = total > 0 ? Math.min(arrives / total, 1) : 0
  const r      = 36
  const cx     = 50
  const cy     = 50
  const circ   = 2 * Math.PI * r
  const dash   = pct * circ
  const gap    = circ - dash

  return (
    <Card className="flex flex-col items-center gap-s-3 p-s-4">
      <div className="flex items-start justify-between w-full">
        <p className="text-small font-medium text-ink-3">Patients attendus</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Calendar className="h-4 w-4" />
        </div>
      </div>

      <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
        {/* track */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--color-line, #e5e7eb)" strokeWidth={10} />
        {/* progress */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--color-primary, #1A7A4C)" strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>

      <div className="text-center -mt-s-4">
        <p className="text-h2 font-display font-bold text-ink leading-none">
          {arrives}<span className="text-ink-3 text-h4"> / {total}</span>
        </p>
        <p className="text-micro text-ink-3 mt-s-1">patients arrivés</p>
      </div>
    </Card>
  )
}

// ── KPI Ordonnances brouillon ──────────────────────────────────────────────────
export function KpiBrouillons({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Card className="flex flex-col gap-s-2 p-s-4 cursor-pointer group" onClick={onClick}>
      <div className="flex items-start justify-between">
        <p className="text-small font-medium text-ink-3">Ordonnances brouillon</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
          <FileText className="h-4 w-4" />
        </div>
      </div>
      <p className="text-h2 font-display font-bold text-ink leading-none">{count}</p>
      <div className="flex items-center gap-s-1 text-small text-accent group-hover:underline">
        <span>Voir les brouillons</span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </Card>
  )
}

// ── KPI Consultations en cours ─────────────────────────────────────────────────
export function KpiEnCours({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Card className="flex flex-col gap-s-2 p-s-4 cursor-pointer group" onClick={onClick}>
      <div className="flex items-start justify-between">
        <p className="text-small font-medium text-ink-3">En consultation</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary/10 text-secondary">
          <TrendingUp className="h-4 w-4" />
        </div>
      </div>
      <p className="text-h2 font-display font-bold text-ink leading-none">{count}</p>
      <div className="flex items-center gap-s-1 text-small text-secondary group-hover:underline">
        <span>{count > 0 ? 'Ouvrir la consultation' : 'Aucune en cours'}</span>
        {count > 0 && <ChevronRight className="h-4 w-4" />}
      </div>
    </Card>
  )
}

// ── Graphiques tendances ───────────────────────────────────────────────────────
interface SemaineDatum { jour: string; rdv: number; complete: number; noShow: number }
interface MoisDatum    { jour: string; consultations: number }
interface EtablissementDatum { nom: string; montant: number; color: string }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-s-3 py-s-2 shadow-lg text-small">
      <p className="font-medium text-ink mb-s-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-micro">
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export function DashboardTendances() {
  const { profile } = useAuth()
  const db = supabase as any

  const [vue, setVue]                 = useState<'semaine' | 'mois'>('semaine')
  const [loading, setLoading]         = useState(true)
  const [semaine, setSemaine]         = useState<SemaineDatum[]>([])
  const [mois, setMois]               = useState<MoisDatum[]>([])
  const [tauxNoShow, setTauxNoShow]   = useState(0)
  const [etablissements, setEtablissements] = useState<EtablissementDatum[]>([])
  const [revenusMois, setRevenusMois] = useState(0)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    const today  = new Date()
    const days7  = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i))
    const days30 = Array.from({ length: 30 }, (_, i) => subDays(today, 29 - i))

    // Données semaine (7 derniers jours)
    const { data: rdvSemaine } = await db.from('appointments')
      .select('starts_at, status')
      .eq('professional_id', profile.id)
      .gte('starts_at', subDays(today, 6).toISOString())
      .lte('starts_at', today.toISOString())

    const semaineMap: Record<string, SemaineDatum> = {}
    days7.forEach(d => {
      const k = format(d, 'yyyy-MM-dd')
      semaineMap[k] = { jour: format(d, 'EEE', { locale: fr }), rdv: 0, complete: 0, noShow: 0 }
    })
    ;(rdvSemaine ?? []).forEach((r: any) => {
      const k = r.starts_at.slice(0, 10)
      if (semaineMap[k]) {
        semaineMap[k].rdv++
        if (r.status === 'completed') semaineMap[k].complete++
        if (r.status === 'no_show')   semaineMap[k].noShow++
      }
    })
    setSemaine(Object.values(semaineMap))

    // Données mois (30 derniers jours)
    const { data: rdvMois } = await db.from('appointments')
      .select('starts_at, status')
      .eq('professional_id', profile.id)
      .gte('starts_at', subDays(today, 29).toISOString())
      .lte('starts_at', today.toISOString())

    const moisMap: Record<string, MoisDatum> = {}
    days30.forEach(d => {
      const k = format(d, 'yyyy-MM-dd')
      moisMap[k] = { jour: format(d, 'dd/MM'), consultations: 0 }
    })
    let totalMois = 0; let noShowMois = 0
    ;(rdvMois ?? []).forEach((r: any) => {
      const k = r.starts_at.slice(0, 10)
      if (moisMap[k] && r.status === 'completed') moisMap[k].consultations++
      totalMois++
      if (r.status === 'no_show') noShowMois++
    })
    setMois(Object.values(moisMap))
    setTauxNoShow(totalMois > 0 ? Math.round(noShowMois / totalMois * 100 * 10) / 10 : 0)

    // Revenus par établissement ce mois
    const debutMois = format(startOfMonth(today), 'yyyy-MM-dd')
    const { data: tps } = await db.from('tiers_payants')
      .select('montant_total, mutuelle:mutuelle_id ( nom )')
      .eq('praticien_id', profile.id)
      .gte('created_at', `${debutMois}T00:00:00`)
      .in('statut', ['valide', 'regle'])

    const { data: paiements } = await db.from('paiements')
      .select('montant, etablissement_id, etablissement:etablissement_id ( nom )')
      .eq('praticien_id', profile.id)
      .gte('created_at', `${debutMois}T00:00:00`)

    const etabMap: Record<string, number> = {}
    let totalRev = 0
    ;(paiements ?? []).forEach((p: any, i: number) => {
      const nom = p.etablissement?.nom ?? 'Cabinet'
      etabMap[nom] = (etabMap[nom] ?? 0) + (p.montant ?? 0)
      totalRev += p.montant ?? 0
    })
    setRevenusMois(totalRev)
    setEtablissements(Object.entries(etabMap).map(([nom, montant], i) => ({
      nom, montant, color: ETABLISSEMENT_COLORS[i % ETABLISSEMENT_COLORS.length],
    })))

    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />

  return (
    <Card className="p-s-4 flex flex-col gap-s-4">
      <div className="flex items-center justify-between">
        <h2 className="text-body font-semibold text-ink">Tendances</h2>
        <div className="flex rounded-lg border border-line overflow-hidden">
          {(['semaine', 'mois'] as const).map(v => (
            <button key={v} onClick={() => setVue(v)}
              className={cn(
                'px-s-3 py-s-1.5 text-micro font-medium capitalize transition-colors',
                vue === v ? 'bg-primary text-white' : 'text-ink-3 hover:bg-surface-2',
              )}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {vue === 'semaine' ? (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={semaine} barCategoryGap="30%" margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="jour" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="rdv"      name="RDV"     fill="var(--color-primary, #1A7A4C)" radius={[4,4,0,0]} />
            <Bar dataKey="complete" name="Terminés" fill="var(--color-secondary, #0EA5E9)" radius={[4,4,0,0]} />
            <Bar dataKey="noShow"   name="Absents"  fill="var(--color-danger, #EF4444)"  radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col gap-s-4">
          {/* Courbe consultations */}
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={mois} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="jour" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                interval={Math.floor(mois.length / 6)} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line dataKey="consultations" name="Consultations" type="monotone"
                stroke="var(--color-primary, #1A7A4C)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>

          {/* Taux no-show + Revenus */}
          <div className="grid grid-cols-2 gap-s-3">
            {/* Taux no-show */}
            <div className="flex flex-col items-center gap-s-1 rounded-lg border border-line p-s-3">
              <p className="text-micro text-ink-3">Taux de no-show</p>
              <p className={cn(
                'text-h3 font-display font-bold leading-none',
                tauxNoShow > 15 ? 'text-danger' : 'text-ink',
              )}>
                {tauxNoShow}%
              </p>
              {tauxNoShow > 15 && (
                <p className="text-micro text-danger text-center">Au-dessus du seuil (15%)</p>
              )}
            </div>

            {/* Revenus par établissement ou total */}
            <div className="flex flex-col gap-s-1 rounded-lg border border-line p-s-3">
              <p className="text-micro text-ink-3">Revenus ce mois</p>
              <p className="text-h4 font-display font-bold text-ink leading-none">
                {revenusMois.toLocaleString('fr-FR')} FCFA
              </p>
              {etablissements.length > 1 ? (
                <div className="mt-s-1">
                  <ResponsiveContainer width="100%" height={60}>
                    <PieChart>
                      <Pie data={etablissements} cx="50%" cy="50%" outerRadius={28}
                        dataKey="montant" nameKey="nom" isAnimationActive={false}>
                        {etablissements.map((e, i) => (
                          <Cell key={i} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString('fr-FR')} FCFA`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center gap-s-1 text-micro text-success">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>{etablissements[0]?.nom ?? 'Cabinet principal'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Actions rapides ────────────────────────────────────────────────────────────
export function ActionsRapides() {
  const navigate = useNavigate()

  const actions = [
    {
      label:   '+ Ajouter un créneau',
      icon:    <Calendar className="h-5 w-5" />,
      color:   'text-primary bg-primary/10 hover:bg-primary/20',
      onClick: () => navigate('/pro/agenda'),
    },
    {
      label:   '+ Ajouter une absence',
      icon:    <BanknoteIcon className="h-5 w-5" />,
      color:   'text-accent bg-accent/10 hover:bg-accent/20',
      onClick: () => navigate('/pro/agenda?action=absence'),
    },
    {
      label:   '+ Nouvelle ordonnance',
      icon:    <FileText className="h-5 w-5" />,
      color:   'text-secondary bg-secondary/10 hover:bg-secondary/20',
      onClick: () => navigate('/pro/ordonnances/nouvelle'),
    },
    {
      label:   'Notifications',
      icon:    <Bell className="h-5 w-5" />,
      color:   'text-ink-3 bg-surface-2 hover:bg-line',
      onClick: () => navigate('/pro/notifications'),
    },
  ]

  return (
    <Card className="p-s-4">
      <h2 className="mb-s-3 text-body font-semibold text-ink">Actions rapides</h2>
      <div className="grid grid-cols-2 gap-s-2 sm:grid-cols-4">
        {actions.map(a => (
          <button key={a.label} onClick={a.onClick}
            className={cn(
              'flex flex-col items-center gap-s-2 rounded-xl p-s-3 transition-colors text-center',
              a.color,
            )}>
            {a.icon}
            <span className="text-micro font-medium leading-tight">{a.label}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}

// ── Usage du plan ──────────────────────────────────────────────────────────────
interface UsagePlanData {
  rdv_utilises: number
  rdv_limite: number
  credits_utilises: number
  credits_limite: number
  plan_nom: string
}

export function UsagePlan() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const db = supabase as any

  const [data, setData]       = useState<UsagePlanData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    ;(async () => {
      // Quotas depuis le profil abonnement
      const { data: sub } = await db.from('subscriptions')
        .select('plan_nom, rdv_limite, credits_ia_limite, rdv_utilises_mois, credits_ia_utilises')
        .eq('user_id', profile.id)
        .eq('statut', 'active')
        .maybeSingle()

      if (sub) {
        setData({
          rdv_utilises:      sub.rdv_utilises_mois ?? 0,
          rdv_limite:        sub.rdv_limite ?? 50,
          credits_utilises:  sub.credits_ia_utilises ?? 0,
          credits_limite:    sub.credits_ia_limite ?? 200,
          plan_nom:          sub.plan_nom ?? 'Solo+',
        })
      } else {
        // Fallback valeurs par défaut
        setData({ rdv_utilises: 0, rdv_limite: 50, credits_utilises: 0, credits_limite: 200, plan_nom: 'Gratuit' })
      }
      setLoading(false)
    })()
  }, [profile?.id])

  if (loading) return <Skeleton className="h-28 w-full rounded-xl" />
  if (!data) return null

  const rdvPct     = Math.min(data.rdv_utilises / data.rdv_limite, 1)
  const creditsPct = Math.min(data.credits_utilises / data.credits_limite, 1)
  const rdvRestants     = data.rdv_limite - data.rdv_utilises
  const creditsRestants = data.credits_limite - data.credits_utilises
  const rdvProche     = rdvPct >= 0.8
  const creditsProche = creditsPct >= 0.8

  return (
    <Card className="p-s-4 flex flex-col gap-s-4">
      <div className="flex items-center justify-between">
        <h2 className="text-body font-semibold text-ink">Usage du plan <span className="ml-s-1 text-small text-ink-3 font-normal">{data.plan_nom}</span></h2>
        <button onClick={() => navigate('/pro/abonnement')}
          className="text-micro text-primary hover:underline flex items-center gap-s-1">
          Gérer <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* RDV/mois */}
      <div className="flex flex-col gap-s-1.5">
        <div className="flex items-center justify-between text-small">
          <span className="flex items-center gap-s-1 text-ink-3">
            <Calendar className="h-4 w-4" /> RDV ce mois
          </span>
          <span className={cn('font-medium', rdvProche ? 'text-danger' : 'text-ink')}>
            {data.rdv_utilises} / {data.rdv_limite} RDV
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-line overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              rdvProche ? 'bg-danger' : 'bg-primary',
            )}
            style={{ width: `${rdvPct * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-micro text-ink-3">
          <span>{rdvRestants} RDV restants ce mois</span>
          {rdvProche && (
            <button onClick={() => navigate('/pro/abonnement')}
              className="text-primary hover:underline font-medium">Passer au plan supérieur →</button>
          )}
        </div>
      </div>

      {/* Crédits IA */}
      <div className="flex flex-col gap-s-1.5">
        <div className="flex items-center justify-between text-small">
          <span className="flex items-center gap-s-1 text-ink-3">
            <Zap className="h-4 w-4" /> Crédits IA
          </span>
          <span className={cn('font-medium', creditsProche ? 'text-danger' : 'text-ink')}>
            {data.credits_utilises} / {data.credits_limite} crédits
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-line overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              creditsProche ? 'bg-danger' : 'bg-accent',
            )}
            style={{ width: `${creditsPct * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-micro text-ink-3">
          <span>{creditsRestants} crédits restants</span>
          {creditsProche && (
            <button onClick={() => navigate('/pro/abonnement')}
              className="text-primary hover:underline font-medium">Acheter des crédits →</button>
          )}
        </div>
      </div>
    </Card>
  )
}
