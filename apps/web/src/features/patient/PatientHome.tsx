import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Calendar, FileText, FolderClosed, Clock, ShoppingBag,
  ChevronRight, Phone, AlertTriangle, CheckCheck, Pill,
  Ambulance, UserRound, Bell,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Banner } from '@/components/ui/Banner'

// ─── Animation ─────────────────────────────────────────────────────────────
const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] as const } },
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

function relativeDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / 86400000)
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 0) return `Aujourd'hui à ${time}`
  if (diffDays === 1) return `Demain à ${time}`
  if (diffDays === -1) return `Hier à ${time}`
  if (diffDays > 1)   return `${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })} à ${time}`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ` à ${time}`
}

function shortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface Appointment {
  id: string
  scheduled_at: string
  status: string
  professional_id: string
  type?: string
  professional?: { id: string; full_name: string; specialty?: string; avatar_url?: string; profile_id?: string }
}

interface TreatingDoctor {
  full_name: string
  phone?: string
  email?: string
}

interface Reminder {
  id: string
  title?: string
  scheduled_at: string
}

interface TimelineEvent {
  id: string
  type: 'appointment' | 'prescription' | 'reservation' | 'document'
  description: string
  date: string
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-md border border-line bg-surface p-s-4 flex flex-col gap-s-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 rounded ${i === 0 ? 'w-1/3' : i === 1 ? 'w-2/3' : 'w-1/2'}`} />
      ))}
    </div>
  )
}

interface QuickActionProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}
function QuickAction({ icon, label, onClick, danger }: QuickActionProps) {
  return (
    <motion.button
      variants={item}
      onClick={onClick}
      className={`flex flex-col items-center gap-s-2 rounded-md border border-line bg-surface p-s-4 text-center hover:bg-surface-2 active:scale-[0.98] transition-all w-full ${danger ? 'border-status-danger/30 hover:bg-status-danger/5' : ''}`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-md ${danger ? 'bg-status-danger/10 text-status-danger' : 'bg-primary/10 text-primary'}`}>
        {icon}
      </span>
      <span className={`text-xs font-medium leading-tight ${danger ? 'text-status-danger' : 'text-ink'}`}>{label}</span>
    </motion.button>
  )
}

// ─── Profile completion bar ─────────────────────────────────────────────────
function ProfileCompletionBar({ pct, onClick }: { pct: number; onClick: () => void }) {
  if (pct === 100) return null
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md border border-line bg-surface px-s-4 py-s-3 hover:bg-surface-2 transition-colors"
    >
      <div className="flex items-center justify-between mb-s-2">
        <p className="text-xs font-medium text-ink">Profil complété à <span className="text-primary font-semibold">{pct}%</span></p>
        <ChevronRight className="w-4 h-4 text-ink-3" />
      </div>
      <div className="h-1.5 w-full rounded-pill bg-surface-2 overflow-hidden">
        <motion.div
          className="h-full rounded-pill bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
      <p className="mt-s-1 text-micro text-ink-3">Complétez votre profil pour une meilleure prise en charge</p>
    </button>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function PatientHome() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const db = supabase as any

  // Data state
  const [loading, setLoading]           = useState(true)
  const [nextAppt, setNextAppt]         = useState<Appointment | null>(null)
  const [activePresCount, setActivePresCount] = useState(0)
  const [expiringPres, setExpiringPres] = useState(false)
  const [docCount, setDocCount]         = useState(0)
  const [profilePct, setProfilePct]     = useState(0)
  const [needsBilan, setNeedsBilan]     = useState(false)
  const [mutuelleExpiry, setMutuelleExpiry] = useState<string | null>(null)
  const [reminders, setReminders]       = useState<Reminder[]>([])
  const [timeline, setTimeline]         = useState<TimelineEvent[]>([])
  const [treatingDoctor, setTreatingDoctor] = useState<TreatingDoctor | null>(null)

  // Modal state
  const [cancelModal, setCancelModal]   = useState(false)
  const [cancelling, setCancelling]     = useState(false)
  const [doctorModal, setDoctorModal]   = useState(false)
  const [urgenceModal, setUrgenceModal] = useState(false)

  const fetchDashboard = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    const yearAgo      = new Date(Date.now() - 365 * 86400000).toISOString()
    const now          = new Date().toISOString()
    const in7Days      = new Date(Date.now() + 7 * 86400000).toISOString()
    const in30Days     = new Date(Date.now() + 30 * 86400000).toISOString()
    const todayStart   = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd     = new Date(); todayEnd.setHours(23, 59, 59, 999)

    const [
      apptRes, presRes, presExpiryRes, docRes,
      patientRes, consultRes, mutuelleRes, reminderRes,
    ] = await Promise.all([
      // Prochain RDV
      db.from('appointments')
        .select('id, scheduled_at, status, type, professional_id, professional:professionals(id, full_name, specialty, avatar_url, profile_id)')
        .eq('patient_id', profile.id)
        .in('status', ['confirmed', 'pending', 'patient_arrived'])
        .gt('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle(),

      // Ordonnances actives (count)
      db.from('prescriptions')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', profile.id)
        .eq('status', 'active')
        .gt('expires_at', now),

      // Ordonnances expirant dans 7 jours
      db.from('prescriptions')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', profile.id)
        .eq('status', 'active')
        .gt('expires_at', now)
        .lt('expires_at', in7Days),

      // Documents non lus
      db.from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', profile.id)
        .is('deleted_at', null)
        .is('read_at', null),

      // Patient fields for completion
      db.from('patients')
        .select('national_id, treating_professional_id, blood_type, allergies')
        .eq('id', profile.id)
        .maybeSingle(),

      // Bilan annuel
      db.from('consultations')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', profile.id)
        .gte('created_at', yearAgo),

      // Mutuelle
      db.from('insurance_members')
        .select('valid_until')
        .eq('patient_id', profile.id)
        .eq('status', 'active')
        .maybeSingle(),

      // Rappels médicaments du jour
      db.from('reminders')
        .select('id, title, scheduled_at')
        .eq('recipient_profile_id', profile.id)
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString())
        .neq('status', 'cancelled')
        .order('scheduled_at', { ascending: true }),
    ])

    setNextAppt(apptRes.data ?? null)
    setActivePresCount(presRes.count ?? 0)
    setExpiringPres((presExpiryRes.count ?? 0) > 0)
    setDocCount(docRes.count ?? 0)
    setNeedsBilan((consultRes.count ?? 0) === 0)
    setReminders(reminderRes.data ?? [])

    // Mutuelle expiry alert
    const mutu = mutuelleRes.data
    if (mutu?.valid_until && new Date(mutu.valid_until) < new Date(in30Days)) {
      setMutuelleExpiry(mutu.valid_until)
    } else {
      setMutuelleExpiry(null)
    }

    // Profile completion (6 champs)
    const pat = patientRes.data
    const fields = [
      !!profile.avatar_url,
      !!pat?.national_id,
      !!pat?.treating_professional_id,
      !!pat?.blood_type,
      !!pat?.allergies,
      false, // téléphone — non présent dans les types actuels
    ]
    setProfilePct(Math.round((fields.filter(Boolean).length / 6) * 100))

    // Médecin traitant
    if (pat?.treating_professional_id) {
      const { data: proData } = await db
        .from('professionals')
        .select('profile:profiles(full_name, phone_number, email)')
        .eq('id', pat.treating_professional_id)
        .maybeSingle()
      if (proData?.profile) {
        setTreatingDoctor({
          full_name: proData.profile.full_name,
          phone: proData.profile.phone_number,
          email: proData.profile.email,
        })
      }
    }

    // Timeline (5 évènements récents)
    const [apptList, presList, resList] = await Promise.all([
      db.from('appointments')
        .select('id, scheduled_at, status, professional:professionals(full_name)')
        .eq('patient_id', profile.id)
        .order('scheduled_at', { ascending: false })
        .limit(3),
      db.from('prescriptions')
        .select('id, reference, issued_at, professional:professionals(full_name)')
        .eq('patient_id', profile.id)
        .order('issued_at', { ascending: false })
        .limit(2),
      db.from('pharmacy_reservations')
        .select('id, reservation_number, created_at, status')
        .eq('patient_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(2),
    ])

    const events: TimelineEvent[] = [
      ...(apptList.data ?? []).map((a: any) => ({
        id: `appt-${a.id}`,
        type: 'appointment' as const,
        description: `RDV · ${a.professional?.full_name ?? 'Médecin'}`,
        date: a.scheduled_at,
      })),
      ...(presList.data ?? []).map((p: any) => ({
        id: `pres-${p.id}`,
        type: 'prescription' as const,
        description: `Ordonnance · ${p.reference ?? p.id.slice(0, 8)}`,
        date: p.issued_at,
      })),
      ...(resList.data ?? []).map((r: any) => ({
        id: `res-${r.id}`,
        type: 'reservation' as const,
        description: `Réservation pharmacie · ${r.reservation_number ?? r.id.slice(0, 8)}`,
        date: r.created_at,
      })),
    ]
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setTimeline(events.slice(0, 5))

    setLoading(false)
  }, [profile?.id])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  // ── Annulation RDV ────────────────────────────────────────────────────────
  async function handleCancelAppointment() {
    if (!nextAppt) return
    setCancelling(true)
    try {
      await db.from('appointments')
        .update({ status: 'cancelled_patient' })
        .eq('id', nextAppt.id)

      // Notifier le professionnel
      const profProfileId = nextAppt.professional?.profile_id
      if (profProfileId) {
        await db.from('notifications').insert({
          user_id: profProfileId,
          event_type: 'rdv_annule_par_patient',
          title: 'Rendez-vous annulé',
          message: `Le patient a annulé son rendez-vous du ${relativeDate(nextAppt.scheduled_at)}.`,
          badge_category: 'appointment',
          priority: 'high',
          data: { appointment_id: nextAppt.id, patient_profile_id: profile?.id },
        })
      }

      setCancelModal(false)
      setNextAppt(null)
      await fetchDashboard()
    } finally {
      setCancelling(false)
    }
  }

  const timelineIcon = (type: TimelineEvent['type']) => {
    const cls = 'w-4 h-4'
    if (type === 'appointment') return <Calendar className={`${cls} text-primary`} />
    if (type === 'prescription') return <FileText className={`${cls} text-accent`} />
    if (type === 'document')    return <FolderClosed className={`${cls} text-navy`} />
    return <ShoppingBag className={`${cls} text-status-success`} />
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? ''

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-s-5 pb-s-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-start justify-between gap-s-3"
      >
        <div>
          <p className="text-small text-ink-3">{getGreeting()}</p>
          <h1 className="font-display text-h1 font-semibold text-ink">
            {firstName || 'Bienvenue'} {firstName ? '👋' : ''}
          </h1>
          <p className="mt-s-1 text-body text-ink-2">Que voulez-vous faire ?</p>
        </div>
        <Avatar
          src={profile?.avatar_url}
          fallback={profile?.full_name ?? 'P'}
          size="md"
        />
      </motion.header>

      {/* ── Barre de complétion profil ─────────────────────────────────── */}
      {!loading && profilePct < 100 && (
        <ProfileCompletionBar pct={profilePct} onClick={() => navigate('/patient/profil')} />
      )}
      {loading && <Skeleton className="h-14 w-full rounded-md" />}

      {/* ── Alertes ────────────────────────────────────────────────────── */}
      {!loading && (needsBilan || mutuelleExpiry) && (
        <div className="flex flex-col gap-s-2">
          {needsBilan && (
            <Banner kind="warning" className="rounded-md">
              Aucune consultation cette année — pensez à prendre un rendez-vous pour votre bilan annuel.
            </Banner>
          )}
          {mutuelleExpiry && (
            <Banner kind="warning" className="rounded-md">
              Votre mutuelle expire le {shortDate(mutuelleExpiry)} — contactez votre assureur pour la renouveler.
            </Banner>
          )}
        </div>
      )}

      {/* ── Rappels médicaments du jour ────────────────────────────────── */}
      {!loading && reminders.length > 0 && (
        <section>
          <h2 className="mb-s-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
            Médicaments du jour
          </h2>
          <div className="flex flex-col gap-s-2">
            {reminders.map(r => (
              <div key={r.id} className="flex items-center gap-s-3 rounded-md border border-line bg-surface px-s-4 py-s-3">
                <Bell className="w-4 h-4 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-small font-medium text-ink truncate">{r.title ?? 'Médicament'}</p>
                  <p className="text-micro text-ink-3">
                    {new Date(r.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Prochain rendez-vous ────────────────────────────────────────── */}
      <section>
        <h2 className="mb-s-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
          Prochain rendez-vous
        </h2>
        {loading ? (
          <CardSkeleton lines={4} />
        ) : nextAppt ? (
          <Card>
            <div className="flex items-start gap-s-3">
              <Avatar
                src={nextAppt.professional?.avatar_url}
                fallback={nextAppt.professional?.full_name ?? 'M'}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink truncate">
                  {nextAppt.professional?.full_name ?? 'Médecin'}
                </p>
                {nextAppt.professional?.specialty && (
                  <p className="text-small text-ink-2">{nextAppt.professional.specialty}</p>
                )}
                <p className="mt-s-1 text-small font-medium text-primary">
                  {relativeDate(nextAppt.scheduled_at)}
                </p>
                {nextAppt.type === 'teleconsultation' && (
                  <span className="mt-s-1 inline-flex items-center gap-s-1 rounded-pill bg-primary-soft px-s-2 py-0.5 text-micro font-medium text-primary">
                    Téléconsultation
                  </span>
                )}
              </div>
              <StatusPill
                status={nextAppt.status === 'confirmed' ? 'success' : 'pending'}
                label={nextAppt.status === 'confirmed' ? 'Confirmé' : 'En attente'}
              />
            </div>
            <div className="mt-s-4 flex gap-s-2">
              <Button size="sm" onClick={() => navigate('/patient/rendez-vous')}>
                Voir le détail
              </Button>
              <Button size="sm" variant="ghost" className="text-status-danger hover:bg-status-danger/5" onClick={() => setCancelModal(true)}>
                Annuler
              </Button>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center gap-s-3">
              <Calendar className="w-8 h-8 text-ink-3 shrink-0" />
              <div>
                <p className="font-medium text-ink-2">Aucun rendez-vous à venir</p>
                <button
                  className="mt-s-1 text-small text-primary hover:underline"
                  onClick={() => navigate('/patient/rendez-vous?action=nouveau')}
                >
                  Prendre un rendez-vous →
                </button>
              </div>
            </div>
          </Card>
        )}
      </section>

      {/* ── Ordonnances + Documents ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-s-3">
        {/* Ordonnances actives */}
        {loading ? (
          <CardSkeleton lines={2} />
        ) : (
          <button
            onClick={() => navigate('/patient/ordonnances')}
            className="rounded-md border border-line bg-surface p-s-4 text-left hover:bg-surface-2 transition-colors"
          >
            <div className="flex items-start justify-between">
              <FileText className="w-5 h-5 text-accent" />
              {expiringPres && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-micro font-bold text-white">!</span>
              )}
            </div>
            <p className="mt-s-2 font-display text-h2 font-bold text-ink">{activePresCount}</p>
            <p className="text-small text-ink-2">Ordonnance{activePresCount !== 1 ? 's' : ''} active{activePresCount !== 1 ? 's' : ''}</p>
            {expiringPres && (
              <p className="mt-s-1 text-micro font-medium text-accent">Expiration dans 7 jours</p>
            )}
          </button>
        )}

        {/* Documents en attente */}
        {loading ? (
          <CardSkeleton lines={2} />
        ) : (
          <button
            onClick={() => navigate('/patient/documents')}
            className="rounded-md border border-line bg-surface p-s-4 text-left hover:bg-surface-2 transition-colors"
          >
            <div className="flex items-start justify-between">
              <FolderClosed className="w-5 h-5 text-navy" />
              {docCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-s-1 text-micro font-bold text-primary-fg">
                  {docCount > 99 ? '99+' : docCount}
                </span>
              )}
            </div>
            <p className="mt-s-2 font-display text-h2 font-bold text-ink">{docCount}</p>
            <p className="text-small text-ink-2">Document{docCount !== 1 ? 's' : ''} en attente</p>
          </button>
        )}
      </div>

      {/* ── Actions rapides ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-s-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
          Actions rapides
        </h2>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-s-3"
        >
          <QuickAction
            icon={<Calendar className="w-5 h-5" />}
            label="Prendre un rendez-vous"
            onClick={() => navigate('/patient/rendez-vous?action=nouveau')}
          />
          <QuickAction
            icon={<Pill className="w-5 h-5" />}
            label="Renouveler une ordonnance"
            onClick={() => navigate('/patient/ordonnances?action=renouveler')}
          />
          <QuickAction
            icon={<UserRound className="w-5 h-5" />}
            label="Contacter mon médecin"
            onClick={() => setDoctorModal(true)}
          />
          <QuickAction
            icon={<Ambulance className="w-5 h-5" />}
            label="Urgences · Appeler le 15"
            onClick={() => setUrgenceModal(true)}
            danger
          />
        </motion.div>
      </section>

      {/* ── Activité récente ────────────────────────────────────────────── */}
      {!loading && timeline.length > 0 && (
        <section>
          <h2 className="mb-s-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
            Mon parcours récent
          </h2>
          <div className="relative flex flex-col">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-line" />
            {timeline.map((evt, idx) => (
              <div key={evt.id} className="relative flex items-start gap-s-3 py-s-2 pl-s-2">
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
                  {timelineIcon(evt.type)}
                </span>
                <div className={['flex-1 pt-s-1', idx < timeline.length - 1 ? 'pb-s-2' : ''].join(' ')}>
                  <p className="text-small font-medium text-ink leading-snug">{evt.description}</p>
                  <p className="mt-s-1 flex items-center gap-s-1 text-micro text-ink-3">
                    <Clock className="w-3 h-3" />
                    {shortDate(evt.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {loading && (
        <section>
          <h2 className="mb-s-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Mon parcours récent</h2>
          <div className="flex flex-col gap-s-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-s-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 flex flex-col gap-s-1">
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Modal : Annuler RDV ────────────────────────────────────────── */}
      <Modal
        open={cancelModal}
        onOpenChange={v => { if (!cancelling) setCancelModal(v) }}
        title="Annuler le rendez-vous"
        size="sm"
      >
        <div className="flex flex-col gap-s-4">
          <div className="flex items-start gap-s-3 rounded-md bg-surface-2 p-s-3">
            <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-small font-medium text-ink">
                {nextAppt?.professional?.full_name ?? 'Médecin'}
              </p>
              <p className="text-small text-ink-2">
                {nextAppt ? relativeDate(nextAppt.scheduled_at) : ''}
              </p>
            </div>
          </div>
          <p className="text-small text-ink-2">
            L'annulation est définitive. Le praticien sera notifié automatiquement.
          </p>
          <div className="flex gap-s-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setCancelModal(false)}
              disabled={cancelling}
            >
              Garder le RDV
            </Button>
            <Button
              className="flex-1 bg-status-danger hover:bg-status-danger/90 text-white border-status-danger"
              onClick={handleCancelAppointment}
              disabled={cancelling}
            >
              {cancelling ? 'Annulation…' : "Confirmer l’annulation"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal : Contacter mon médecin ─────────────────────────────── */}
      <Modal
        open={doctorModal}
        onOpenChange={setDoctorModal}
        title="Contacter mon médecin traitant"
        size="sm"
      >
        {treatingDoctor ? (
          <div className="flex flex-col gap-s-4">
            <div className="flex items-center gap-s-3">
              <Avatar fallback={treatingDoctor.full_name} size="md" />
              <p className="font-medium text-ink">{treatingDoctor.full_name}</p>
            </div>
            {treatingDoctor.phone && (
              <a
                href={`tel:${treatingDoctor.phone}`}
                className="flex items-center gap-s-3 rounded-md border border-line px-s-4 py-s-3 hover:bg-surface-2 transition-colors"
              >
                <Phone className="w-4 h-4 text-primary" />
                <span className="text-small font-medium text-ink">{treatingDoctor.phone}</span>
              </a>
            )}
            {treatingDoctor.email && (
              <a
                href={`mailto:${treatingDoctor.email}`}
                className="flex items-center gap-s-3 rounded-md border border-line px-s-4 py-s-3 hover:bg-surface-2 transition-colors"
              >
                <CheckCheck className="w-4 h-4 text-primary" />
                <span className="text-small text-ink">{treatingDoctor.email}</span>
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-s-4 py-s-4 text-center">
            <UserRound className="w-10 h-10 text-ink-3" />
            <div>
              <p className="font-medium text-ink">Aucun médecin traitant renseigné</p>
              <p className="mt-s-1 text-small text-ink-2">Ajoutez-le dans votre profil</p>
            </div>
            <Button size="sm" onClick={() => { setDoctorModal(false); navigate('/patient/profil') }}>
              Compléter mon profil
            </Button>
          </div>
        )}
      </Modal>

      {/* ── Modal : Urgences ─────────────────────────────────────────────── */}
      <Modal
        open={urgenceModal}
        onOpenChange={setUrgenceModal}
        title="Appeler les secours"
        size="sm"
      >
        <div className="flex flex-col gap-s-4">
          <div className="rounded-md bg-status-danger/10 px-s-4 py-s-3 text-center">
            <p className="font-display text-h1 font-bold text-status-danger">15</p>
            <p className="text-small text-ink-2">SAMU — Service d'aide médicale urgente</p>
          </div>
          <p className="text-small text-ink-2 text-center">
            Vous allez appeler le 15 (SAMU). Confirmez uniquement en cas d'urgence médicale réelle.
          </p>
          <div className="flex gap-s-2">
            <Button variant="secondary" className="flex-1" onClick={() => setUrgenceModal(false)}>
              Annuler
            </Button>
            <a
              href="tel:15"
              className="flex-1 flex items-center justify-center gap-s-2 rounded-md bg-status-danger px-s-4 py-s-2 text-small font-medium text-white hover:bg-status-danger/90 transition-colors"
              onClick={() => setUrgenceModal(false)}
            >
              <Phone className="w-4 h-4" />
              Appeler le 15
            </a>
          </div>
        </div>
      </Modal>
    </div>
  )
}
