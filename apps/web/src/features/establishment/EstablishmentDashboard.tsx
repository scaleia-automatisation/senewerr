import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, CalendarDays, UserPlus, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { KpiTile } from '@/components/ui/KpiTile'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  patient_arrived: 'Arrivé',
  in_consultation: 'En consultation',
  completed: 'Terminé',
}

const STATUS_VARIANTS: Record<string, 'neutral' | 'primary' | 'accent' | 'success' | 'pending' | 'danger'> = {
  confirmed: 'primary',
  patient_arrived: 'success',
  in_consultation: 'accent',
  completed: 'neutral',
  pending: 'pending',
}

type Appointment = {
  id: string
  starts_at: string
  status: string
  professional_id: string
  professionals: { profiles: { first_name: string; last_name: string } } | null
  patients: { profiles: { first_name: string; last_name: string } } | null
}

type Professional = {
  professional_id: string
  professionals: { profiles: { first_name: string; last_name: string } } | null
}

export default function EstablishmentDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [orgName, setOrgName] = useState('Établissement')
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString()
  const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString()
  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    if (!profile) return

    async function load() {
      // Find organization the user is admin of (via organization_members)
      const { data: memberRow } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(id, name, type)')
        .eq('profile_id', profile!.id)
        .in('role', ['establishment_admin'])
        .limit(1)
        .maybeSingle()

      const org = (memberRow as any)?.organizations
      if (!org) { setLoading(false); return }
      setOrgName(org.name ?? 'Établissement')

      // Use organization id as establishment id (orgs of type clinic/hospital ARE establishments)
      const establishmentId: string = org.id
      if (!establishmentId) { setLoading(false); return }

      const [apptRes, proRes] = await Promise.all([
        (supabase as any)
          .from('appointments')
          .select('id, starts_at, status, professional_id, professionals:professional_id(profiles(first_name, last_name)), patients:patient_id(profiles(first_name, last_name))')
          .eq('establishment_id', establishmentId)
          .gte('starts_at', startOfDay)
          .lte('starts_at', endOfDay)
          .neq('status', 'cancelled_patient')
          .neq('status', 'cancelled_professional')
          .order('starts_at'),
        (supabase as any)
          .from('professional_establishments')
          .select('professional_id, professionals:professional_id(profiles(first_name, last_name))')
          .eq('establishment_id', establishmentId)
          .eq('status', 'active'),
      ])

      setAppointments((apptRes.data ?? []) as Appointment[])
      setProfessionals((proRes.data ?? []) as Professional[])
      setLoading(false)
    }

    load()
  }, [profile])

  const arrivedCount = appointments.filter(a => a.status === 'patient_arrived').length
  const inConsultCount = appointments.filter(a => a.status === 'in_consultation').length
  const totalCount = appointments.length

  // Group appointments by professional
  const byPro = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    const key = a.professional_id
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  const activeProfIds = new Set(appointments.map(a => a.professional_id))

  return (
    <div className="flex flex-col gap-s-6 p-s-4 md:p-s-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-h2 font-display font-bold text-ink">{orgName}</h1>
        <p className="text-small text-ink-3 capitalize">{dateLabel}</p>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-s-3">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-s-3">
          <KpiTile label="RDV du jour" value={String(totalCount)} />
          <KpiTile label="Arrivés / Attendus" value={`${arrivedCount}/${totalCount}`} />
          <KpiTile label="En consultation" value={String(inConsultCount)} />
          <KpiTile label="Médecins présents" value={String(activeProfIds.size)} />
        </div>
      )}

      {/* Planning par professionnel */}
      <Card className="p-s-4 flex flex-col gap-s-4">
        <h2 className="text-body font-semibold text-ink flex items-center gap-s-2">
          <CalendarDays className="h-4 w-4 text-primary" /> Planning du jour
        </h2>
        {loading && <Skeleton className="h-32 rounded-md" />}
        {!loading && totalCount === 0 && (
          <p className="text-small text-ink-3 text-center py-s-4">Aucun rendez-vous aujourd'hui</p>
        )}
        {Object.entries(byPro).map(([profId, appts]) => {
          const proName = appts[0]?.professionals?.profiles
            ? `Dr ${appts[0].professionals.profiles.first_name} ${appts[0].professionals.profiles.last_name}`
            : 'Professionnel'
          return (
            <div key={profId} className="flex flex-col gap-s-2">
              <div className="flex items-center justify-between">
                <span className="text-small font-semibold text-ink">{proName}</span>
                <span className="text-micro text-ink-3">{appts.length} RDV</span>
              </div>
              {appts.map(appt => {
                const time = appt.starts_at ? new Date(appt.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
                const patient = appt.patients?.profiles
                  ? `${appt.patients.profiles.first_name} ${appt.patients.profiles.last_name}`
                  : 'Patient'
                return (
                  <div key={appt.id} className="flex items-center gap-s-3 pl-s-3 border-l-2 border-line py-s-1">
                    <span className="text-small font-mono text-ink-3 w-12 shrink-0">{time}</span>
                    <span className="flex-1 text-small text-ink">{patient}</span>
                    <Badge variant={STATUS_VARIANTS[appt.status] ?? 'neutral'}>
                      {STATUS_LABELS[appt.status] ?? appt.status}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )
        })}
      </Card>

      {/* Équipe présente */}
      {professionals.length > 0 && (
        <Card className="p-s-4 flex flex-col gap-s-3">
          <h2 className="text-body font-semibold text-ink flex items-center gap-s-2">
            <Users className="h-4 w-4 text-primary" /> Équipe présente aujourd'hui
          </h2>
          <div className="flex flex-wrap gap-s-2">
            {professionals
              .filter(p => activeProfIds.has(p.professional_id))
              .map(p => {
                const name = p.professionals?.profiles
                  ? `Dr ${p.professionals.profiles.first_name} ${p.professionals.profiles.last_name}`
                  : 'Professionnel'
                return (
                  <Badge key={p.professional_id} variant="primary">{name}</Badge>
                )
              })}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-s-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/etab/professionnels')}>
          <UserPlus className="h-4 w-4 mr-s-1" /> Inviter un professionnel
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate('/etab/agenda')}>
          <ClipboardList className="h-4 w-4 mr-s-1" /> Proposer un planning
        </Button>
      </div>
    </div>
  )
}
