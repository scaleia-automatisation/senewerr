import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

type Tab = 'upcoming' | 'past' | 'cancelled'

type Appointment = {
  id: string
  starts_at: string
  status: string
  reason: string | null
  pro_name: string
  pro_specialty: string
  establishment_name: string
  city: string
}

const UPCOMING_STATUSES = ['requested', 'confirmed', 'payment_pending', 'paid', 'patient_arrived', 'in_consultation']
const PAST_STATUSES = ['completed', 'no_show']

const EMPTY: Record<Tab, { title: string; description: string }> = {
  upcoming: { title: 'Aucun rendez-vous à venir', description: 'Réservez votre prochain rendez-vous depuis la recherche.' },
  past: { title: 'Aucun rendez-vous passé', description: 'Votre historique de consultations apparaîtra ici.' },
  cancelled: { title: 'Aucun rendez-vous annulé', description: '' },
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming', label: 'À venir' },
  { key: 'past', label: 'Passés' },
  { key: 'cancelled', label: 'Annulés' },
]

function isInArrivalWindow(startsAt: string) {
  const t = new Date(startsAt).getTime()
  const now = Date.now()
  return now >= t - 60 * 60_000 && now <= t + 30 * 60_000
}

function formatApptDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function AppointmentsPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [tab, setTab] = useState<Tab>('upcoming')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [patientId, setPatientId] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user) return
    supabase.from('patients').select('id').eq('profile_id', session.user.id).single()
      .then(({ data }) => { if (data) setPatientId(data.id) })
  }, [session])

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    const load = async () => {
      let q = supabase
        .from('appointments')
        .select(`
          id, starts_at, status, reason,
          professional:professionals(
            profile:profiles(first_name, last_name),
            specialty,
            organization:organizations(name, city)
          )
        `)
        .eq('patient_id', patientId)
        .order('starts_at', { ascending: tab === 'upcoming' })

      if (tab === 'cancelled') {
        q = q.like('status', 'cancelled_%')
      } else {
        q = q.in('status', tab === 'upcoming' ? UPCOMING_STATUSES : PAST_STATUSES)
      }

      const { data } = await q
      const mapped: Appointment[] = (data ?? []).map((a: any) => ({
        id: a.id,
        starts_at: a.starts_at,
        status: a.status,
        reason: a.reason,
        pro_name: `${a.professional?.profile?.first_name ?? ''} ${a.professional?.profile?.last_name ?? ''}`.trim(),
        pro_specialty: a.professional?.specialty ?? '',
        establishment_name: a.professional?.organization?.name ?? '',
        city: a.professional?.organization?.city ?? '',
      }))
      setAppointments(mapped)
      setLoading(false)
    }
    load()
  }, [patientId, tab])

  const handleArrived = async (id: string) => {
    await supabase.functions.invoke('mark-patient-arrived', { body: { appointmentId: id } })
    setAppointments(a => a.map(ap => ap.id === id ? { ...ap, status: 'patient_arrived' } : ap))
  }

  const handleCancel = async () => {
    if (!cancelId) return
    setCancelLoading(true)
    await supabase.functions.invoke('cancel-appointment', { body: { appointmentId: cancelId } })
    setAppointments(a => a.filter(ap => ap.id !== cancelId))
    setCancelId(null)
    setCancelLoading(false)
  }

  return (
    <div className="p-s-4 max-w-2xl mx-auto space-y-gap-s-3">
      <h1 className="text-2xl font-semibold text-ink">Mes rendez-vous</h1>

      <div className="flex gap-s-3 border-b border-line">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2 px-1 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-b-2 border-primary text-primary' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-gap-s-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState title={EMPTY[tab].title} description={EMPTY[tab].description} />
      ) : (
        <div className="space-y-gap-s-2">
          {appointments.map(ap => (
            <Card key={ap.id} className="p-s-4 space-y-gap-s-2">
              <div className="flex items-start justify-between gap-s-2">
                <div className="space-y-0.5">
                  <p className="font-medium text-ink">{ap.pro_name}</p>
                  <p className="text-sm text-ink-2">{ap.pro_specialty}</p>
                  <p className="text-sm text-ink-3">{ap.establishment_name}{ap.city ? ` — ${ap.city}` : ''}</p>
                  <p className="text-sm text-ink-2 pt-1">{formatApptDate(ap.starts_at)}</p>
                </div>
                <StatusPill status={ap.status} />
              </div>
              <div className="flex gap-s-2 flex-wrap">
                {['confirmed', 'paid'].includes(ap.status) && isInArrivalWindow(ap.starts_at) && (
                  <Button size="sm" onClick={() => handleArrived(ap.id)}>Je suis arrivé</Button>
                )}
                {['confirmed', 'paid'].includes(ap.status) && (
                  <Button size="sm" variant="ghost" onClick={() => setCancelId(ap.id)}>Annuler</Button>
                )}
                {ap.status === 'completed' && (
                  <Button size="sm" variant="secondary" onClick={() => navigate('/app/ordonnances')}>
                    Voir l'ordonnance
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {cancelId && (
        <Modal title="Annuler le rendez-vous" onClose={() => setCancelId(null)}>
          <p className="text-sm text-ink-2 mb-s-4">
            Êtes-vous sûr de vouloir annuler ce rendez-vous ? Cette action est irréversible.
          </p>
          <div className="flex gap-s-2 justify-end">
            <Button variant="ghost" onClick={() => setCancelId(null)}>Retour</Button>
            <Button variant="danger" onClick={handleCancel} disabled={cancelLoading}>
              {cancelLoading ? 'Annulation…' : "Confirmer l'annulation"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
