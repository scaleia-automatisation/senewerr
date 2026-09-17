import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Calendar, UserCheck, FileText, Zap, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
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
  cancelled_patient: 'Annulé',
  cancelled_professional: 'Annulé',
  no_show: 'Absent',
}

const STATUS_VARIANTS: Record<string, 'neutral' | 'primary' | 'accent' | 'success' | 'pending' | 'danger'> = {
  confirmed: 'primary',
  patient_arrived: 'success',
  in_consultation: 'accent',
  completed: 'neutral',
  cancelled_patient: 'danger',
  cancelled_professional: 'danger',
  no_show: 'danger',
}

type Appointment = {
  id: string
  starts_at: string
  status: string
  professional_id: string
  patients: { profiles: { first_name: string; last_name: string } } | null
}

type Wallet = { plan_credits: number; plan_credits_total: number; purchased_credits: number }

export default function ProfessionalDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [draftCount, setDraftCount] = useState(0)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString()
  const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString()
  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    if (!profile) return
    const profId = (profile as Record<string, unknown>).professional_id as string ?? profile.id

    async function load() {
      const [apptRes, draftRes, walletRes] = await Promise.all([
        (supabase as any)
          .from('appointments')
          .select('id, starts_at, status, professional_id, patients:patient_id(profiles(first_name, last_name))')
          .eq('professional_id', profId)
          .gte('starts_at', startOfDay)
          .lte('starts_at', endOfDay)
          .order('starts_at'),
        (supabase as any)
          .from('prescriptions')
          .select('id')
          .eq('professional_id', profId)
          .eq('status', 'draft')
          .limit(20),
        (supabase as any)
          .from('credit_wallets')
          .select('plan_credits, plan_credits_total, purchased_credits')
          .eq('profile_id', profile!.id)
          .maybeSingle(),
      ])
      setAppointments((apptRes.data ?? []) as Appointment[])
      setDraftCount(draftRes.data?.length ?? 0)
      setWallet(walletRes.data ?? null)
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('pro-appts-today')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  const arrivedCount = appointments.filter(a => a.status === 'patient_arrived').length
  const totalCredits = wallet ? wallet.plan_credits_total + wallet.purchased_credits : 0
  const usedCredits = wallet ? wallet.plan_credits_total - wallet.plan_credits : 0
  const creditPct = totalCredits > 0 ? Math.round((usedCredits / totalCredits) * 100) : 0
  const lowCredit = wallet ? wallet.plan_credits / Math.max(wallet.plan_credits_total, 1) < 0.1 : false

  const firstName = (profile as any)?.first_name ?? ''
  const lastName = (profile as any)?.last_name ?? ''

  return (
    <div className="flex flex-col gap-s-6 p-s-4 md:p-s-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-h2 font-display font-bold text-ink">Bonjour Dr {firstName} {lastName}</h1>
        <p className="text-small text-ink-3 capitalize">{dateLabel}</p>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-3 gap-s-3">
          {[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-s-3">
          <KpiTile label="Patients attendus" value={String(appointments.length)} />
          <KpiTile label="Arrivés" value={String(arrivedCount)} />
          <KpiTile label="Ordonnances à finaliser" value={String(draftCount)} />
        </div>
      )}

      {/* Planning du jour */}
      <Card className="p-s-4 flex flex-col gap-s-3">
        <div className="flex items-center justify-between">
          <h2 className="text-body font-semibold text-ink flex items-center gap-s-2">
            <Calendar className="h-4 w-4 text-primary" /> Planning du jour
          </h2>
          <Link to="/pro/agenda" className="text-small text-primary hover:underline">Voir l'agenda</Link>
        </div>
        {loading && <Skeleton className="h-16 rounded-md" />}
        {!loading && appointments.length === 0 && (
          <p className="text-small text-ink-3 text-center py-s-4">Aucun rendez-vous aujourd'hui</p>
        )}
        {appointments.map(appt => {
          const time = appt.starts_at ? new Date(appt.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
          const patientName = appt.patients?.profiles
            ? `${appt.patients.profiles.first_name} ${appt.patients.profiles.last_name}`
            : 'Patient inconnu'
          return (
            <div key={appt.id} className="flex items-center gap-s-3 py-s-2 border-b border-line last:border-0">
              <span className="text-small font-mono text-ink-3 w-12 shrink-0">{time}</span>
              <span className="flex-1 text-body text-ink">{patientName}</span>
              <Badge variant={STATUS_VARIANTS[appt.status] ?? 'neutral'}>
                {STATUS_LABELS[appt.status] ?? appt.status}
              </Badge>
              {appt.status === 'patient_arrived' ? (
                <Button size="sm" onClick={() => navigate(`/pro/consultation/${appt.id}`)}>
                  Commencer
                </Button>
              ) : (
                <Link to={`/pro/consultation/${appt.id}`} className="text-small text-primary hover:underline">Voir</Link>
              )}
            </div>
          )
        })}
      </Card>

      {/* Crédits IA */}
      {wallet && (
        <Card className="p-s-4 flex flex-col gap-s-3">
          <h2 className="text-body font-semibold text-ink flex items-center gap-s-2">
            <Zap className="h-4 w-4 text-accent" /> Crédits IA
          </h2>
          {lowCredit && (
            <Banner kind="warning">Moins de 10 % de crédits IA restants. <Link to="/pro/abonnement" className="underline">Recharger</Link></Banner>
          )}
          <div className="flex flex-col gap-s-1">
            <div className="flex justify-between text-small text-ink-3">
              <span>{usedCredits} utilisés</span>
              <span>{totalCredits} total</span>
            </div>
            <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${creditPct > 90 ? 'bg-status-danger' : creditPct > 70 ? 'bg-status-warning' : 'bg-primary'}`}
                style={{ width: `${creditPct}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-s-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/pro/agenda')}>
          <Plus className="h-4 w-4 mr-s-1" /> Ajouter un créneau
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate('/pro/ordonnances/nouvelle')}>
          <FileText className="h-4 w-4 mr-s-1" /> Nouvelle ordonnance
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate('/pro/agenda')}>
          <UserCheck className="h-4 w-4 mr-s-1" /> Ajouter une absence
        </Button>
      </div>
    </div>
  )
}
