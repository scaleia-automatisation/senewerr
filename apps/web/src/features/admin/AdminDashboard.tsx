import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle, Clock, Shield, Users, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { KpiTile } from '@/components/ui/KpiTile'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Banner } from '@/components/ui/Banner'

const todayStart = () => new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
const fmt = (d: string) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

interface AdminTodos {
  pros: number
  pharmacies: number
  mutuelles: number
  patient_payments: number
  mutual_payments: number
  coverage_overdue: number
  disputes: number
  orders_blocked: number
}

interface PlatformActivity {
  appointments: number
  reservations: number
  prescriptions: number
}

interface SecurityEvent {
  id: string
  created_at: string
  event_type?: string
  description?: string
  severity?: string
}

export default function AdminDashboard() {
  const { profile } = useAuth()

  const [todos, setTodos] = useState<AdminTodos>({ pros: 0, pharmacies: 0, mutuelles: 0, patient_payments: 0, mutual_payments: 0, coverage_overdue: 0, disputes: 0, orders_blocked: 0 })
  const [todosLoading, setTodosLoading] = useState(true)
  const [activity, setActivity] = useState<PlatformActivity>({ appointments: 0, reservations: 0, prescriptions: 0 })
  const [activityLoading, setActivityLoading] = useState(true)
  const [alerts, setAlerts] = useState<SecurityEvent[]>([])
  const [alertsLoading, setAlertsLoading] = useState(true)

  useEffect(() => {
    const cutoff24h = new Date(Date.now() - 86400000).toISOString()
    const cutoff48h = new Date(Date.now() - 172800000).toISOString()

    Promise.all([
      supabase.from('professionals').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('type', 'pharmacy').eq('verification_status', 'pending'),
      supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('type', 'mutual').eq('verification_status', 'pending'),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', cutoff24h),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', cutoff48h),
      supabase.from('coverage_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', cutoff24h),
      Promise.resolve({ count: 0, error: null }),
      supabase.from('pharmacy_reservations').select('id', { count: 'exact', head: true }).eq('status', 'accepted').lt('created_at', cutoff48h),
    ]).then(([pros, pharmacies, mutuelles, patient_pay, mutual_pay, coverage, disputes, orders]) => {
      setTodos({
        pros: pros.count ?? 0,
        pharmacies: pharmacies.count ?? 0,
        mutuelles: mutuelles.count ?? 0,
        patient_payments: patient_pay.count ?? 0,
        mutual_payments: mutual_pay.count ?? 0,
        coverage_overdue: coverage.count ?? 0,
        disputes: (disputes as any)?.count ?? 0,
        orders_blocked: orders.count ?? 0,
      })
      setTodosLoading(false)
    })
  }, [])

  useEffect(() => {
    const start = todayStart()
    Promise.all([
      supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('created_at', start),
      supabase.from('pharmacy_reservations').select('id', { count: 'exact', head: true }).gte('created_at', start),
      supabase.from('prescriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('created_at', start),
    ]).then(([appts, reservs, prescr]) => {
      setActivity({ appointments: appts.count ?? 0, reservations: reservs.count ?? 0, prescriptions: prescr.count ?? 0 })
      setActivityLoading(false)
    })
  }, [])

  useEffect(() => {
    ;(supabase as any).from('security_events').select('id, created_at, event_type, description, severity').order('created_at', { ascending: false }).limit(5)
      .then(({ data }: any) => { setAlerts(data ?? []); setAlertsLoading(false) })
      .catch(() => setAlertsLoading(false))
  }, [])

  const alertSeverityVariant = (s?: string): 'danger' | 'pending' | 'neutral' => {
    if (s === 'critical' || s === 'high') return 'danger'
    if (s === 'medium') return 'pending'
    return 'neutral'
  }

  const todoTiles = [
    { label: 'Professionnels à vérifier', value: todos.pros, variant: todos.pros > 0 ? 'warning' : 'default', href: '/admin/verifications?type=professional', icon: Users },
    { label: 'Pharmacies à vérifier', value: todos.pharmacies, variant: todos.pharmacies > 0 ? 'warning' : 'default', href: '/admin/verifications?type=pharmacy', icon: Building2 },
    { label: 'Mutuelles à vérifier', value: todos.mutuelles, variant: todos.mutuelles > 0 ? 'warning' : 'default', href: '/admin/verifications?type=insurance', icon: Shield },
    { label: 'Paiements patients en attente', value: todos.patient_payments, variant: todos.patient_payments > 0 ? 'warning' : 'default', href: '/admin/abonnements?type=patient', icon: Clock },
    { label: 'Paiements mutuelles en attente', value: todos.mutual_payments, variant: todos.mutual_payments > 0 ? 'warning' : 'default', href: '/admin/abonnements?type=mutual', icon: Clock },
    { label: 'Dossiers PEC > 24h', value: todos.coverage_overdue, variant: todos.coverage_overdue > 0 ? 'danger' : 'default', href: '/admin/pharmacies?overdue=1', icon: AlertTriangle },
    { label: 'Litiges ouverts', value: todos.disputes, variant: todos.disputes > 0 ? 'danger' : 'default', href: '/admin/litiges', icon: AlertTriangle },
    { label: 'Commandes bloquées (48h)', value: todos.orders_blocked, variant: todos.orders_blocked > 0 ? 'danger' : 'default', href: '/admin/pharmacies?blocked=1', icon: AlertTriangle },
  ] as const

  return (
    <div className="flex flex-col gap-s-5 p-s-4">
      <div>
        <h1 className="text-h2 font-display text-ink">Centre de contrôle Admin</h1>
        <p className="text-sm text-ink-3">Vue plateforme — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">À traiter maintenant</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-s-3">
          {todosLoading
            ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)
            : todoTiles.map(t => (
                <Link key={t.label} to={t.href}>
                  <KpiTile label={t.label} value={String(t.value)} variant={t.variant as any} />
                </Link>
              ))
          }
        </div>
      </section>

      <section>
        <div className="border-t border-line pt-s-4">
          <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">Activité plateforme — aujourd'hui</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-s-3">
            {activityLoading
              ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)
              : <>
                  <KpiTile label="RDV aujourd'hui" value={String(activity.appointments)} subtext="Créés depuis minuit" />
                  <KpiTile label="Réservations aujourd'hui" value={String(activity.reservations)} subtext="Nouvelles réservations" variant={activity.reservations > 0 ? 'success' : 'default'} />
                  <KpiTile label="Ordonnances actives" value={String(activity.prescriptions)} subtext="Aujourd'hui" variant={activity.prescriptions > 0 ? 'success' : 'default'} />
                </>
            }
          </div>
        </div>
      </section>

      <section>
        <div className="border-t border-line pt-s-4">
          <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">Alertes sécurité récentes</h2>
          {alertsLoading
            ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)
            : alerts.length === 0
              ? (
                <Card className="p-s-4 flex items-center gap-s-3">
                  <CheckCircle className="w-5 h-5 text-status-success shrink-0" />
                  <span className="text-ink-2 text-sm">Aucune alerte sécurité récente</span>
                </Card>
              )
              : (
                <div className="flex flex-col gap-s-2">
                  {alerts.map(a => (
                    <Card key={a.id} className="p-s-3">
                      <div className="flex items-start justify-between gap-s-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-s-2">
                            <Badge variant={alertSeverityVariant(a.severity)}>{a.event_type ?? 'SECURITY_EVENT'}</Badge>
                            <span className="text-xs text-ink-3">{fmt(a.created_at)}</span>
                          </div>
                          {a.description && <p className="text-sm text-ink-2 truncate">{a.description}</p>}
                        </div>
                        {a.severity && (
                          <span className={`text-xs font-semibold shrink-0 ${a.severity === 'critical' ? 'text-status-danger' : a.severity === 'high' ? 'text-status-warning' : 'text-ink-3'}`}>
                            {a.severity.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )
          }
        </div>
      </section>

      {!profile && (
        <Banner kind="warning">Profil non chargé — vérifiez votre session</Banner>
      )}
    </div>
  )
}
