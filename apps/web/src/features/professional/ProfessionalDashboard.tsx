import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, FileText, Plus, RefreshCw, AlertTriangle, Bell,
  ChevronRight, Clock, CheckCircle2, XCircle, Play, Check, X,
  TrendingUp, TrendingDown, Minus, Activity,
  FlaskConical, Stethoscope, CreditCard, Shield,
} from 'lucide-react'
import { format, formatDistanceToNow, parseISO, isToday, isTomorrow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmModal } from '@/components/mutuelle/ConfirmModal'
import { RdvSlot } from '@/components/praticien/RdvSlot'
import { TimerConsultation } from '@/components/praticien/TimerConsultation'
import { cn } from '@/lib/utils'
import {
  JaugePatients, KpiEnCours, KpiBrouillons,
  DashboardTendances, ActionsRapides, UsagePlan,
} from './DashboardWidgets'

// ── Types ─────────────────────────────────────────────────────────────────────

type ApptStatus = 'pending' | 'confirmed' | 'patient_arrived' | 'in_consultation' | 'completed' | 'no_show' | 'cancelled_patient' | 'cancelled_professional'

interface AppointmentToday {
  id: string
  starts_at: string
  ends_at?: string | null
  status: ApptStatus
  type?: string | null
  motif?: string | null
  started_at?: string | null
  duration_minutes?: number | null
  patient_id: string
  patient_profile?: { id: string; full_name: string; avatar_url?: string | null } | null
}

interface Kpis {
  patients_vus: number
  patients_restants: number
  duree_moy: number | null
  revenus_jour: number
  nouvelles_demandes: number
  consultations_mois: number
  consultations_mois_prec: number
  revenus_mois: number
  ordonnances_mois: number
}

interface Alerte {
  id: string
  type: 'analyses' | 'renouvellement' | 'suivi_chronique' | 'tiers_payant'
  titre: string
  detail: string
  href: string
  createdAt: string
}

interface ActivityEvent {
  id: string
  type: string
  label: string
  at: string
  icon: React.ReactNode
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  consultation: 'Consultation',
  suivi:        'Suivi',
  urgence:      'Urgence',
  teleconsult:  'Téléconsultation',
}

const STATUS_LABEL: Record<ApptStatus, string> = {
  pending:                'En attente',
  confirmed:              'Confirmé',
  patient_arrived:        'Arrivé',
  in_consultation:        'En cours',
  completed:              'Terminé',
  no_show:                'Absent',
  cancelled_patient:      'Annulé',
  cancelled_professional: 'Annulé',
}

const STATUS_VARIANT: Record<ApptStatus, 'neutral' | 'primary' | 'success' | 'accent' | 'pending' | 'danger'> = {
  pending:                'pending',
  confirmed:              'primary',
  patient_arrived:        'success',
  in_consultation:        'accent',
  completed:              'neutral',
  no_show:                'danger',
  cancelled_patient:      'danger',
  cancelled_professional: 'danger',
}

const ACTIVE_STATUSES: ApptStatus[] = ['pending', 'confirmed', 'patient_arrived', 'in_consultation']

function formatFCFA(amount: number) {
  return new Intl.NumberFormat('fr-SN', { style: 'decimal', maximumFractionDigits: 0 }).format(amount) + ' FCFA'
}

function TrendBadge({ curr, prev }: { curr: number; prev: number }) {
  if (prev === 0) return null
  const pct = Math.round(((curr - prev) / prev) * 100)
  if (pct === 0) return <span className="flex items-center gap-0.5 text-micro text-ink-3"><Minus className="h-3 w-3" /> 0%</span>
  const up = pct > 0
  return (
    <span className={cn('flex items-center gap-0.5 text-micro font-medium', up ? 'text-emerald-600' : 'text-red-500')}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{pct}%
    </span>
  )
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color = 'primary' }: {
  label: string; value: string | React.ReactNode; sub?: React.ReactNode
  icon: React.ReactNode; color?: string
}) {
  return (
    <Card className="flex flex-col gap-s-2 p-s-4">
      <div className="flex items-start justify-between">
        <p className="text-small font-medium text-ink-3">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md bg-${color}/10 text-${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-h2 font-display font-bold text-ink leading-none">{value}</p>
      {sub && <div className="text-small text-ink-3">{sub}</div>}
    </Card>
  )
}

// ── Patient row in queue ──────────────────────────────────────────────────────

function PatientRow({
  appt,
  onDemarrer,
  onTerminer,
  onAbsent,
  loadingId,
  timerRunning,
}: {
  appt: AppointmentToday
  onDemarrer: (id: string) => void
  onTerminer: (id: string) => void
  onAbsent:  (id: string) => void
  loadingId: string | null
  timerRunning: boolean
}) {
  const name = appt.patient_profile?.full_name ?? 'Patient inconnu'
  const time = format(parseISO(appt.starts_at), 'HH:mm')
  const isActive = appt.status === 'in_consultation'
  const loading = loadingId === appt.id

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'flex items-center gap-s-3 rounded-lg border p-s-3 transition-colors',
        isActive ? 'border-primary/40 bg-primary-soft' : 'border-line bg-surface hover:bg-surface-2',
      )}
    >
      {/* Heure */}
      <span className="w-12 shrink-0 font-mono text-small font-semibold text-primary">{time}</span>

      {/* Avatar + Nom */}
      <Avatar src={appt.patient_profile?.avatar_url} fallback={name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{name}</p>
        <p className="text-micro text-ink-3">
          {appt.type ? (TYPE_LABEL[appt.type] ?? appt.type) : (appt.motif ?? '—')}
        </p>
      </div>

      {/* Timer si en cours */}
      {isActive && appt.started_at && (
        <TimerConsultation running={timerRunning} className="shrink-0" />
      )}

      {/* Statut */}
      <Badge variant={STATUS_VARIANT[appt.status]}>
        {STATUS_LABEL[appt.status]}
      </Badge>

      {/* Actions */}
      <div className="flex shrink-0 gap-s-1">
        {(appt.status === 'confirmed' || appt.status === 'patient_arrived') && (
          <Button
            size="sm" variant="primary" loading={loading}
            leftIcon={<Play className="h-3.5 w-3.5" />}
            onClick={() => onDemarrer(appt.id)}
          >
            Démarrer
          </Button>
        )}
        {appt.status === 'in_consultation' && (
          <Button
            size="sm" variant="secondary" loading={loading}
            leftIcon={<Check className="h-3.5 w-3.5" />}
            onClick={() => onTerminer(appt.id)}
          >
            Terminer
          </Button>
        )}
        {ACTIVE_STATUSES.includes(appt.status) && appt.status !== 'in_consultation' && (
          <button
            onClick={() => onAbsent(appt.id)}
            className="rounded-md p-s-1.5 text-ink-3 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Marquer absent"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ── Alerte row ────────────────────────────────────────────────────────────────

const ALERTE_ICONS: Record<string, React.ReactNode> = {
  analyses:         <FlaskConical className="h-5 w-5 text-red-500" />,
  renouvellement:   <RefreshCw    className="h-5 w-5 text-amber-500" />,
  suivi_chronique:  <Activity     className="h-5 w-5 text-yellow-500" />,
  tiers_payant:     <Shield       className="h-5 w-5 text-blue-500" />,
}

const ALERTE_BG: Record<string, string> = {
  analyses:        'bg-red-50 border-red-100',
  renouvellement:  'bg-amber-50 border-amber-100',
  suivi_chronique: 'bg-yellow-50 border-yellow-100',
  tiers_payant:    'bg-blue-50 border-blue-100',
}

function AlerteRow({ alerte }: { alerte: Alerte }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(alerte.href)}
      className={cn(
        'flex w-full items-start gap-s-3 rounded-lg border p-s-3 text-left transition-opacity hover:opacity-80',
        ALERTE_BG[alerte.type] ?? 'bg-surface-2 border-line',
      )}
    >
      <div className="shrink-0 mt-0.5">{ALERTE_ICONS[alerte.type]}</div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink text-small">{alerte.titre}</p>
        <p className="text-micro text-ink-3 truncate">{alerte.detail}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 mt-0.5" />
    </button>
  )
}

// ── Activity event row ────────────────────────────────────────────────────────

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex items-center gap-s-3 py-s-2 border-b border-line last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2">
        {event.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-small text-ink truncate">{event.label}</p>
      </div>
      <p className="text-micro text-ink-3 shrink-0">
        {formatDistanceToNow(parseISO(event.at), { addSuffix: true, locale: fr })}
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfessionalDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const db = supabase as any

  const dateLabel = format(new Date(), "EEEE d MMMM yyyy", { locale: fr })
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  // ── State ──────────────────────────────────────────────────────────────────
  const [appts, setAppts] = useState<AppointmentToday[]>([])
  const [apptsLoading, setApptsLoading] = useState(true)

  const [nextAppts, setNextAppts] = useState<AppointmentToday[]>([])

  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [kpisLoading, setKpisLoading] = useState(true)

  const [alertes, setAlertes] = useState<Alerte[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])

  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [absentTarget, setAbsentTarget] = useState<string | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const [brouillonsCount, setBrouillonsCount] = useState(0)

  // ── Load appointments du jour ──────────────────────────────────────────────
  const loadAppts = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await db
      .from('appointments')
      .select(`
        id, starts_at, ends_at, status, type, motif, started_at, duration_minutes, patient_id,
        patient_profile:patient_id (
          id,
          profiles!inner (id, full_name, avatar_url)
        )
      `)
      .eq('professional_id', profile.id)
      .gte('starts_at', `${todayStr}T00:00:00`)
      .lte('starts_at', `${todayStr}T23:59:59`)
      .not('status', 'in', '(cancelled_patient,cancelled_professional)')
      .order('starts_at')

    // Aplatir patient_profile.profiles → patient_profile
    const mapped = (data ?? []).map((a: any) => ({
      ...a,
      patient_profile: a.patient_profile?.profiles ?? null,
    }))
    setAppts(mapped)
    setTimerRunning(mapped.some((a: AppointmentToday) => a.status === 'in_consultation'))
    setApptsLoading(false)
  }, [profile?.id, todayStr])

  // ── Load prochains RDV (aujourd'hui + demain, hors terminés) ───────────────
  const loadNextAppts = useCallback(async () => {
    if (!profile?.id) return
    const tomorrowStr = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
    const { data } = await db
      .from('appointments')
      .select(`
        id, starts_at, ends_at, status, type, motif, patient_id,
        patient_profile:patient_id (
          id,
          profiles!inner (id, full_name, avatar_url)
        )
      `)
      .eq('professional_id', profile.id)
      .gte('starts_at', new Date().toISOString())
      .lte('starts_at', `${tomorrowStr}T23:59:59`)
      .in('status', ['pending', 'confirmed', 'patient_arrived'])
      .order('starts_at')
      .limit(5)

    const mapped = (data ?? []).map((a: any) => ({
      ...a,
      patient_profile: a.patient_profile?.profiles ?? null,
    }))
    setNextAppts(mapped)
  }, [profile?.id, todayStr])

  // ── Load KPIs via EF ───────────────────────────────────────────────────────
  const loadKpis = useCallback(async () => {
    setKpisLoading(true)
    const { data, error } = await supabase.functions.invoke('get-praticien-kpis')
    if (!error && data) setKpis(data)
    setKpisLoading(false)
  }, [])

  // ── Load alertes ───────────────────────────────────────────────────────────
  const loadAlertes = useCallback(async () => {
    if (!profile?.id) return
    const items: Alerte[] = []

    // Ordonnances en attente de renouvellement
    const { data: renouv } = await db
      .from('prescription_renewals')
      .select('id, prescription_id, requested_at, patient_profile:patient_id(full_name)')
      .eq('professional_id', profile.id)
      .eq('status', 'pending')
      .limit(5)

    ;(renouv ?? []).forEach((r: any) => {
      items.push({
        id: `renouv-${r.id}`,
        type: 'renouvellement',
        titre: `Renouvellement demandé — ${r.patient_profile?.full_name ?? 'Patient'}`,
        detail: 'Cliquez pour voir l\'ordonnance',
        href: `/pro/ordonnances?renew=${r.prescription_id}`,
        createdAt: r.requested_at,
      })
    })

    // Résultats analyses reçus
    const { data: docs } = await db
      .from('patient_documents')
      .select('id, created_at, patient_profile:patient_id(full_name), document_type')
      .eq('professional_id', profile.id)
      .eq('document_type', 'resultat_analyse')
      .eq('reviewed', false)
      .limit(5)

    ;(docs ?? []).forEach((d: any) => {
      items.push({
        id: `doc-${d.id}`,
        type: 'analyses',
        titre: `Résultats reçus — ${d.patient_profile?.full_name ?? 'Patient'}`,
        detail: 'Résultats d\'analyses en attente de révision',
        href: `/pro/documents?id=${d.id}`,
        createdAt: d.created_at,
      })
    })

    // Tiers payant validé
    const { data: tp } = await db
      .from('tiers_payant_demandes')
      .select('id, updated_at, patient_profile:patient_id(full_name), montant_valide')
      .eq('professional_id', profile.id)
      .eq('statut', 'approuvee')
      .eq('notified_pro', false)
      .limit(5)

    ;(tp ?? []).forEach((t: any) => {
      items.push({
        id: `tp-${t.id}`,
        type: 'tiers_payant',
        titre: `Tiers payant validé — ${t.patient_profile?.full_name ?? 'Patient'}`,
        detail: t.montant_valide ? `${formatFCFA(t.montant_valide)} pris en charge` : 'Validation mutuelle reçue',
        href: `/pro/tiers-payant`,
        createdAt: t.updated_at,
      })
    })

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    setAlertes(items)
  }, [profile?.id])

  // ── Load brouillons ordonnances ────────────────────────────────────────────
  const loadBrouillons = useCallback(async () => {
    if (!profile?.id) return
    const { count } = await db.from('ordonnances')
      .select('*', { count: 'exact', head: true })
      .eq('praticien_id', profile.id)
      .eq('statut', 'brouillon')
    setBrouillonsCount(count ?? 0)
  }, [profile?.id])

  // ── Load activité récente ──────────────────────────────────────────────────
  const loadActivity = useCallback(async () => {
    if (!profile?.id) return
    const events: ActivityEvent[] = []

    const { data: recentAppts } = await db
      .from('appointments')
      .select('id, status, starts_at, patient_profile:patient_id(profiles!inner(full_name))')
      .eq('professional_id', profile.id)
      .in('status', ['completed', 'confirmed', 'no_show'])
      .order('updated_at', { ascending: false })
      .limit(5)

    ;(recentAppts ?? []).forEach((a: any) => {
      const name = a.patient_profile?.profiles?.full_name ?? 'Patient'
      const statusMap: Record<string, string> = {
        completed: `Consultation terminée — ${name}`,
        confirmed: `RDV confirmé — ${name}`,
        no_show:   `Absence constatée — ${name}`,
      }
      const iconMap: Record<string, React.ReactNode> = {
        completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        confirmed: <Calendar className="h-4 w-4 text-primary" />,
        no_show:   <XCircle className="h-4 w-4 text-red-400" />,
      }
      events.push({
        id: `appt-${a.id}-${a.status}`,
        type: a.status,
        label: statusMap[a.status] ?? a.status,
        at: a.starts_at,
        icon: iconMap[a.status] ?? <Activity className="h-4 w-4 text-ink-3" />,
      })
    })

    const { data: recentPresc } = await db
      .from('prescriptions')
      .select('id, created_at, patient_profile:patient_id(profiles!inner(full_name))')
      .eq('professional_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(3)

    ;(recentPresc ?? []).forEach((p: any) => {
      const name = p.patient_profile?.profiles?.full_name ?? 'Patient'
      events.push({
        id: `presc-${p.id}`,
        type: 'ordonnance',
        label: `Ordonnance créée — ${name}`,
        at: p.created_at,
        icon: <FileText className="h-4 w-4 text-secondary" />,
      })
    })

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    setActivity(events.slice(0, 10))
  }, [profile?.id])

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAppts()
    loadNextAppts()
    loadKpis()
    loadAlertes()
    loadActivity()
    loadBrouillons()

    if (!profile?.id) return

    const channel = supabase
      .channel(`dashboard-pro-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'appointments',
        filter: `professional_id=eq.${profile.id}`,
      }, () => { loadAppts(); loadNextAppts(); loadKpis() })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'prescriptions',
        filter: `professional_id=eq.${profile.id}`,
      }, () => { loadKpis(); loadActivity() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  // ── Actions ────────────────────────────────────────────────────────────────
  async function demarrer(id: string) {
    setLoadingId(id)
    const { error } = await supabase.functions.invoke('demarrer-consultation', { body: { appointment_id: id } })
    setLoadingId(null)
    if (error) { toast.error('Impossible de démarrer'); return }
    toast.success('Consultation démarrée')
    loadAppts(); loadKpis()
  }

  async function terminer(id: string) {
    setLoadingId(id)
    const { error } = await supabase.functions.invoke('terminer-consultation', { body: { appointment_id: id } })
    setLoadingId(null)
    if (error) { toast.error('Impossible de terminer'); return }
    toast.success('Consultation terminée')
    loadAppts(); loadKpis(); loadActivity()
  }

  async function marquerAbsent() {
    if (!absentTarget) return
    setLoadingId(absentTarget)
    const { error } = await supabase.functions.invoke('marquer-absent', { body: { appointment_id: absentTarget } })
    setLoadingId(null)
    setAbsentTarget(null)
    if (error) { toast.error('Erreur'); return }
    toast.success('Patient marqué absent')
    loadAppts(); loadKpis()
  }

  // ── Partition: file active vs terminés ────────────────────────────────────
  const fileActive = appts.filter(a => ACTIVE_STATUSES.includes(a.status))
  const fileTermine = appts.filter(a => a.status === 'completed' || a.status === 'no_show')

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-s-6 p-s-4 md:p-s-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-h2 font-bold text-ink capitalize">
            {dateLabel}
          </h1>
          <p className="text-small text-ink-3">
            {fileActive.length > 0
              ? `${fileActive.length} patient${fileActive.length > 1 ? 's' : ''} dans la file`
              : 'Aucun patient en attente'}
          </p>
        </div>
        <div className="flex gap-s-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/pro/ordonnances/nouvelle')}
            leftIcon={<FileText className="h-4 w-4" />}>
            Ordonnance
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/pro/agenda')}
            leftIcon={<Plus className="h-4 w-4" />}>
            Créneau
          </Button>
        </div>
      </div>

      {/* ── KPIs du jour — Jauge + En cours + Brouillons + Revenus ───────── */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 gap-s-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-s-3 md:grid-cols-4">
          {/* Jauge circulaire patients attendus */}
          <JaugePatients
            arrives={kpis?.patients_vus ?? 0}
            total={(kpis?.patients_vus ?? 0) + (kpis?.patients_restants ?? 0)}
          />
          {/* Consultations en cours */}
          <KpiEnCours
            count={fileActive.filter(a => a.status === 'in_consultation').length}
            onClick={() => {
              const inCons = fileActive.find(a => a.status === 'in_consultation')
              if (inCons) navigate(`/pro/consultation/${inCons.id}`)
            }}
          />
          {/* Ordonnances brouillon */}
          <KpiBrouillons
            count={brouillonsCount}
            onClick={() => navigate('/pro/ordonnances?statut=brouillon')}
          />
          {/* Revenus du jour */}
          <KpiCard
            label="Revenus du jour"
            value={formatFCFA(kpis?.revenus_jour ?? 0)}
            icon={<CreditCard className="h-4 w-4" />}
            color="primary"
            sub={
              kpis?.nouvelles_demandes ? (
                <span className="text-amber-600">{kpis.nouvelles_demandes} demande{kpis.nouvelles_demandes > 1 ? 's' : ''} en attente</span>
              ) : undefined
            }
          />
        </div>
      )}

      {/* ── KPIs du mois (3) ───────────────────────────────────────────────── */}
      {kpisLoading ? (
        <div className="grid grid-cols-3 gap-s-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-s-3">
          <KpiCard
            label="Consultations ce mois"
            value={String(kpis?.consultations_mois ?? 0)}
            icon={<Stethoscope className="h-4 w-4" />}
            color="primary"
            sub={<TrendBadge curr={kpis?.consultations_mois ?? 0} prev={kpis?.consultations_mois_prec ?? 0} />}
          />
          <KpiCard
            label="Revenus du mois"
            value={formatFCFA(kpis?.revenus_mois ?? 0)}
            icon={<CreditCard className="h-4 w-4" />}
            color="primary"
          />
          <KpiCard
            label="Ordonnances émises"
            value={String(kpis?.ordonnances_mois ?? 0)}
            icon={<FileText className="h-4 w-4" />}
            color="secondary"
          />
        </div>
      )}

      {/* ── Deux colonnes : file + sidebar ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-s-6 md:grid-cols-[1fr_320px]">

        {/* Colonne principale: file patients + terminés */}
        <div className="flex flex-col gap-s-4">
          {/* File active */}
          <Card className="flex flex-col gap-s-3 p-s-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-s-2 text-body font-semibold text-ink">
                <Calendar className="h-4 w-4 text-primary" />
                Ma journée
              </h2>
              <Link to="/pro/agenda" className="flex items-center gap-s-1 text-small text-primary hover:underline">
                Agenda <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {apptsLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
              : fileActive.length === 0 && fileTermine.length === 0
                ? <p className="py-s-6 text-center text-small text-ink-3">Aucun rendez-vous aujourd'hui 🎉</p>
                : (
                    <AnimatePresence>
                      {fileActive.map(appt => (
                        <PatientRow
                          key={appt.id}
                          appt={appt}
                          onDemarrer={demarrer}
                          onTerminer={terminer}
                          onAbsent={(id) => setAbsentTarget(id)}
                          loadingId={loadingId}
                          timerRunning={timerRunning}
                        />
                      ))}
                    </AnimatePresence>
                  )
            }
          </Card>

          {/* RDV terminés aujourd'hui (réduit) */}
          {fileTermine.length > 0 && (
            <Card className="p-s-4">
              <p className="mb-s-2 text-small font-semibold text-ink-3">
                Terminés aujourd'hui ({fileTermine.length})
              </p>
              <div className="flex flex-col gap-s-1">
                {fileTermine.map(appt => (
                  <div key={appt.id} className="flex items-center gap-s-3 py-s-1.5">
                    <span className="w-12 shrink-0 font-mono text-small text-ink-3">
                      {format(parseISO(appt.starts_at), 'HH:mm')}
                    </span>
                    <span className="flex-1 text-small text-ink">
                      {appt.patient_profile?.full_name ?? 'Patient'}
                    </span>
                    <Badge variant={STATUS_VARIANT[appt.status]}>
                      {STATUS_LABEL[appt.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Activité récente */}
          {activity.length > 0 && (
            <Card className="p-s-4">
              <h2 className="mb-s-3 text-body font-semibold text-ink">Activité récente</h2>
              {activity.map(ev => <ActivityRow key={ev.id} event={ev} />)}
            </Card>
          )}
        </div>

        {/* Colonne sidebar */}
        <div className="flex flex-col gap-s-4">
          {/* Prochains RDV */}
          <Card className="p-s-4">
            <div className="mb-s-3 flex items-center justify-between">
              <h2 className="text-body font-semibold text-ink">Prochains RDV</h2>
              <Link to="/pro/agenda" className="text-small text-primary hover:underline">Voir tout</Link>
            </div>
            {nextAppts.length === 0
              ? <p className="text-small text-ink-3 text-center py-s-4">Aucun prochain RDV</p>
              : nextAppts.map(appt => {
                  const name = appt.patient_profile?.full_name ?? 'Patient'
                  const start = parseISO(appt.starts_at)
                  const when = isToday(start) ? format(start, 'HH:mm') : isTomorrow(start) ? `Demain ${format(start, 'HH:mm')}` : format(start, 'EEE HH:mm', { locale: fr })
                  return (
                    <button
                      key={appt.id}
                      onClick={() => navigate('/pro/agenda')}
                      className="flex w-full items-center gap-s-2 py-s-2 border-b border-line last:border-0 text-left hover:bg-surface-2 rounded-md px-s-1 transition-colors"
                    >
                      <span className="w-16 shrink-0 text-small font-medium text-primary">{when}</span>
                      <Avatar src={appt.patient_profile?.avatar_url} fallback={name} size="sm" />
                      <span className="flex-1 truncate text-small text-ink">{name}</span>
                    </button>
                  )
                })
            }
          </Card>

          {/* Alertes */}
          <Card className="p-s-4">
            <div className="mb-s-3 flex items-center justify-between">
              <h2 className="flex items-center gap-s-2 text-body font-semibold text-ink">
                <Bell className="h-4 w-4 text-primary" />
                Alertes
              </h2>
              {alertes.length > 0 && (
                <span className="rounded-pill bg-red-500 px-s-1.5 py-0.5 text-micro font-bold text-white">
                  {alertes.length}
                </span>
              )}
            </div>
            {alertes.length === 0
              ? <p className="text-small text-ink-3 text-center py-s-4">Aucune alerte</p>
              : <div className="flex flex-col gap-s-2">
                  {alertes.map(a => <AlerteRow key={a.id} alerte={a} />)}
                </div>
            }
          </Card>
        </div>
      </div>

      {/* ── Actions rapides ────────────────────────────────────────────────── */}
      <ActionsRapides />

      {/* ── Graphiques tendances ────────────────────────────────────────────── */}
      <DashboardTendances />

      {/* ── Usage du plan ──────────────────────────────────────────────────── */}
      <UsagePlan />

      {/* ── Confirm absent ─────────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!absentTarget}
        onOpenChange={(o) => { if (!o) setAbsentTarget(null) }}
        title="Marquer le patient absent"
        message="Le patient sera notifié et le créneau libéré dans l'agenda. Cette action est irréversible."
        confirmLabel="Confirmer l'absence"
        variant="danger"
        loading={loadingId === absentTarget}
        onConfirm={marquerAbsent}
      />
    </div>
  )
}
