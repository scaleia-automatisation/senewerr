import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, CreditCard, AlertCircle, Clock, TrendingUp, BarChart2,
  Bell, FileText, Plus, CheckSquare, Download, ChevronDown,
  Send, Stethoscope, RefreshCw, Zap, X, ChevronRight,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useMutuelle } from './MutuelleContext'
import { StatCard } from '@/components/mutuelle/StatCard'
import { EmptyState } from '@/components/mutuelle/EmptyState'
import { Button } from '@/components/ui/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Kpis {
  adherentsActifs: number
  cotisationsTotal: number
  cotisationsTrend: number | null
  cotisationsRetard: number
  demandesEnAttente: number
  demandesEnAttenteTrend: number | null
  montantRembourse: number
  montantRembourseTrend: number | null
  tauxRemboursement: number
  tauxRemboursementTrend: number | null
}

interface Impaye {
  contratId: string
  adherentId: string
  adherentNom: string
  montantDu: number
  derniereDate: string
}

interface DemandeUrgente {
  id: string
  reference: string
  adherentNom: string
  montant: number
  createdAt: string
}

interface ContratExpirant {
  contratId: string
  adherentId: string
  adherentNom: string
  numeroContrat: string
  dateFin: string
}

interface Alertes {
  impayes: Impaye[]
  demandesUrgentes: DemandeUrgente[]
  contratsExpirant: ContratExpirant[]
}

interface DepenseSlice { name: string; value: number }

interface TopPraticien {
  praticien_id: string
  nom: string
  specialite: string
  nb_demandes: number
  montant_total: number
}

type ActivityType = 'nouvelle_demande' | 'remboursement_approuve' | 'remboursement_refuse' | 'nouveau_contrat' | 'cotisation_recue' | 'tiers_payant'
type ActivityFilter = 'tout' | 'demandes' | 'cotisations' | 'contrats'

interface ActivityItem {
  id: string
  type: ActivityType
  label: string
  time: string
  meta?: string
  href?: string
}

type PeriodDepenses = '1m' | '3m' | '6m' | '1y'

// ── Constants ─────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

const CAT_LABELS: Record<string, string> = {
  consultations: 'Consultations',
  medicaments: 'Médicaments',
  hospitalisations: 'Hospitalisations',
  analyses: 'Analyses',
  autres: 'Autres',
}

const ACTIVITY_TYPE_CONFIG: Record<ActivityType, { label: string; color: string; icon: React.ReactNode }> = {
  nouvelle_demande:       { label: 'Nouvelle demande',    color: 'bg-blue-100 text-blue-700',   icon: <FileText className="h-4 w-4" /> },
  remboursement_approuve: { label: 'Remboursement approuvé', color: 'bg-emerald-100 text-emerald-700', icon: <CheckSquare className="h-4 w-4" /> },
  remboursement_refuse:   { label: 'Remboursement refusé', color: 'bg-red-100 text-red-700',   icon: <X className="h-4 w-4" /> },
  nouveau_contrat:        { label: 'Nouveau contrat',     color: 'bg-violet-100 text-violet-700', icon: <FileText className="h-4 w-4" /> },
  cotisation_recue:       { label: 'Cotisation reçue',    color: 'bg-amber-100 text-amber-700', icon: <CreditCard className="h-4 w-4" /> },
  tiers_payant:           { label: 'Tiers payant',        color: 'bg-sky-100 text-sky-700',     icon: <RefreshCw className="h-4 w-4" /> },
}

const FILTER_LABELS: Record<ActivityFilter, string> = {
  tout: 'Tout', demandes: 'Demandes', cotisations: 'Cotisations', contrats: 'Contrats',
}

function formatFCFA(n: number): string {
  return new Intl.NumberFormat('fr-SN').format(n) + ' FCFA'
}

// ── Edge function helper ───────────────────────────────────────────────────────

async function callEF<T>(name: string, body?: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, body ? { body } : {})
  if (error) throw error
  return data?.data ?? data
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function AlerteSection({
  titre,
  count,
  color,
  children,
}: {
  titre: string
  count: number
  color: 'red' | 'orange' | 'yellow'
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  const bg = color === 'red' ? 'bg-red-50 border-red-200' : color === 'orange' ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'
  const badge = color === 'red' ? 'bg-red-100 text-red-700' : color === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'

  return (
    <div className={`rounded-xl border p-s-4 ${bg}`}>
      <button
        className="flex w-full items-center justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-s-2">
          <span className="font-semibold text-ink">{titre}</span>
          {count > 0 && (
            <span className={`rounded-full px-s-2 py-0.5 text-micro font-bold ${badge}`}>
              {count}
            </span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-s-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="rounded-lg border border-line bg-surface px-s-3 py-s-2 shadow-lg">
      <p className="font-semibold text-ink">{CAT_LABELS[name] ?? name}</p>
      <p className="text-small text-ink-2">{formatFCFA(value)}</p>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function MutuelleHomePage() {
  const { mutuelle } = useMutuelle()
  const navigate = useNavigate()
  const db = supabase as any

  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [alertes, setAlertes] = useState<Alertes | null>(null)
  const [depenses, setDepenses] = useState<DepenseSlice[]>([])
  const [topPraticiens, setTopPraticiens] = useState<TopPraticien[]>([])
  const [activite, setActivite] = useState<ActivityItem[]>([])
  const [loadingKpis, setLoadingKpis] = useState(true)
  const [loadingActivite, setLoadingActivite] = useState(true)
  const [periodDepenses, setPeriodDepenses] = useState<PeriodDepenses>('1m')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('tout')
  const [fabOpen, setFabOpen] = useState(false)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const fabRef = useRef<HTMLDivElement>(null)

  // Fermer FAB au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) setFabOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Charger KPIs via Edge Function
  const loadKpis = useCallback(async () => {
    setLoadingKpis(true)
    try {
      const result = await callEF<{ kpis: Kpis; alertes: Alertes; depenses: DepenseSlice[]; topPraticiens: TopPraticien[] }>('get-mutuelle-kpis')
      setKpis(result.kpis)
      setAlertes(result.alertes)
      setDepenses(result.depenses ?? [])
      setTopPraticiens(result.topPraticiens ?? [])
    } catch (err) {
      console.error('get-mutuelle-kpis error', err)
      toast.error('Impossible de charger les indicateurs')
    } finally {
      setLoadingKpis(false)
    }
  }, [])

  // Charger activité récente
  const loadActivite = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingActivite(true)
    try {
      // Demandes récentes
      const { data: demandes } = await db
        .from('remboursement_demandes')
        .select('id, reference, statut, montant_demande, created_at, profiles!remboursement_demandes_adherent_id_fkey(full_name)')
        .eq('mutuelle_id', mutuelle.id)
        .order('created_at', { ascending: false })
        .limit(7)

      // Cotisations récentes
      const { data: cotisations } = await db
        .from('cotisations')
        .select('id, montant, created_at, profiles!cotisations_adherent_id_fkey(full_name)')
        .eq('mutuelle_id', mutuelle.id)
        .order('created_at', { ascending: false })
        .limit(7)

      // Contrats récents
      const { data: contrats } = await db
        .from('contrats')
        .select('id, numero_contrat, created_at, profiles!contrats_adherent_id_fkey(full_name)')
        .eq('mutuelle_id', mutuelle.id)
        .order('created_at', { ascending: false })
        .limit(6)

      const items: ActivityItem[] = []

      for (const d of demandes ?? []) {
        const type: ActivityType = d.statut === 'approuve' ? 'remboursement_approuve' : d.statut === 'refuse' ? 'remboursement_refuse' : 'nouvelle_demande'
        items.push({
          id: 'demande-' + d.id,
          type,
          label: (d.profiles?.full_name ?? 'Adhérent') + ' — ' + formatFCFA(d.montant_demande ?? 0),
          time: d.created_at,
          meta: d.reference,
          href: `/mutuelle/demandes`,
        })
      }
      for (const c of cotisations ?? []) {
        items.push({
          id: 'cot-' + c.id,
          type: 'cotisation_recue',
          label: (c.profiles?.full_name ?? 'Adhérent') + ' — ' + formatFCFA(c.montant ?? 0),
          time: c.created_at,
        })
      }
      for (const c of contrats ?? []) {
        items.push({
          id: 'contrat-' + c.id,
          type: 'nouveau_contrat',
          label: (c.profiles?.full_name ?? 'Adhérent') + ' — ' + (c.numero_contrat ?? ''),
          time: c.created_at,
          href: `/mutuelle/contrats`,
        })
      }

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setActivite(items.slice(0, 20))
    } catch (err) {
      console.error('activite error', err)
    } finally {
      setLoadingActivite(false)
    }
  }, [mutuelle?.id])

  useEffect(() => { loadKpis() }, [loadKpis])
  useEffect(() => { loadActivite() }, [loadActivite])

  // Realtime: écouter nouvelles demandes + cotisations
  useEffect(() => {
    if (!mutuelle?.id) return
    const ch = supabase.channel('mutuelle-home-' + mutuelle.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'remboursement_demandes',
        filter: `mutuelle_id=eq.${mutuelle.id}`,
      }, () => {
        loadKpis()
        loadActivite()
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'cotisations',
        filter: `mutuelle_id=eq.${mutuelle.id}`,
      }, () => {
        loadKpis()
        loadActivite()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [mutuelle?.id, loadKpis, loadActivite])

  // Envoyer rappel
  async function handleRappel(type: 'cotisation_rappel' | 'renouvellement', ids: string[]) {
    setSendingReminder(type + ids.join())
    try {
      await callEF('send-mutuelle-reminder', { type, contratIds: ids })
      toast.success('Rappel envoyé avec succès')
    } catch {
      toast.error('Erreur lors de l\'envoi du rappel')
    } finally {
      setSendingReminder(null)
    }
  }

  // Filtrer activité
  const activiteFiltree = activite.filter(a => {
    if (activityFilter === 'tout') return true
    if (activityFilter === 'demandes') return ['nouvelle_demande', 'remboursement_approuve', 'remboursement_refuse'].includes(a.type)
    if (activityFilter === 'cotisations') return a.type === 'cotisation_recue'
    if (activityFilter === 'contrats') return ['nouveau_contrat'].includes(a.type)
    return true
  })

  // Couleurs selon période (placeholder — en prod: refetch avec la période)
  const depensesLabeled = depenses.map(d => ({ ...d, displayName: CAT_LABELS[d.name] ?? d.name }))

  return (
    <div className="space-y-s-6 p-s-4 md:p-s-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-h1 font-semibold text-ink">
            {mutuelle?.nom ?? 'Tableau de bord'}
          </h1>
          <p className="text-small text-ink-3">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={() => { loadKpis(); loadActivite() }}
        >
          Actualiser
        </Button>
      </div>

      {/* ── KPIs ── */}
      <section>
        <div className="grid grid-cols-2 gap-s-3 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            loading={loadingKpis}
            value={kpis?.adherentsActifs ?? 0}
            label="Adhérents actifs"
            icon={<Users className="h-5 w-5" />}
            color="primary"
          />
          <StatCard
            loading={loadingKpis}
            value={kpis ? formatFCFA(kpis.cotisationsTotal) : '—'}
            label="Cotisations ce mois"
            icon={<CreditCard className="h-5 w-5" />}
            color="success"
            trend={kpis?.cotisationsTrend ?? undefined}
          />
          <StatCard
            loading={loadingKpis}
            value={kpis?.cotisationsRetard ?? 0}
            label="Retards > 30j"
            icon={<AlertCircle className="h-5 w-5" />}
            color={(kpis?.cotisationsRetard ?? 0) > 0 ? 'danger' : 'neutral'}
          />
          <div
            className="cursor-pointer"
            onClick={() => navigate('/mutuelle/demandes')}
            title="Voir les demandes en attente"
          >
            <StatCard
              loading={loadingKpis}
              value={kpis?.demandesEnAttente ?? 0}
              label="Demandes en attente"
              icon={<Clock className="h-5 w-5" />}
              color={(kpis?.demandesEnAttente ?? 0) > 0 ? 'warning' : 'neutral'}
              trend={kpis?.demandesEnAttenteTrend ?? undefined}
            />
          </div>
          <StatCard
            loading={loadingKpis}
            value={kpis ? formatFCFA(kpis.montantRembourse) : '—'}
            label="Remboursé ce mois"
            icon={<TrendingUp className="h-5 w-5" />}
            color="primary"
            trend={kpis?.montantRembourseTrend ?? undefined}
          />
          <StatCard
            loading={loadingKpis}
            value={kpis ? `${kpis.tauxRemboursement}%` : '—'}
            label="Taux remboursement"
            icon={<BarChart2 className="h-5 w-5" />}
            color="success"
            trend={kpis?.tauxRemboursementTrend ?? undefined}
          />
        </div>
      </section>

      {/* ── Alertes + Activité (2 colonnes) ── */}
      <div className="grid grid-cols-1 gap-s-6 lg:grid-cols-2">

        {/* Alertes prioritaires */}
        <section className="space-y-s-3">
          <h2 className="font-semibold text-ink">Alertes prioritaires</h2>

          {/* Cotisations impayées > 60j */}
          <AlerteSection
            titre="Cotisations impayées > 60 jours"
            count={alertes?.impayes.length ?? 0}
            color="red"
          >
            {alertes?.impayes.length === 0 ? (
              <p className="text-small text-ink-3">Aucune impayée — tout est à jour ✓</p>
            ) : (
              <div className="space-y-s-2">
                {alertes!.impayes.map(i => (
                  <div key={i.contratId} className="flex items-center justify-between rounded-lg bg-white/60 px-s-3 py-s-2">
                    <div>
                      <p className="text-small font-medium text-ink">{i.adherentNom}</p>
                      <p className="text-micro text-ink-3">{formatFCFA(i.montantDu)} dû</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Send className="h-3.5 w-3.5" />}
                      loading={sendingReminder === 'cotisation_rappel' + i.contratId}
                      onClick={() => handleRappel('cotisation_rappel', [i.contratId])}
                    >
                      Rappel
                    </Button>
                  </div>
                ))}
                {(alertes?.impayes.length ?? 0) > 1 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => handleRappel('cotisation_rappel', alertes!.impayes.map(i => i.contratId))}
                    loading={sendingReminder === 'cotisation_rappel' + alertes!.impayes.map(i => i.contratId).join()}
                  >
                    Envoyer rappel à tous ({alertes!.impayes.length})
                  </Button>
                )}
              </div>
            )}
          </AlerteSection>

          {/* Demandes > 72h */}
          <AlerteSection
            titre="Demandes non traitées > 72h"
            count={alertes?.demandesUrgentes.length ?? 0}
            color="orange"
          >
            {alertes?.demandesUrgentes.length === 0 ? (
              <p className="text-small text-ink-3">Aucune demande en retard</p>
            ) : (
              <div className="space-y-s-2">
                {alertes!.demandesUrgentes.map(d => (
                  <Link
                    key={d.id}
                    to="/mutuelle/demandes"
                    className="flex items-center justify-between rounded-lg bg-white/60 px-s-3 py-s-2 transition-colors hover:bg-white"
                  >
                    <div>
                      <p className="text-small font-medium text-ink">{d.adherentNom}</p>
                      <p className="text-micro text-ink-3">
                        {d.reference} · {formatFCFA(d.montant)} · soumise {formatDistanceToNow(new Date(d.createdAt), { locale: fr, addSuffix: true })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-3" />
                  </Link>
                ))}
              </div>
            )}
          </AlerteSection>

          {/* Contrats expirant dans 30j */}
          <AlerteSection
            titre="Contrats expirant dans 30 jours"
            count={alertes?.contratsExpirant.length ?? 0}
            color="yellow"
          >
            {alertes?.contratsExpirant.length === 0 ? (
              <p className="text-small text-ink-3">Aucun contrat en expiration imminente</p>
            ) : (
              <div className="space-y-s-2">
                {alertes!.contratsExpirant.map(c => (
                  <div key={c.contratId} className="flex items-center justify-between rounded-lg bg-white/60 px-s-3 py-s-2">
                    <div>
                      <p className="text-small font-medium text-ink">{c.adherentNom}</p>
                      <p className="text-micro text-ink-3">
                        {c.numeroContrat} · expire le {format(new Date(c.dateFin), 'd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Bell className="h-3.5 w-3.5" />}
                      loading={sendingReminder === 'renouvellement' + c.contratId}
                      onClick={() => handleRappel('renouvellement', [c.contratId])}
                    >
                      Notifier
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </AlerteSection>
        </section>

        {/* Activité récente */}
        <section>
          <div className="mb-s-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink">Activité récente</h2>
            <div className="flex gap-s-1 rounded-lg bg-surface-2 p-s-1">
              {(Object.keys(FILTER_LABELS) as ActivityFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setActivityFilter(f)}
                  className={`rounded-md px-s-2 py-s-1 text-micro font-medium transition-colors ${
                    activityFilter === f ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface">
            {loadingActivite ? (
              <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-s-3 border-b border-line px-s-4 py-s-3 last:border-0">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-surface-2 animate-pulse" />
                    <div className="flex-1 space-y-s-1">
                      <div className="h-3 w-3/4 rounded bg-surface-2 animate-pulse" />
                      <div className="h-3 w-1/3 rounded bg-surface-2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activiteFiltree.length === 0 ? (
              <EmptyState icon={<Clock className="h-8 w-8" />} message="Aucune activité récente" />
            ) : (
              <div className="divide-y divide-line max-h-[480px] overflow-y-auto">
                {activiteFiltree.map((item) => {
                  const cfg = ACTIVITY_TYPE_CONFIG[item.type]
                  const inner = (
                    <div className="flex items-start gap-s-3 px-s-4 py-s-3 transition-colors hover:bg-surface-2">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cfg.color}`}>
                        {cfg.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-small font-medium text-ink truncate">{item.label}</p>
                        <p className="text-micro text-ink-3">
                          {cfg.label} · {formatDistanceToNow(new Date(item.time), { locale: fr, addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  )
                  return item.href ? (
                    <Link key={item.id} to={item.href}>{inner}</Link>
                  ) : (
                    <div key={item.id}>{inner}</div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Répartition dépenses + Top praticiens ── */}
      <div className="grid grid-cols-1 gap-s-6 lg:grid-cols-2">

        {/* PieChart */}
        <section>
          <div className="mb-s-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink">Répartition des dépenses</h2>
            <select
              className="rounded-lg border border-line bg-surface px-s-3 py-s-1.5 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              value={periodDepenses}
              onChange={e => setPeriodDepenses(e.target.value as PeriodDepenses)}
            >
              <option value="1m">Ce mois</option>
              <option value="3m">3 mois</option>
              <option value="6m">6 mois</option>
              <option value="1y">Année</option>
            </select>
          </div>

          <div className="rounded-xl border border-line bg-surface p-s-4">
            {depensesLabeled.length === 0 ? (
              <EmptyState icon={<BarChart2 className="h-8 w-8" />} message="Aucune dépense enregistrée" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={depensesLabeled}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="displayName"
                  >
                    {depensesLabeled.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    formatter={(value) => <span className="text-small text-ink">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Top praticiens */}
        <section>
          <div className="mb-s-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink">Top praticiens conventionnés</h2>
            <Link to="/mutuelle/contrats" className="text-small text-primary hover:underline">
              Voir tous
            </Link>
          </div>

          <div className="rounded-xl border border-line bg-surface">
            {loadingKpis ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-s-3 border-b border-line px-s-4 py-s-3 last:border-0">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-surface-2 animate-pulse" />
                  <div className="flex-1 space-y-s-1">
                    <div className="h-3 w-1/2 rounded bg-surface-2 animate-pulse" />
                    <div className="h-3 w-1/3 rounded bg-surface-2 animate-pulse" />
                  </div>
                  <div className="h-3 w-16 rounded bg-surface-2 animate-pulse" />
                </div>
              ))
            ) : topPraticiens.length === 0 ? (
              <EmptyState icon={<Stethoscope className="h-8 w-8" />} message="Aucun praticien ce mois" />
            ) : (
              <div className="divide-y divide-line">
                {topPraticiens.map((p, i) => (
                  <Link
                    key={p.praticien_id}
                    to="/mutuelle/contrats"
                    className="flex items-center gap-s-3 px-s-4 py-s-3 transition-colors hover:bg-surface-2"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-small font-bold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-small font-medium text-ink truncate">{p.nom}</p>
                      <p className="text-micro text-ink-3">{p.specialite}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-small font-semibold text-ink">{p.nb_demandes} dem.</p>
                      <p className="text-micro text-ink-3">{formatFCFA(p.montant_total)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── FAB ── */}
      <div ref={fabRef} className="fixed bottom-s-6 right-s-6 z-50">
        <AnimatePresence>
          {fabOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="mb-s-3 flex flex-col gap-s-2"
            >
              <button
                onClick={() => { setFabOpen(false); navigate('/mutuelle/adherents?action=new') }}
                className="flex items-center gap-s-2 rounded-xl bg-surface px-s-4 py-s-3 text-small font-medium text-ink shadow-xl hover:bg-surface-2 border border-line"
              >
                <Plus className="h-4 w-4 text-primary" />
                Ajouter un adhérent
              </button>
              <button
                onClick={() => { setFabOpen(false); navigate('/mutuelle/demandes') }}
                className="flex items-center gap-s-2 rounded-xl bg-surface px-s-4 py-s-3 text-small font-medium text-ink shadow-xl hover:bg-surface-2 border border-line"
              >
                <CheckSquare className="h-4 w-4 text-emerald-600" />
                Valider demandes en attente
              </button>
              <button
                onClick={async () => {
                  setFabOpen(false)
                  toast.promise(
                    callEF('export-admin-report', { scope: 'mutuelle', type: 'mensuel' }),
                    { loading: 'Génération du rapport…', success: 'Rapport généré', error: 'Erreur export' }
                  )
                }}
                className="flex items-center gap-s-2 rounded-xl bg-surface px-s-4 py-s-3 text-small font-medium text-ink shadow-xl hover:bg-surface-2 border border-line"
              >
                <Download className="h-4 w-4 text-amber-600" />
                Exporter rapport mensuel PDF
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setFabOpen(o => !o)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-2xl"
          aria-label="Actions rapides"
        >
          <AnimatePresence mode="wait" initial={false}>
            {fabOpen ? (
              <motion.span key="close" initial={{ rotate: -90 }} animate={{ rotate: 0 }} exit={{ rotate: 90 }}>
                <X className="h-6 w-6" />
              </motion.span>
            ) : (
              <motion.span key="open" initial={{ rotate: 90 }} animate={{ rotate: 0 }} exit={{ rotate: -90 }}>
                <Zap className="h-6 w-6" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  )
}
