import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search,
  Calendar,
  Pill,
  FolderClosed,
  Clock,
  FileText,
  ShoppingBag,
  ChevronRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { NotificationBell } from '@/features/notifications/NotificationCenter'

// ─── Animation variants ────────────────────────────────────────────────────
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] as const } },
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface Appointment {
  id: string
  scheduled_at: string
  status: string
  professional_id: string
  professional?: { full_name: string; specialty?: string }
  clinic?: { name: string }
}

interface PharmacyReservation {
  id: string
  reservation_number: string
  status: string
  pharmacy?: { name: string }
  pickup_code?: string
}

interface Prescription {
  id: string
  reference: string
  issued_at: string
  professional?: { full_name: string }
}

interface TimelineEvent {
  id: string
  type: 'appointment' | 'prescription' | 'reservation'
  description: string
  date: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

function appointmentStatusLabel(status: string) {
  const map: Record<string, string> = {
    confirmed: 'Confirmé',
    patient_arrived: 'Arrivé',
    pending: 'En attente',
    in_progress: 'En cours',
  }
  return map[status] ?? status
}

function reservationStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: 'En attente',
    confirmed: 'Confirmé',
    preparing: 'En préparation',
    ready: 'Prêt',
  }
  return map[status] ?? status
}

function appointmentStatusVariant(status: string): 'success' | 'progress' | 'pending' | 'neutral' {
  if (status === 'confirmed') return 'success'
  if (status === 'patient_arrived' || status === 'in_progress') return 'progress'
  if (status === 'pending') return 'pending'
  return 'neutral'
}

function reservationStatusVariant(status: string): 'success' | 'progress' | 'pending' | 'neutral' {
  if (status === 'ready') return 'success'
  if (status === 'preparing' || status === 'confirmed') return 'progress'
  if (status === 'pending') return 'pending'
  return 'neutral'
}

// ─── Quick action tile ─────────────────────────────────────────────────────
interface QuickActionProps {
  icon: React.ReactNode
  label: string
  to: string
}

function QuickAction({ icon, label, to }: QuickActionProps) {
  const navigate = useNavigate()
  return (
    <motion.button
      variants={item}
      onClick={() => navigate(to)}
      className="flex flex-col items-center gap-s-2 rounded-md border border-line bg-surface p-s-4 text-center hover:bg-surface-2 active:scale-[0.98] transition-all w-full"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="text-xs font-medium text-ink leading-tight">{label}</span>
    </motion.button>
  )
}

// ─── Skeleton card ─────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-md border border-line bg-surface p-s-4 flex flex-col gap-s-2">
      <Skeleton className="h-4 w-1/3 rounded" />
      <Skeleton className="h-5 w-2/3 rounded" />
      <Skeleton className="h-4 w-1/2 rounded" />
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function PatientHome() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Bienvenue'

  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null)
  const [reservation, setReservation] = useState<PharmacyReservation | null>(null)
  const [prescription, setPrescription] = useState<Prescription | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loadingCards, setLoadingCards] = useState(true)

  const fetchDashboard = useCallback(async () => {
    if (!profile?.id) return
    setLoadingCards(true)

    const db = supabase as any
    const [apptRes, reservRes, presRes] = await Promise.all([
      db
        .from('appointments')
        .select('id, scheduled_at, status, professional_id, professional:professionals(full_name, specialty), clinic:clinics(name)')
        .eq('patient_id', profile.id)
        .in('status', ['confirmed', 'patient_arrived'])
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      db
        .from('pharmacy_reservations')
        .select('id, reservation_number, status, pickup_code, pharmacy:pharmacies(name)')
        .eq('patient_id', profile.id)
        .not('status', 'in', '("completed","cancelled","expired")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('prescriptions')
        .select('id, reference, issued_at, professional:professionals(full_name)')
        .eq('patient_id', profile.id)
        .order('issued_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    setNextAppointment(apptRes.data ?? null)
    setReservation(reservRes.data ?? null)
    setPrescription(presRes.data ?? null)

    // Build timeline from last 5 events across all three types
    const events: TimelineEvent[] = []

    const apptList = await (supabase as any)
      .from('appointments')
      .select('id, scheduled_at, status, professional:professionals(full_name)')
      .eq('patient_id', profile.id)
      .order('scheduled_at', { ascending: false })
      .limit(3)
    ;(apptList.data ?? []).forEach((a: Appointment) => {
      events.push({
        id: `appt-${a.id}`,
        type: 'appointment',
        description: `RDV · ${a.professional?.full_name ?? 'Médecin'} — ${appointmentStatusLabel(a.status)}`,
        date: a.scheduled_at,
      })
    })

    const presList = await (supabase as any)
      .from('prescriptions')
      .select('id, reference, issued_at, professional:professionals(full_name)')
      .eq('patient_id', profile.id)
      .order('issued_at', { ascending: false })
      .limit(2)
    ;(presList.data ?? []).forEach((p: Prescription) => {
      events.push({
        id: `pres-${p.id}`,
        type: 'prescription',
        description: `Ordonnance · ${p.reference ?? p.id.slice(0, 8)} — ${p.professional?.full_name ?? 'Médecin'}`,
        date: p.issued_at,
      })
    })

    const resList = await (supabase as any)
      .from('pharmacy_reservations')
      .select('id, reservation_number, created_at, status')
      .eq('patient_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(2)
    ;(resList.data ?? []).forEach((r: { id: string; reservation_number: string; created_at: string; status: string }) => {
      events.push({
        id: `res-${r.id}`,
        type: 'reservation',
        description: `Réservation · ${r.reservation_number ?? r.id.slice(0, 8)} — ${reservationStatusLabel(r.status)}`,
        date: r.created_at,
      })
    })

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setTimeline(events.slice(0, 5))
    setLoadingCards(false)
  }, [profile?.id])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const timelineIcon = (type: TimelineEvent['type']) => {
    if (type === 'appointment') return <Calendar className="w-4 h-4 text-primary" />
    if (type === 'prescription') return <FileText className="w-4 h-4 text-accent" />
    return <ShoppingBag className="w-4 h-4 text-status-success" />
  }

  return (
    <div className="flex flex-col gap-s-5 pb-s-6">
      {/* ── En-tête ────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-s-3">
        <div>
          <p className="text-xs text-ink-3">Bonjour</p>
          <h1 className="text-h1 font-semibold text-ink">{firstName}</h1>
          <p className="mt-s-1 text-body text-ink-2">Que voulez-vous faire ?</p>
        </div>
        <div className="flex items-center gap-s-2">
          <NotificationBell />
          <Avatar fallback={profile?.full_name ?? 'Patient'} size="md" />
        </div>
      </header>

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
            icon={<Search className="w-5 h-5" />}
            label="Trouver un médecin"
            to="/patient/recherche"
          />
          <QuickAction
            icon={<Calendar className="w-5 h-5" />}
            label="Mes rendez-vous"
            to="/patient/rendez-vous"
          />
          <QuickAction
            icon={<Pill className="w-5 h-5" />}
            label="Mes médicaments"
            to="/patient/medicaments"
          />
          <QuickAction
            icon={<FolderClosed className="w-5 h-5" />}
            label="Mes documents"
            to="/patient/documents"
          />
        </motion.div>
      </section>

      {/* ── Mon actualité ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-s-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
          Mon actualité
        </h2>

        {/* Prochain rendez-vous */}
        {loadingCards ? (
          <CardSkeleton />
        ) : nextAppointment ? (
          <Card variant="interactive">
            <div className="flex items-start justify-between gap-s-3">
              <div>
                <p className="text-xs text-ink-3 mb-s-1">Prochain rendez-vous</p>
                <p className="font-medium text-ink">
                  {nextAppointment.professional?.full_name ?? 'Médecin'}
                </p>
                {nextAppointment.professional?.specialty && (
                  <p className="text-xs text-ink-2">{nextAppointment.professional.specialty}</p>
                )}
                {nextAppointment.clinic && (
                  <p className="text-xs text-ink-2">{nextAppointment.clinic.name}</p>
                )}
                <p className="mt-s-1 text-xs font-medium text-primary">
                  {formatDate(nextAppointment.scheduled_at)}
                </p>
              </div>
              <StatusPill
                status={appointmentStatusVariant(nextAppointment.status)}
                label={appointmentStatusLabel(nextAppointment.status)}
              />
            </div>
            <div className="mt-s-4 flex gap-s-2">
              <Button
                size="sm"
                onClick={() => navigate('/patient/rendez-vous')}
              >
                Voir le détail
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
                  className="text-xs text-primary hover:underline mt-s-1"
                  onClick={() => navigate('/patient/recherche')}
                >
                  Trouver un médecin →
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Réservation en cours */}
        {loadingCards ? (
          <CardSkeleton />
        ) : reservation ? (
          <Card variant="interactive">
            <div className="flex items-start justify-between gap-s-3">
              <div>
                <p className="text-xs text-ink-3 mb-s-1">Réservation en cours</p>
                <p className="font-medium text-ink">
                  {reservation.reservation_number ?? reservation.id.slice(0, 8)}
                </p>
                {reservation.pharmacy && (
                  <p className="text-xs text-ink-2">{reservation.pharmacy.name}</p>
                )}
              </div>
              <StatusPill
                status={reservationStatusVariant(reservation.status)}
                label={reservationStatusLabel(reservation.status)}
              />
            </div>
            {reservation.pickup_code && (
              <div className="mt-s-3 flex items-center gap-s-2 rounded-md bg-surface-2 px-s-3 py-s-2">
                <span className="text-xs text-ink-3">Code de retrait</span>
                <span className="ml-auto font-mono font-bold text-ink text-lg tracking-widest">
                  {reservation.pickup_code}
                </span>
              </div>
            )}
            <div className="mt-s-3">
              <button
                className="text-xs text-primary hover:underline flex items-center gap-s-1"
                onClick={() => navigate('/patient/reserver')}
              >
                Voir la réservation <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </Card>
        ) : null}

        {/* Dernière ordonnance */}
        {loadingCards ? (
          <CardSkeleton />
        ) : prescription ? (
          <Card variant="interactive">
            <div className="flex items-start justify-between gap-s-3">
              <div>
                <p className="text-xs text-ink-3 mb-s-1">Dernière ordonnance</p>
                <p className="font-medium text-ink">
                  {prescription.reference ?? `ORD-${prescription.id.slice(0, 8)}`}
                </p>
                <p className="text-xs text-ink-2">
                  {prescription.professional?.full_name ?? 'Médecin'} ·{' '}
                  {formatShortDate(prescription.issued_at)}
                </p>
              </div>
              <FileText className="w-5 h-5 text-ink-3 shrink-0 mt-s-1" />
            </div>
            <div className="mt-s-3 flex gap-s-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/patient/ordonnances/${prescription.id}`)}
              >
                Voir l'ordonnance
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate('/patient/medicaments')}
              >
                Trouver mon médicament
              </Button>
            </div>
          </Card>
        ) : null}
      </section>

      {/* ── Mon parcours récent ────────────────────────────────────────── */}
      {!loadingCards && timeline.length > 0 && (
        <section>
          <h2 className="mb-s-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
            Mon parcours récent
          </h2>
          <div className="relative flex flex-col gap-0">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-line" />

            {timeline.map((event, idx) => (
              <div key={event.id} className="relative flex items-start gap-s-3 py-s-2 pl-s-2">
                {/* Icon bubble */}
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
                  {timelineIcon(event.type)}
                </span>
                <div className={['flex-1 pt-s-1', idx < timeline.length - 1 ? 'pb-s-2' : ''].join(' ')}>
                  <p className="text-xs font-medium text-ink leading-snug">{event.description}</p>
                  <p className="text-xs text-ink-3 flex items-center gap-s-1 mt-s-1">
                    <Clock className="w-3 h-3" />
                    {formatShortDate(event.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skeleton timeline */}
      {loadingCards && (
        <section>
          <h2 className="mb-s-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
            Mon parcours récent
          </h2>
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
    </div>
  )
}
