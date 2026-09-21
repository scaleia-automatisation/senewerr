import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion } from 'framer-motion'
import {
  Power, FileText, Package, ShoppingBag, Users, TrendingUp,
  Clock, AlertTriangle, Pill, Truck,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { usePharmacy } from './PharmacyContext'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

interface Kpis {
  ordTraitees: number
  caJour: number
  patientsServis: number
  medicamentsDispenses: number
}

interface OrdEnAttente {
  id: string
  patient_id: string
  created_at: string
  nb_medicaments: number | null
  priorite: string | null
  patient?: { full_name: string } | null
}

interface StockAlerte {
  id: string
  medicament_nom: string
  quantite: number
  seuil_alerte: number
}

interface ActivityItem {
  id: string
  type: 'dispensation' | 'commande'
  label: string
  time: string
  meta: string
}

function maskRef(patientId: string, fullName?: string | null): string {
  if (fullName && fullName.length >= 3) {
    const parts = fullName.split(' ')
    const prenom = parts[0].slice(0, 4)
    const initiale = parts[1]?.[0] ? parts[1][0] + '.' : ''
    return `${prenom}** ${initiale}`.trim()
  }
  return `P-${patientId.slice(0, 6).toUpperCase()}`
}

function formatFCFA(n: number): string {
  return new Intl.NumberFormat('fr-SN').format(n) + ' FCFA'
}

function todayBounds() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const start = d.toISOString()
  d.setHours(23, 59, 59, 999)
  return { start, end: d.toISOString() }
}

const DAY_KEYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.2 } }),
}

export default function PharmacyHomePage() {
  const { profile } = useAuth()
  const { pharmacie, loading: pharmLoading, toggleEnService } = usePharmacy()
  const navigate = useNavigate()
  const db = supabase as any

  const [now, setNow] = useState(new Date())
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [loadingKpis, setLoadingKpis] = useState(true)
  const [queue, setQueue] = useState<OrdEnAttente[]>([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [stockAlertes, setStockAlertes] = useState<StockAlerte[]>([])
  const [loadingStock, setLoadingStock] = useState(true)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loadingActivity, setLoadingActivity] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchKpis = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoadingKpis(true)
    const { start, end } = todayBounds()
    const pharmId = pharmacie.id

    const [dispCountRes, paiRes, dispFullRes] = await Promise.all([
      db.from('dispensations')
        .select('*', { count: 'exact', head: true })
        .eq('pharmacie_id', pharmId)
        .gte('date_dispensation', start)
        .lte('date_dispensation', end),
      db.from('paiements')
        .select('montant')
        .eq('pharmacie_id', pharmId)
        .gte('created_at', start)
        .lte('created_at', end),
      db.from('dispensations')
        .select('patient_id, medicaments_delivres')
        .eq('pharmacie_id', pharmId)
        .gte('date_dispensation', start)
        .lte('date_dispensation', end),
    ])

    const caJour = (paiRes.data ?? []).reduce((s: number, p: any) => s + (p.montant ?? 0), 0)
    const allDisp: any[] = dispFullRes.data ?? []
    const patients = new Set(allDisp.map((d) => d.patient_id))
    const medsCount = allDisp.reduce((s, d) => {
      const arr = Array.isArray(d.medicaments_delivres) ? d.medicaments_delivres : []
      return s + arr.length
    }, 0)

    setKpis({
      ordTraitees: dispCountRes.count ?? 0,
      caJour,
      patientsServis: patients.size,
      medicamentsDispenses: medsCount,
    })
    setLoadingKpis(false)
  }, [pharmacie?.id])

  useEffect(() => {
    fetchKpis()
    const t = setInterval(fetchKpis, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchKpis])

  const fetchQueue = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoadingQueue(true)
    const { data } = await db
      .from('ordonnances_soumises')
      .select('id, patient_id, created_at, nb_medicaments, priorite, patient:profiles!patient_id(full_name)')
      .eq('pharmacie_id', pharmacie.id)
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: true })
    setQueue(data ?? [])
    setLoadingQueue(false)
  }, [pharmacie?.id])

  useEffect(() => {
    fetchQueue()
    if (!pharmacie?.id) return
    const channel = supabase
      .channel(`home-queue-${pharmacie.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'ordonnances_soumises',
        filter: `pharmacie_id=eq.${pharmacie.id}`,
      }, () => fetchQueue())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [pharmacie?.id, fetchQueue])

  const fetchStock = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoadingStock(true)
    const { data } = await db
      .from('stock_medicaments')
      .select('id, medicament_nom, quantite, seuil_alerte')
      .eq('pharmacie_id', pharmacie.id)
      .is('deleted_at', null)
      .order('quantite', { ascending: true })
      .limit(50)
    const alertes: StockAlerte[] = (data ?? []).filter(
      (item: any) => typeof item.seuil_alerte === 'number' && item.quantite <= item.seuil_alerte
    ).slice(0, 5)
    setStockAlertes(alertes)
    setLoadingStock(false)
  }, [pharmacie?.id])

  useEffect(() => { fetchStock() }, [fetchStock])

  const fetchActivity = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoadingActivity(true)
    const [dispRes, cmdRes] = await Promise.all([
      db.from('dispensations')
        .select('id, date_dispensation, medicaments_delivres, montant_total')
        .eq('pharmacie_id', pharmacie.id)
        .order('date_dispensation', { ascending: false })
        .limit(10),
      db.from('commandes_fournisseurs')
        .select('id, reference, statut, created_at')
        .eq('pharmacie_id', pharmacie.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const dispItems: ActivityItem[] = (dispRes.data ?? []).map((d: any) => ({
      id: `d-${d.id}`,
      type: 'dispensation' as const,
      label: `Dispensation — ${Array.isArray(d.medicaments_delivres) ? d.medicaments_delivres.length : '?'} méd.`,
      time: d.date_dispensation,
      meta: d.montant_total ? formatFCFA(d.montant_total) : '',
    }))
    const cmdItems: ActivityItem[] = (cmdRes.data ?? []).map((c: any) => ({
      id: `c-${c.id}`,
      type: 'commande' as const,
      label: `Commande ${c.reference ?? '—'}`,
      time: c.created_at,
      meta: c.statut ?? '',
    }))
    const all = [...dispItems, ...cmdItems]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 12)
    setActivity(all)
    setLoadingActivity(false)
  }, [pharmacie?.id])

  useEffect(() => { fetchActivity() }, [fetchActivity])

  async function handleToggle() {
    setToggling(true)
    const goingOffline = pharmacie?.en_service === true
    await toggleEnService()
    if (goingOffline && pharmacie?.id) {
      try {
        await supabase.functions.invoke('notify-patients-pharmacy-offline', {
          body: { pharmacie_id: pharmacie.id },
        })
      } catch { /* non-bloquant */ }
    }
    setToggling(false)
  }

  if (pharmLoading) {
    return (
      <div className="flex flex-col gap-s-4">
        <Skeleton className="h-28 rounded-lg" />
        <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      </div>
    )
  }

  const todayKey = DAY_KEYS[now.getDay()]
  const horairesToday = (pharmacie as any)?.horaires?.[todayKey]
  const prenom = (profile?.full_name ?? '').split(' ')[0] || 'Dr'

  const shortcuts = [
    { icon: '💊', label: 'Scanner une ordonnance', to: '/pharmacie/ordonnances?action=scanner' },
    { icon: '📦', label: 'Réceptionner une livraison', to: '/pharmacie/commandes?action=reception' },
    { icon: '🔍', label: 'Rechercher un médicament', to: '/pharmacie/stock?action=rechercher' },
    { icon: '📊', label: 'Rapport du jour', to: '/pharmacie/rapports?type=jour' },
  ]

  return (
    <div className="flex flex-col gap-s-6 pb-s-8">

      {/* 1 — Widget bienvenue */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-lg border border-line bg-surface p-s-5"
      >
        <div className="flex flex-col gap-s-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-s-1">
            <h1 className="font-display text-h1 font-semibold text-ink">
              Bonjour {prenom} 👋
            </h1>
            <p className="text-small font-medium text-ink-2">{pharmacie?.nom ?? '—'}</p>
            <p className="text-micro text-ink-3">
              {format(now, "EEEE d MMMM yyyy '–' HH:mm:ss", { locale: fr })}
            </p>
            {horairesToday && (
              <p className="mt-s-1 flex items-center gap-s-1 text-micro text-ink-3">
                <Clock className="h-3.5 w-3.5" />
                Aujourd'hui :{' '}
                {typeof horairesToday === 'string'
                  ? horairesToday
                  : `${horairesToday.ouverture ?? ''} – ${horairesToday.fermeture ?? ''}`}
              </p>
            )}
          </div>
          <div className="flex flex-col items-start gap-s-2 sm:items-end">
            <div className="flex items-center gap-s-2">
              <span className={`h-3 w-3 rounded-full ${pharmacie?.en_service ? 'bg-primary animate-pulse' : 'bg-status-danger'}`} />
              <span className="text-small font-medium text-ink">
                {pharmacie?.en_service ? 'En service' : 'Hors service'}
              </span>
            </div>
            <Button
              size="sm"
              variant={pharmacie?.en_service ? 'secondary' : 'primary'}
              leftIcon={<Power className="h-4 w-4" />}
              onClick={handleToggle}
              loading={toggling}
            >
              {pharmacie?.en_service ? 'Passer hors service' : 'Mettre en service'}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* 2 — KPIs du jour */}
      <div>
        <div className="mb-s-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Aujourd'hui</h2>
          {!loadingKpis && (
            <button
              onClick={fetchKpis}
              className="text-micro text-ink-3 hover:text-ink transition-colors"
            >
              ↻ Actualiser
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-4">
          {loadingKpis
            ? [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)
            : ([
                {
                  label: 'Ordonnances traitées',
                  value: kpis?.ordTraitees ?? 0,
                  icon: <FileText className="h-5 w-5" />,
                  color: 'text-primary',
                  bg: 'bg-primary/10',
                  fmt: (v: number) => String(v),
                },
                {
                  label: 'CA du jour',
                  value: kpis?.caJour ?? 0,
                  icon: <TrendingUp className="h-5 w-5" />,
                  color: 'text-green-600 dark:text-green-400',
                  bg: 'bg-green-50 dark:bg-green-900/20',
                  fmt: formatFCFA,
                },
                {
                  label: 'Patients servis',
                  value: kpis?.patientsServis ?? 0,
                  icon: <Users className="h-5 w-5" />,
                  color: 'text-blue-600 dark:text-blue-400',
                  bg: 'bg-blue-50 dark:bg-blue-900/20',
                  fmt: (v: number) => String(v),
                },
                {
                  label: 'Médicaments dispensés',
                  value: kpis?.medicamentsDispenses ?? 0,
                  icon: <Pill className="h-5 w-5" />,
                  color: 'text-ink-2',
                  bg: 'bg-surface-2',
                  fmt: (v: number) => String(v),
                },
              ] as const).map((k, i) => (
                <motion.div
                  key={k.label}
                  custom={i}
                  initial="hidden"
                  animate="show"
                  variants={fade}
                  className="flex flex-col gap-s-3 rounded-lg border border-line bg-surface p-s-4"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-md ${k.bg} ${k.color}`}>
                    {k.icon}
                  </div>
                  <div>
                    <p className={`font-display text-h2 font-semibold truncate ${k.color}`}>
                      {k.fmt(k.value)}
                    </p>
                    <p className="text-micro text-ink-3 leading-tight mt-s-0.5">{k.label}</p>
                  </div>
                </motion.div>
              ))}
        </div>
      </div>

      {/* 3 — File d'attente */}
      <div className="rounded-lg border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-s-4 py-s-3">
          <h2 className="flex items-center gap-s-2 font-semibold text-ink">
            <Clock className="h-5 w-5 text-primary" />
            File d'attente
            {queue.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-status-danger text-micro font-bold text-white">
                {queue.length > 9 ? '9+' : queue.length}
              </span>
            )}
          </h2>
          <Link to="/pharmacie/ordonnances" className="text-small text-primary hover:underline">
            Voir tout →
          </Link>
        </div>

        {loadingQueue ? (
          <div className="flex flex-col gap-s-2 p-s-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}
          </div>
        ) : queue.length === 0 ? (
          <p className="px-s-4 py-s-6 text-center text-small text-ink-3">
            Aucune ordonnance en attente ✓
          </p>
        ) : (
          <div className="divide-y divide-line">
            {queue.slice(0, 5).map(ord => (
              <div key={ord.id} className="flex items-center gap-s-3 px-s-4 py-s-3">
                {ord.priorite === 'urgente' && (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-status-danger" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-small font-medium text-ink">
                    {maskRef(ord.patient_id, (ord as any).patient?.full_name)}
                  </p>
                  <p className="text-micro text-ink-3">
                    {formatDistanceToNow(new Date(ord.created_at), { addSuffix: true, locale: fr })}
                    {ord.nb_medicaments != null && ` · ${ord.nb_medicaments} méd.`}
                    {ord.priorite === 'urgente' && (
                      <span className="ml-s-1 font-medium text-status-danger"> URGENT</span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/pharmacie/ordonnances?id=${ord.id}`)}
                >
                  Traiter
                </Button>
              </div>
            ))}
            {queue.length > 5 && (
              <Link
                to="/pharmacie/ordonnances"
                className="block px-s-4 py-s-3 text-small text-primary hover:bg-surface-2"
              >
                + {queue.length - 5} autres en attente
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 4 — Alertes stock */}
      <div className="rounded-lg border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-s-4 py-s-3">
          <h2 className="flex items-center gap-s-2 font-semibold text-ink">
            <AlertTriangle className="h-5 w-5 text-status-warning" />
            Alertes stock
          </h2>
          <Link to="/pharmacie/stock?filtre=alerte" className="text-small text-primary hover:underline">
            Voir tous →
          </Link>
        </div>

        {loadingStock ? (
          <div className="flex flex-col gap-s-2 p-s-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-md" />)}
          </div>
        ) : stockAlertes.length === 0 ? (
          <p className="px-s-4 py-s-6 text-center text-small text-ink-3">
            Aucune alerte stock ✓
          </p>
        ) : (
          <div className="divide-y divide-line">
            {stockAlertes.map(item => (
              <div key={item.id} className="flex items-center gap-s-3 px-s-4 py-s-3">
                <Package className="h-4 w-4 shrink-0 text-status-warning" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-small font-medium text-ink">{item.medicament_nom}</p>
                  <p className="text-micro text-status-danger">
                    {item.quantite} en stock · seuil : {item.seuil_alerte}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<ShoppingBag className="h-4 w-4" />}
                  onClick={() => navigate(`/pharmacie/commandes?medicament_id=${item.id}`)}
                >
                  Commander
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5 — Activité récente */}
      <div className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-s-4 py-s-3">
          <h2 className="font-semibold text-ink">Activité récente</h2>
        </div>
        {loadingActivity ? (
          <div className="flex flex-col gap-s-2 p-s-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 rounded-md" />)}
          </div>
        ) : activity.length === 0 ? (
          <p className="px-s-4 py-s-6 text-center text-small text-ink-3">Aucune activité</p>
        ) : (
          <div className="divide-y divide-line">
            {activity.map(item => (
              <div key={item.id} className="flex items-center gap-s-3 px-s-4 py-s-3">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro ${
                  item.type === 'dispensation'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-status-warning/10 text-status-warning'
                }`}>
                  {item.type === 'dispensation'
                    ? <Pill className="h-3.5 w-3.5" />
                    : <Truck className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-small text-ink">{item.label}</p>
                  <p className="text-micro text-ink-3">
                    {formatDistanceToNow(new Date(item.time), { addSuffix: true, locale: fr })}
                  </p>
                </div>
                {item.meta && (
                  <span className="shrink-0 text-micro text-ink-3">{item.meta}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6 — Raccourcis rapides */}
      <div>
        <h2 className="mb-s-3 font-semibold text-ink">Raccourcis rapides</h2>
        <div className="grid grid-cols-2 gap-s-3">
          {shortcuts.map(s => (
            <Link
              key={s.to}
              to={s.to}
              className="flex items-center gap-s-3 rounded-lg border border-line bg-surface px-s-4 py-s-3 text-small font-medium text-ink transition-colors hover:bg-surface-2"
            >
              <span className="shrink-0 text-base">{s.icon}</span>
              <span className="truncate">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
