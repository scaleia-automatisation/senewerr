import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CalendarDays, Users, UserCheck,
  UserPlus, ClipboardList, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { KpiTile } from '@/components/ui/KpiTile'
import { supabase } from '@/lib/supabase'
import { containerVariants, itemVariants } from '@/lib/motion'
import { useEtabHealth } from './EtabHealthContext'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Constantes statut ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending:              'En attente',
  confirmed:            'Confirmé',
  payment_pending:      'Paiement en attente',
  paid:                 'Payé',
  patient_arrived:      'Arrivé',
  in_consultation:      'En consultation',
  completed:            'Terminé',
  rescheduled:          'Reprogrammé',
  cancelled_patient:    'Annulé (patient)',
  cancelled_professional: 'Annulé (pro)',
  cancelled_establishment: 'Annulé (étab.)',
  no_show:              'Absent',
}

const STATUS_VARIANTS: Record<string, 'neutral' | 'primary' | 'accent' | 'success' | 'pending' | 'danger'> = {
  confirmed:        'primary',
  payment_pending:  'pending',
  paid:             'primary',
  patient_arrived:  'success',
  in_consultation:  'accent',
  completed:        'neutral',
  pending:          'pending',
  no_show:          'danger',
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Appointment = {
  id: string
  starts_at: string
  status: string
  professional_id: string
  pro_name: string
  patient_name: string
}

type TeamMember = {
  professional_id: string
  name: string
}

// ── Sélecteur multi-site ───────────────────────────────────────────────────────

function OrgSelector() {
  const { establishmentName, organizations, setActiveOrg, orgId, theme } = useEtabHealth()
  const [open, setOpen] = useState(false)

  if (organizations.length <= 1) {
    return (
      <span className={`text-small font-medium px-s-2 py-s-1 rounded-full ${theme.bgClass} ${theme.textClass}`}>
        {theme.label}
      </span>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-s-1 text-small font-medium px-s-2 py-s-1 rounded-full ${theme.bgClass} ${theme.textClass}`}
      >
        {establishmentName}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-10 min-w-[180px] bg-surface border border-line rounded-md shadow-md py-s-1">
          {organizations.map(o => (
            <button
              key={o.orgId}
              onClick={() => { setActiveOrg(o.orgId); setOpen(false) }}
              className={`w-full text-left px-s-3 py-s-2 text-small hover:bg-bg ${o.orgId === orgId ? 'font-semibold text-primary' : 'text-ink'}`}
            >
              {o.orgName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export default function EtabHealthDashboard() {
  const navigate = useNavigate()
  const { establishmentId, establishmentName, theme, loading: ctxLoading } = useEtabHealth()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()
  const dateLabel  = format(today, 'EEEE d MMMM', { locale: fr })

  useEffect(() => {
    if (ctxLoading || !establishmentId) {
      if (!ctxLoading) setLoading(false)
      return
    }

    async function load() {
      const [apptRes, teamRes] = await Promise.all([
        (supabase as any)
          .from('appointments')
          .select(`
            id, starts_at, status, professional_id,
            professionals:professional_id(profiles(full_name)),
            patients:patient_id(profiles(full_name))
          `)
          .eq('establishment_id', establishmentId)
          .gte('starts_at', startOfDay)
          .lte('starts_at', endOfDay)
          .not('status', 'in', '("cancelled_patient","cancelled_professional","cancelled_establishment")')
          .order('starts_at'),

        (supabase as any)
          .from('professional_establishments')
          .select('professional_id, professionals:professional_id(profiles(full_name))')
          .eq('establishment_id', establishmentId)
          .eq('status', 'active'),
      ])

      const rawAppts: any[] = apptRes.data ?? []
      const rawTeam: any[]  = teamRes.data ?? []

      setAppointments(rawAppts.map(a => ({
        id:              a.id,
        starts_at:       a.starts_at,
        status:          a.status,
        professional_id: a.professional_id,
        pro_name:        a.professionals?.profiles?.full_name ?? 'Professionnel',
        patient_name:    a.patients?.profiles?.full_name ?? 'Patient',
      })))

      setTeam(rawTeam.map(t => ({
        professional_id: t.professional_id,
        name:            t.professionals?.profiles?.full_name ?? 'Professionnel',
      })))

      setLoading(false)
    }

    load()
  }, [establishmentId, ctxLoading])

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const totalAppts    = appointments.length
  const arrivedCount  = appointments.filter(a => a.status === 'patient_arrived').length
  const inConsultCount = appointments.filter(a => a.status === 'in_consultation').length
  const activeProfIds = new Set(appointments.map(a => a.professional_id))

  // ── Grouper par professionnel ────────────────────────────────────────────────

  const byPro = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    if (!acc[a.professional_id]) acc[a.professional_id] = []
    acc[a.professional_id].push(a)
    return acc
  }, {})

  // ── Rendu ────────────────────────────────────────────────────────────────────

  if (ctxLoading) {
    return (
      <div className="flex flex-col gap-s-6 p-s-4 md:p-s-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-s-3">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    )
  }

  if (!establishmentId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-s-3 text-ink-3">
        <p className="text-body">Aucun établissement associé à votre compte.</p>
        <p className="text-small">Contactez l'administrateur de votre organisation.</p>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className="flex flex-col gap-s-6 p-s-4 md:p-s-6 max-w-5xl mx-auto"
    >
      {/* En-tête */}
      <motion.div variants={itemVariants} className="flex flex-col gap-s-1">
        <div className="flex items-center gap-s-3 flex-wrap">
          <h1 className="text-h2 font-display font-bold text-ink">{establishmentName}</h1>
          <OrgSelector />
        </div>
        <p className="text-small text-ink-3 capitalize">{dateLabel}</p>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-s-3">
        {loading ? (
          [0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-md" />)
        ) : (
          <>
            <KpiTile label="RDV du jour"         value={String(totalAppts)} />
            <KpiTile label="Arrivés / Attendus"  value={`${arrivedCount} / ${totalAppts}`} />
            <KpiTile label="En consultation"      value={String(inConsultCount)} />
            <KpiTile label="Équipe présente"      value={String(activeProfIds.size)} />
          </>
        )}
      </motion.div>

      {/* Planning du jour */}
      <motion.div variants={itemVariants}>
        <Card className="p-s-4 flex flex-col gap-s-4">
          <h2 className="text-body font-semibold text-ink flex items-center gap-s-2">
            <CalendarDays className={`h-4 w-4 ${theme.textClass}`} />
            Planning du jour
          </h2>

          {loading && <Skeleton className="h-32 rounded-md" />}

          {!loading && totalAppts === 0 && (
            <p className="text-small text-ink-3 text-center py-s-4">Aucun rendez-vous aujourd'hui</p>
          )}

          {!loading && Object.entries(byPro).map(([profId, appts]) => (
            <div key={profId} className="flex flex-col gap-s-2">
              <div className="flex items-center justify-between">
                <span className="text-small font-semibold text-ink">
                  {appts[0]?.pro_name}
                </span>
                <span className="text-micro text-ink-3">{appts.length} RDV</span>
              </div>
              {appts.map(appt => {
                const time = appt.starts_at
                  ? format(new Date(appt.starts_at), 'HH:mm')
                  : '--:--'
                return (
                  <div
                    key={appt.id}
                    className={`flex items-center gap-s-3 pl-s-3 border-l-2 ${theme.borderClass} py-s-1`}
                  >
                    <span className="text-small font-mono text-ink-3 w-12 shrink-0">{time}</span>
                    <span className="flex-1 text-small text-ink">{appt.patient_name}</span>
                    <Badge variant={STATUS_VARIANTS[appt.status] ?? 'neutral'}>
                      {STATUS_LABELS[appt.status] ?? appt.status}
                    </Badge>
                  </div>
                )
              })}
            </div>
          ))}
        </Card>
      </motion.div>

      {/* Équipe présente */}
      {!loading && team.filter(t => activeProfIds.has(t.professional_id)).length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="p-s-4 flex flex-col gap-s-3">
            <h2 className="text-body font-semibold text-ink flex items-center gap-s-2">
              <Users className={`h-4 w-4 ${theme.textClass}`} />
              Équipe présente aujourd'hui
            </h2>
            <div className="flex flex-wrap gap-s-2">
              {team
                .filter(t => activeProfIds.has(t.professional_id))
                .map(t => (
                  <Badge key={t.professional_id} variant="primary">{t.name}</Badge>
                ))
              }
            </div>
          </Card>
        </motion.div>
      )}

      {/* Actions rapides */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-s-3">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<UserPlus className="h-4 w-4" />}
          onClick={() => navigate('/etab-health/equipe')}
        >
          Inviter un professionnel
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<ClipboardList className="h-4 w-4" />}
          onClick={() => navigate('/etab-health/patients')}
        >
          Voir les patients
        </Button>
      </motion.div>
    </motion.div>
  )
}
