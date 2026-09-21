import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  startOfWeek, startOfMonth, startOfDay, endOfDay, parseISO, format,
  addMonths,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Banknote, Clock, TrendingUp, ArrowDownCircle, Percent,
  Search, Download, RefreshCw, Bell, ChevronRight,
  AlertTriangle, MessageSquare, CheckCircle2, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { usePharmacy } from './PharmacyContext'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type ModePaiement = 'wave' | 'orange_money' | 'carte' | 'especes' | 'mutuelle_tiers_payant'
type StatutPaiement = 'en_attente' | 'paye' | 'rembourse' | 'litige'
type PeriodKey = 'semaine' | 'mois' | 'trimestre' | 'custom'
type TabKey = 'apercu' | 'attente' | 'historique' | 'mutuelle' | 'reversements' | 'litiges'

interface Paiement {
  id: string
  dispensation_id: string | null
  patient_id: string
  montant: number
  montant_rembourse_mutuelle: number | null
  reste_a_charge_patient: number | null
  mode_paiement: ModePaiement | null
  statut: StatutPaiement
  date_paiement: string | null
  stripe_payment_intent_id: string | null
  reference_tiers_payant: string | null
  patient_name?: string
  created_at?: string
}

interface Reversement {
  id: string
  periode: string
  montant_brut: number
  commission_plateforme: number
  montant_net: number
  statut: string
  date_reversement: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  wave: 'Wave', orange_money: 'Orange Money', carte: 'Carte bancaire',
  especes: 'Espèces', mutuelle_tiers_payant: 'Tiers payant',
}
const MODE_BADGES: Record<string, string> = {
  wave: 'bg-blue-100 text-blue-700', orange_money: 'bg-orange-100 text-orange-700',
  carte: 'bg-purple-100 text-purple-700', especes: 'bg-green-100 text-green-700',
  mutuelle_tiers_payant: 'bg-teal-100 text-teal-700',
}
const STATUT_BADGES: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  paye: 'bg-green-100 text-green-700',
  rembourse: 'bg-teal-100 text-teal-700',
  litige: 'bg-red-100 text-red-700',
}
const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente', paye: 'Payé', rembourse: 'Remboursé', litige: 'Litige',
}
const TAB_LABELS: Record<TabKey, string> = {
  apercu: 'Aperçu', attente: 'En attente', historique: 'Historique',
  mutuelle: 'Tiers payant', reversements: 'Reversements', litiges: 'Litiges',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(Math.round(n)) + ' FCFA'
}

function maskPatient(id: string) {
  return `P-${id.slice(0, 6).toUpperCase()}`
}

function getPeriodBounds(period: PeriodKey, custom: { start: string; end: string }) {
  const now = new Date()
  if (period === 'semaine') return {
    start: startOfDay(startOfWeek(now, { weekStartsOn: 1 })).toISOString(),
    end: endOfDay(now).toISOString(),
  }
  if (period === 'mois') return {
    start: startOfDay(startOfMonth(now)).toISOString(),
    end: endOfDay(now).toISOString(),
  }
  if (period === 'trimestre') {
    const s = new Date(now); s.setMonth(s.getMonth() - 3)
    return { start: startOfDay(s).toISOString(), end: endOfDay(now).toISOString() }
  }
  return { start: custom.start + 'T00:00:00.000Z', end: custom.end + 'T23:59:59.999Z' }
}

// ─── CountUp component ────────────────────────────────────────────────────────

function CountUp({ target }: { target: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    setVal(0)
    if (!target) return
    let cur = 0
    const step = target / 40
    const timer = setInterval(() => {
      cur = Math.min(cur + step, target)
      setVal(Math.floor(cur))
      if (cur >= target) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [target])
  return <>{formatFCFA(val)}</>
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PharmacyPaiementsPage() {
  const { profile } = useAuth()
  const { pharmacie } = usePharmacy()
  const db = supabase as any

  const [tab, setTab] = useState<TabKey>('apercu')
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [loadingPaiements, setLoadingPaiements] = useState(true)
  const [reversements, setReversements] = useState<Reversement[]>([])
  const [loadingRev, setLoadingRev] = useState(false)

  const [period, setPeriod] = useState<PeriodKey>('mois')
  const [custom, setCustom] = useState({ start: '', end: '' })

  // ── Historique filters
  const [histSearch, setHistSearch] = useState('')
  const [histMode, setHistMode] = useState('')
  const [histStatut, setHistStatut] = useState('')

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [cashPayment, setCashPayment] = useState<Paiement | null>(null)
  const [cashGiven, setCashGiven] = useState('')
  const [savingCash, setSavingCash] = useState(false)

  const [tiersPayant, setTiersPayant] = useState<Paiement | null>(null)
  const [tiersRef, setTiersRef] = useState('')
  const [tiersMontant, setTiersMontant] = useState('')
  const [tiersReste, setTiersReste] = useState('')
  const [savingTiers, setSavingTiers] = useState(false)

  const [detailPaiement, setDetailPaiement] = useState<Paiement | null>(null)

  const [litigeReponse, setLitigeReponse] = useState<Paiement | null>(null)
  const [litigeComment, setLitigeComment] = useState('')
  const [savingLitige, setSavingLitige] = useState(false)

  const [sendingReminder, setSendingReminder] = useState<string | null>(null)

  // ─────────────────────────────────────────────────────────────────────────────
  // LOAD
  // ─────────────────────────────────────────────────────────────────────────────

  const loadPaiements = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoadingPaiements(true)
    const { data, error } = await db
      .from('paiements_pharmacie')
      .select('id, dispensation_id, patient_id, montant, montant_rembourse_mutuelle, reste_a_charge_patient, mode_paiement, statut, date_paiement, stripe_payment_intent_id, reference_tiers_payant, created_at')
      .eq('pharmacie_id', pharmacie.id)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) { toast.error('Erreur de chargement.'); setLoadingPaiements(false); return }

    // Fetch patient names
    const patientIds = [...new Set((data ?? []).map((p: any) => p.patient_id).filter(Boolean))]
    let nameMap = new Map<string, string>()
    if (patientIds.length) {
      const { data: profiles } = await db.from('profiles').select('id, full_name').in('id', patientIds)
      nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]))
    }

    setPaiements((data ?? []).map((p: any) => ({
      ...p,
      patient_name: nameMap.get(p.patient_id) ?? maskPatient(p.patient_id),
    })))
    setLoadingPaiements(false)
  }, [pharmacie?.id])

  const loadReversements = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoadingRev(true)
    const { data } = await db
      .from('reversements_pharmacie')
      .select('id, periode, montant_brut, commission_plateforme, montant_net, statut, date_reversement')
      .eq('pharmacie_id', pharmacie.id)
      .order('date_reversement', { ascending: false })
      .limit(24)
    setReversements(data ?? [])
    setLoadingRev(false)
  }, [pharmacie?.id])

  useEffect(() => { loadPaiements() }, [loadPaiements])
  useEffect(() => { if (tab === 'reversements') loadReversements() }, [tab, loadReversements])

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────────────────────────

  const bounds = useMemo(() => getPeriodBounds(period, custom), [period, custom])

  const periodPaiements = useMemo(() => {
    if (!bounds.start || !bounds.end) return paiements
    return paiements.filter(p => {
      const d = p.date_paiement ?? p.created_at ?? ''
      return d >= bounds.start && d <= bounds.end
    })
  }, [paiements, bounds])

  const kpis = useMemo(() => {
    const paid = periodPaiements.filter(p => p.statut === 'paye' || p.statut === 'rembourse')
    const caBrut = paid.reduce((s, p) => s + p.montant, 0)
    const mutuelle = paid.reduce((s, p) => s + (p.montant_rembourse_mutuelle ?? 0), 0)
    const resteCharge = paid.reduce((s, p) => s + (p.reste_a_charge_patient ?? p.montant), 0)
    const lastRev = reversements[0]
    const commRate = lastRev && lastRev.montant_brut > 0
      ? lastRev.commission_plateforme / lastRev.montant_brut
      : 0.05
    const commission = caBrut * commRate
    const netEstime = caBrut - commission
    return { caBrut, mutuelle, resteCharge, commission, netEstime, commRate }
  }, [periodPaiements, reversements])

  const enAttente = useMemo(() => paiements.filter(p => p.statut === 'en_attente'), [paiements])
  const litiges = useMemo(() => paiements.filter(p => p.statut === 'litige'), [paiements])
  const tiersPayantList = useMemo(() => paiements.filter(p => p.mode_paiement === 'mutuelle_tiers_payant'), [paiements])

  const filteredHist = useMemo(() => {
    let list = periodPaiements
    if (histSearch.trim()) {
      const q = histSearch.toLowerCase()
      list = list.filter(p =>
        p.patient_name?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.reference_tiers_payant?.toLowerCase().includes(q) ?? false)
      )
    }
    if (histMode) list = list.filter(p => p.mode_paiement === histMode)
    if (histStatut) list = list.filter(p => p.statut === histStatut)
    return list
  }, [periodPaiements, histSearch, histMode, histStatut])

  const tabCounts: Record<TabKey, number> = useMemo(() => ({
    apercu: 0,
    attente: enAttente.length,
    historique: 0,
    mutuelle: tiersPayantList.filter(p => p.statut === 'en_attente').length,
    reversements: 0,
    litiges: litiges.length,
  }), [enAttente, litiges, tiersPayantList])

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  async function confirmCash() {
    if (!cashPayment || !pharmacie?.id) return
    const given = parseFloat(cashGiven)
    if (isNaN(given) || given < cashPayment.montant) {
      toast.error('Montant insuffisant.')
      return
    }
    setSavingCash(true)
    const { error } = await supabase.functions.invoke('register-cash-payment', {
      body: {
        paiement_id: cashPayment.id,
        pharmacie_id: pharmacie.id,
        pharmacien_id: profile?.id,
        montant: cashPayment.montant,
        montant_donne: given,
      },
    })
    if (error) { toast.error('Erreur lors de l\'enregistrement.'); setSavingCash(false); return }
    toast.success(`Paiement de ${formatFCFA(cashPayment.montant)} enregistré. Monnaie : ${formatFCFA(given - cashPayment.montant)}.`)
    setSavingCash(false); setCashPayment(null); setCashGiven('')
    loadPaiements()
  }

  async function confirmTiersPayant() {
    if (!tiersPayant || !pharmacie?.id) return
    if (!tiersRef.trim()) { toast.error('Référence de prise en charge requise.'); return }
    setSavingTiers(true)
    const montantMut = parseFloat(tiersMontant) || 0
    const resteACharge = parseFloat(tiersReste) || Math.max(0, tiersPayant.montant - montantMut)
    const { error } = await db.from('paiements_pharmacie').update({
      mode_paiement: 'mutuelle_tiers_payant',
      reference_tiers_payant: tiersRef.trim(),
      montant_rembourse_mutuelle: montantMut,
      reste_a_charge_patient: resteACharge,
      statut: 'en_attente',
    }).eq('id', tiersPayant.id)
    if (error) { toast.error('Erreur.'); setSavingTiers(false); return }
    toast.success('Tiers payant enregistré.')
    setSavingTiers(false); setTiersPayant(null); setTiersRef(''); setTiersMontant(''); setTiersReste('')
    loadPaiements()
  }

  async function sendReminder(p: Paiement) {
    setSendingReminder(p.id)
    await supabase.functions.invoke('send-payment-reminder', {
      body: { paiement_id: p.id, patient_id: p.patient_id, pharmacie_id: pharmacie?.id },
    })
    toast.success('Rappel envoyé au patient.')
    setSendingReminder(null)
  }

  async function submitLitigeResponse() {
    if (!litigeReponse || !litigeComment.trim()) { toast.error('Commentaire requis.'); return }
    setSavingLitige(true)
    const { error } = await supabase.functions.invoke('submit-litige-response', {
      body: {
        paiement_id: litigeReponse.id,
        pharmacien_id: profile?.id,
        commentaire: litigeComment.trim(),
      },
    })
    if (error) { toast.error('Erreur d\'envoi.'); setSavingLitige(false); return }
    toast.success('Réponse transmise à l\'admin.')
    setSavingLitige(false); setLitigeReponse(null); setLitigeComment('')
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPORT CSV
  // ─────────────────────────────────────────────────────────────────────────────

  function exportCSV() {
    const bom = '﻿'
    const header = 'Date;Patient;Mode;Statut;Montant;Mutuelle;Reste à charge;Référence\n'
    const body = filteredHist.map(p =>
      [
        format(parseISO(p.date_paiement ?? p.created_at ?? new Date().toISOString()), 'dd/MM/yyyy HH:mm', { locale: fr }),
        `"${maskPatient(p.patient_id)}"`,
        MODE_LABELS[p.mode_paiement ?? ''] ?? '—',
        STATUT_LABELS[p.statut],
        p.montant,
        p.montant_rembourse_mutuelle ?? 0,
        p.reste_a_charge_patient ?? '',
        `"${p.reference_tiers_payant ?? ''}"`,
      ].join(';')
    ).join('\n')
    const blob = new Blob([bom + header + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `paiements_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERIOD selector shared
  // ─────────────────────────────────────────────────────────────────────────────

  function PeriodSelector() {
    return (
      <div className="flex flex-wrap items-center gap-s-2">
        {(['semaine', 'mois', 'trimestre', 'custom'] as PeriodKey[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`rounded-full px-s-3 py-s-1 text-small transition-colors ${period === p ? 'bg-primary text-white' : 'border border-line text-ink-2 hover:bg-surface-2'}`}>
            {p === 'semaine' ? 'Cette semaine' : p === 'mois' ? 'Ce mois' : p === 'trimestre' ? '3 mois' : 'Personnalisé'}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={custom.start} onChange={e => setCustom(c => ({ ...c, start: e.target.value }))}
              className="rounded border border-line bg-surface px-s-2 py-s-1 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            <span className="text-ink-3">→</span>
            <input type="date" value={custom.end} onChange={e => setCustom(c => ({ ...c, end: e.target.value }))}
              className="rounded border border-line bg-surface px-s-2 py-s-1 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
          </>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Aperçu
  // ─────────────────────────────────────────────────────────────────────────────

  function renderApercu() {
    const kpiCards = [
      { label: 'CA brut', value: kpis.caBrut, icon: <TrendingUp className="h-5 w-5 text-primary" />, sub: `${periodPaiements.filter(p => p.statut === 'paye' || p.statut === 'rembourse').length} transactions` },
      { label: 'Remboursements mutuelle', value: kpis.mutuelle, icon: <ArrowDownCircle className="h-5 w-5 text-teal-500" />, sub: 'Pris en charge' },
      { label: 'Reste à charge perçu', value: kpis.resteCharge, icon: <Banknote className="h-5 w-5 text-green-600" />, sub: 'Encaissé patients' },
      { label: 'Commission plateforme', value: kpis.commission, icon: <Percent className="h-5 w-5 text-ink-3" />, sub: `${(kpis.commRate * 100).toFixed(1)}% du CA brut` },
      { label: 'Reversement net estimé', value: kpis.netEstime, icon: <CheckCircle2 className="h-5 w-5 text-blue-500" />, sub: 'Après commission' },
    ]

    // By mode breakdown
    const byMode: Record<string, number> = {}
    periodPaiements.filter(p => p.statut === 'paye' || p.statut === 'rembourse').forEach(p => {
      const mode = p.mode_paiement ?? 'inconnu'
      byMode[mode] = (byMode[mode] ?? 0) + p.montant
    })

    return (
      <>
        <PeriodSelector />
        <div className="grid grid-cols-1 gap-s-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpiCards.map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="rounded-lg border border-line bg-surface p-s-4">
              <div className="flex items-center gap-s-2 mb-s-2">{kpi.icon}<p className="text-micro text-ink-3">{kpi.label}</p></div>
              <p className="font-bold text-ink text-large"><CountUp target={kpi.value} /></p>
              <p className="text-micro text-ink-3 mt-s-0.5">{kpi.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* By mode */}
        {Object.keys(byMode).length > 0 && (
          <div className="rounded-lg border border-line bg-surface">
            <div className="border-b border-line px-s-4 py-s-3">
              <h3 className="font-semibold text-ink">Répartition par mode de paiement</h3>
            </div>
            <div className="divide-y divide-line">
              {Object.entries(byMode).sort((a, b) => b[1] - a[1]).map(([mode, total]) => (
                <div key={mode} className="flex items-center justify-between px-s-4 py-s-3">
                  <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${MODE_BADGES[mode] ?? 'bg-ink/10 text-ink-2'}`}>
                    {MODE_LABELS[mode] ?? mode}
                  </span>
                  <span className="font-semibold text-ink">{formatFCFA(total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {enAttente.length > 0 && (
          <div className="flex items-center gap-s-3 rounded-lg border border-amber-200 bg-amber-50 px-s-4 py-s-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-small text-amber-800">
              <strong>{enAttente.length} paiement(s) en attente</strong> — rendez-vous sur l'onglet "En attente".
            </p>
            <button onClick={() => setTab('attente')} className="ml-auto text-small text-amber-700 underline whitespace-nowrap">
              Voir →
            </button>
          </div>
        )}
      </>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — En attente
  // ─────────────────────────────────────────────────────────────────────────────

  function renderAttente() {
    if (loadingPaiements) return <div className="flex flex-col gap-s-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
    if (!enAttente.length) return (
      <div className="flex flex-col items-center gap-s-2 py-s-12 text-ink-3">
        <CheckCircle2 className="h-10 w-10 opacity-30" />
        <p className="text-small">Aucun paiement en attente.</p>
      </div>
    )

    return (
      <div className="flex flex-col gap-s-3">
        {enAttente.map(p => (
          <div key={p.id} className="rounded-lg border border-amber-200 bg-surface overflow-hidden">
            <div className="flex flex-wrap items-center gap-s-3 px-s-4 py-s-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-s-2 mb-s-0.5">
                  <p className="font-semibold text-ink">{maskPatient(p.patient_id)}</p>
                  {p.mode_paiement && (
                    <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${MODE_BADGES[p.mode_paiement] ?? 'bg-ink/10'}`}>
                      {MODE_LABELS[p.mode_paiement]}
                    </span>
                  )}
                </div>
                <p className="text-small font-bold text-ink">{formatFCFA(p.montant)}</p>
                {p.created_at && (
                  <p className="text-micro text-ink-3">
                    Depuis {format(parseISO(p.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-s-2">
                <Button size="sm" variant="primary" leftIcon={<Banknote className="h-3.5 w-3.5" />}
                  onClick={() => { setCashPayment(p); setCashGiven('') }}>
                  Espèces
                </Button>
                <Button size="sm" variant="secondary" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  onClick={() => { setTiersPayant(p); setTiersRef(p.reference_tiers_payant ?? ''); setTiersMontant(''); setTiersReste('') }}>
                  Tiers payant
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<Bell className="h-3.5 w-3.5" />}
                  loading={sendingReminder === p.id}
                  onClick={() => sendReminder(p)}>
                  Relancer
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Historique
  // ─────────────────────────────────────────────────────────────────────────────

  function renderHistorique() {
    return (
      <>
        <PeriodSelector />
        <div className="flex flex-wrap gap-s-3">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input type="text" value={histSearch} onChange={e => setHistSearch(e.target.value)}
              placeholder="Patient, référence…"
              className="w-full rounded border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <select value={histMode} onChange={e => setHistMode(e.target.value)}
            className="rounded border border-line bg-surface px-s-2 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Tous modes</option>
            {Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={histStatut} onChange={e => setHistStatut(e.target.value)}
            className="rounded border border-line bg-surface px-s-2 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Tous statuts</option>
            {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Button size="sm" variant="ghost" leftIcon={<Download className="h-4 w-4" />} onClick={exportCSV}>
            Exporter CSV
          </Button>
        </div>

        {loadingPaiements ? (
          <div className="flex flex-col gap-s-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>
        ) : filteredHist.length === 0 ? (
          <p className="py-s-8 text-center text-small text-ink-3">Aucune transaction trouvée.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[700px] text-small">
              <thead className="bg-surface-2">
                <tr>
                  {['Date', 'Patient', 'Mode', 'Statut', 'Montant', 'Mutuelle', 'Reste', ''].map(h => (
                    <th key={h} className="px-s-3 py-s-2 text-left text-micro font-semibold text-ink-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredHist.map(p => (
                  <tr key={p.id} className="hover:bg-surface-2/50 cursor-pointer" onClick={() => setDetailPaiement(p)}>
                    <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                      {format(parseISO(p.date_paiement ?? p.created_at ?? new Date().toISOString()), 'dd/MM/yyyy', { locale: fr })}
                    </td>
                    <td className="px-s-3 py-s-2 font-medium text-ink">{maskPatient(p.patient_id)}</td>
                    <td className="px-s-3 py-s-2">
                      {p.mode_paiement && (
                        <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${MODE_BADGES[p.mode_paiement] ?? 'bg-ink/10'}`}>
                          {MODE_LABELS[p.mode_paiement]}
                        </span>
                      )}
                    </td>
                    <td className="px-s-3 py-s-2">
                      <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${STATUT_BADGES[p.statut] ?? ''}`}>
                        {STATUT_LABELS[p.statut]}
                      </span>
                    </td>
                    <td className="px-s-3 py-s-2 font-bold text-ink">{formatFCFA(p.montant)}</td>
                    <td className="px-s-3 py-s-2 text-teal-600">
                      {p.montant_rembourse_mutuelle ? formatFCFA(p.montant_rembourse_mutuelle) : '—'}
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-2">
                      {p.reste_a_charge_patient != null ? formatFCFA(p.reste_a_charge_patient) : '—'}
                    </td>
                    <td className="px-s-3 py-s-2">
                      <ChevronRight className="h-4 w-4 text-ink-3" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-micro text-ink-3">{filteredHist.length} transaction(s)</p>
      </>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Tiers payant
  // ─────────────────────────────────────────────────────────────────────────────

  function renderMutuelle() {
    const totalEnAttente = tiersPayantList
      .filter(p => p.statut === 'en_attente')
      .reduce((s, p) => s + (p.montant_rembourse_mutuelle ?? p.montant), 0)

    function tiersStatut(p: Paiement): { label: string; cls: string } {
      if (p.statut === 'rembourse') return { label: 'Remboursé', cls: 'bg-green-100 text-green-700' }
      if (p.statut === 'paye') return { label: 'En traitement', cls: 'bg-blue-100 text-blue-700' }
      return { label: 'Soumis', cls: 'bg-amber-100 text-amber-700' }
    }

    return (
      <>
        <div className="flex items-center gap-s-3 rounded-lg border border-teal-200 bg-teal-50 px-s-4 py-s-3">
          <ArrowDownCircle className="h-5 w-5 text-teal-600 shrink-0" />
          <p className="text-small text-teal-800">
            <strong>{formatFCFA(totalEnAttente)}</strong> en attente de remboursement des mutuelles
          </p>
        </div>

        {tiersPayantList.length === 0 ? (
          <p className="py-s-8 text-center text-small text-ink-3">Aucun tiers payant enregistré.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[600px] text-small">
              <thead className="bg-surface-2">
                <tr>
                  {['Date', 'Patient', 'Référence PC', 'Montant mutuelle', 'Reste patient', 'Statut'].map(h => (
                    <th key={h} className="px-s-3 py-s-2 text-left text-micro font-semibold text-ink-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tiersPayantList.map(p => {
                  const st = tiersStatut(p)
                  return (
                    <tr key={p.id} className="hover:bg-surface-2/50">
                      <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                        {format(parseISO(p.created_at ?? new Date().toISOString()), 'dd/MM/yyyy', { locale: fr })}
                      </td>
                      <td className="px-s-3 py-s-2 font-medium text-ink">{maskPatient(p.patient_id)}</td>
                      <td className="px-s-3 py-s-2 font-mono text-micro text-ink-2">{p.reference_tiers_payant ?? '—'}</td>
                      <td className="px-s-3 py-s-2 font-semibold text-teal-600">
                        {p.montant_rembourse_mutuelle != null ? formatFCFA(p.montant_rembourse_mutuelle) : '—'}
                      </td>
                      <td className="px-s-3 py-s-2 text-ink-2">
                        {p.reste_a_charge_patient != null ? formatFCFA(p.reste_a_charge_patient) : '—'}
                      </td>
                      <td className="px-s-3 py-s-2">
                        <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${st.cls}`}>{st.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Reversements
  // ─────────────────────────────────────────────────────────────────────────────

  function renderReversements() {
    const last = reversements[0]
    const nextDate = last?.date_reversement
      ? format(addMonths(parseISO(last.date_reversement), 1), 'MMMM yyyy', { locale: fr })
      : 'mois prochain'

    return (
      <>
        {loadingRev ? (
          <div className="flex flex-col gap-s-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded" />)}</div>
        ) : (
          <>
            {kpis.netEstime > 0 && (
              <div className="flex items-center gap-s-3 rounded-lg border border-blue-200 bg-blue-50 px-s-4 py-s-3">
                <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                <p className="text-small text-blue-800">
                  Prochain reversement estimé : <strong>{formatFCFA(kpis.netEstime)}</strong> — {nextDate}
                </p>
              </div>
            )}

            {reversements.length === 0 ? (
              <p className="py-s-8 text-center text-small text-ink-3">Aucun reversement reçu.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[600px] text-small">
                  <thead className="bg-surface-2">
                    <tr>
                      {['Période', 'CA brut', 'Commission', 'Net reversé', 'Statut', 'Date'].map(h => (
                        <th key={h} className="px-s-3 py-s-2 text-left text-micro font-semibold text-ink-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {reversements.map(r => (
                      <tr key={r.id} className="hover:bg-surface-2/50">
                        <td className="px-s-3 py-s-2 font-medium text-ink capitalize">{r.periode}</td>
                        <td className="px-s-3 py-s-2 text-ink-2">{formatFCFA(r.montant_brut)}</td>
                        <td className="px-s-3 py-s-2 text-red-600">-{formatFCFA(r.commission_plateforme)}</td>
                        <td className="px-s-3 py-s-2 font-bold text-green-700">{formatFCFA(r.montant_net)}</td>
                        <td className="px-s-3 py-s-2">
                          <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${r.statut === 'verse' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {r.statut === 'verse' ? 'Versé' : 'En attente'}
                          </span>
                        </td>
                        <td className="px-s-3 py-s-2 text-ink-3">
                          {r.date_reversement ? format(parseISO(r.date_reversement), 'dd/MM/yyyy', { locale: fr }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Litiges
  // ─────────────────────────────────────────────────────────────────────────────

  function renderLitiges() {
    if (!litiges.length) return (
      <div className="flex flex-col items-center gap-s-2 py-s-12 text-ink-3">
        <CheckCircle2 className="h-10 w-10 opacity-30" />
        <p className="text-small">Aucun litige en cours.</p>
      </div>
    )

    return (
      <div className="flex flex-col gap-s-3">
        {litiges.map(p => (
          <div key={p.id} className="rounded-lg border border-red-200 bg-surface overflow-hidden">
            <div className="flex flex-wrap items-center gap-s-3 px-s-4 py-s-4">
              <div className="flex items-center gap-s-2 shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-ink">{maskPatient(p.patient_id)}</span>
              </div>
              <div className="flex-1">
                <p className="text-small text-ink-2">
                  {formatFCFA(p.montant)} · {p.mode_paiement ? MODE_LABELS[p.mode_paiement] : '—'}
                </p>
                {p.created_at && (
                  <p className="text-micro text-ink-3">
                    {format(parseISO(p.created_at), 'dd/MM/yyyy', { locale: fr })}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-red-100 px-s-2 py-s-0.5 text-micro font-semibold text-red-700">
                Litige ouvert
              </span>
              <Button size="sm" variant="secondary" leftIcon={<MessageSquare className="h-3.5 w-3.5" />}
                onClick={() => { setLitigeReponse(p); setLitigeComment('') }}>
                Répondre
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-s-4 pb-s-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h1 font-semibold text-ink">Paiements</h1>
        <Button size="sm" variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={loadPaiements}>
          Actualiser
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-s-1 overflow-x-auto rounded-lg border border-line bg-surface-2 p-s-1 self-start">
        {(Object.keys(TAB_LABELS) as TabKey[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-s-1.5 whitespace-nowrap rounded px-s-3 py-s-1.5 text-small font-medium transition-colors ${tab === t ? 'bg-surface shadow text-ink' : 'text-ink-3 hover:text-ink'}`}>
            {TAB_LABELS[t]}
            {tabCounts[t] > 0 && (
              <span className={`rounded-full px-s-1.5 py-s-0.5 text-micro font-bold ${tab === t ? 'bg-primary text-white' : 'bg-red-500 text-white'}`}>
                {tabCounts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
          className="flex flex-col gap-s-4">
          {tab === 'apercu' && renderApercu()}
          {tab === 'attente' && renderAttente()}
          {tab === 'historique' && renderHistorique()}
          {tab === 'mutuelle' && renderMutuelle()}
          {tab === 'reversements' && renderReversements()}
          {tab === 'litiges' && renderLitiges()}
        </motion.div>
      </AnimatePresence>

      {/* ── Modal Paiement espèces ────────────────────────────────────────────── */}
      <Modal open={!!cashPayment} onOpenChange={open => { if (!open) setCashPayment(null) }}
        title="Saisir un paiement en espèces">
        {cashPayment && (
          <div className="flex flex-col gap-s-4">
            <div className="rounded-lg bg-surface-2 px-s-4 py-s-3">
              <p className="text-small text-ink-2">Montant dû</p>
              <p className="font-bold text-ink text-large">{formatFCFA(cashPayment.montant)}</p>
            </div>
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">Montant remis par le patient (FCFA) *</label>
              <input type="number" min={cashPayment.montant} step="50" value={cashGiven}
                onChange={e => setCashGiven(e.target.value)}
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus />
            </div>
            {cashGiven && parseFloat(cashGiven) >= cashPayment.montant && (
              <div className="flex items-center gap-s-3 rounded-lg border border-green-200 bg-green-50 px-s-4 py-s-3">
                <Banknote className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-small text-green-800">Monnaie à rendre</p>
                  <p className="font-bold text-green-700 text-large">
                    {formatFCFA(parseFloat(cashGiven) - cashPayment.montant)}
                  </p>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-s-2">
              <Button variant="ghost" onClick={() => setCashPayment(null)}>Annuler</Button>
              <Button variant="primary" onClick={confirmCash} loading={savingCash}
                leftIcon={<Banknote className="h-4 w-4" />}>
                Valider le paiement
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal Tiers payant ────────────────────────────────────────────────── */}
      <Modal open={!!tiersPayant} onOpenChange={open => { if (!open) setTiersPayant(null) }}
        title="Tiers payant mutuelle">
        {tiersPayant && (
          <div className="flex flex-col gap-s-4">
            <p className="text-small text-ink-2">Montant total : <strong>{formatFCFA(tiersPayant.montant)}</strong></p>
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">Référence de prise en charge *</label>
              <input type="text" value={tiersRef} onChange={e => setTiersRef(e.target.value)}
                placeholder="PC-2024-XXXXX"
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="grid grid-cols-2 gap-s-3">
              <div className="flex flex-col gap-s-1">
                <label className="text-small font-semibold text-ink">Montant pris en charge (FCFA)</label>
                <input type="number" min="0" value={tiersMontant} onChange={e => setTiersMontant(e.target.value)}
                  className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="flex flex-col gap-s-1">
                <label className="text-small font-semibold text-ink">Reste à charge patient (FCFA)</label>
                <input type="number" min="0" value={tiersReste}
                  placeholder={tiersMontant ? String(Math.max(0, tiersPayant.montant - (parseFloat(tiersMontant) || 0))) : ''}
                  onChange={e => setTiersReste(e.target.value)}
                  className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div className="flex justify-end gap-s-2">
              <Button variant="ghost" onClick={() => setTiersPayant(null)}>Annuler</Button>
              <Button variant="primary" onClick={confirmTiersPayant} loading={savingTiers}
                leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal Détail paiement ─────────────────────────────────────────────── */}
      <Modal open={!!detailPaiement} onOpenChange={open => { if (!open) setDetailPaiement(null) }}
        title="Détail de la transaction">
        {detailPaiement && (
          <div className="flex flex-col gap-s-3">
            {[
              { label: 'Référence', value: detailPaiement.id.slice(0, 16).toUpperCase() },
              { label: 'Patient', value: maskPatient(detailPaiement.patient_id) },
              { label: 'Montant total', value: formatFCFA(detailPaiement.montant) },
              { label: 'Mode de paiement', value: detailPaiement.mode_paiement ? MODE_LABELS[detailPaiement.mode_paiement] : '—' },
              { label: 'Statut', value: STATUT_LABELS[detailPaiement.statut] },
              { label: 'Mutuelle prise en charge', value: detailPaiement.montant_rembourse_mutuelle != null ? formatFCFA(detailPaiement.montant_rembourse_mutuelle) : '—' },
              { label: 'Reste à charge patient', value: detailPaiement.reste_a_charge_patient != null ? formatFCFA(detailPaiement.reste_a_charge_patient) : '—' },
              { label: 'Réf. tiers payant', value: detailPaiement.reference_tiers_payant ?? '—' },
              { label: 'Réf. Stripe', value: detailPaiement.stripe_payment_intent_id ?? '—' },
              { label: 'Date', value: detailPaiement.date_paiement ? format(parseISO(detailPaiement.date_paiement), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between border-b border-line pb-s-2 last:border-0">
                <p className="text-small text-ink-3">{row.label}</p>
                <p className="text-small font-medium text-ink">{row.value}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Modal Réponse litige ──────────────────────────────────────────────── */}
      <Modal open={!!litigeReponse} onOpenChange={open => { if (!open) setLitigeReponse(null) }}
        title="Répondre au litige">
        {litigeReponse && (
          <div className="flex flex-col gap-s-4">
            <div className="rounded-lg border border-red-200 bg-red-50 px-s-4 py-s-3">
              <p className="text-small text-red-800">
                Litige sur paiement de <strong>{formatFCFA(litigeReponse.montant)}</strong> — {maskPatient(litigeReponse.patient_id)}
              </p>
            </div>
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">Votre réponse *</label>
              <textarea value={litigeComment} onChange={e => setLitigeComment(e.target.value)} rows={4}
                placeholder="Expliquez votre position concernant ce litige…"
                className="resize-none rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <p className="text-micro text-ink-3">Ce commentaire sera transmis à l'administrateur et conservé dans l'audit.</p>
            </div>
            <div className="flex justify-end gap-s-2">
              <Button variant="ghost" onClick={() => setLitigeReponse(null)}>Annuler</Button>
              <Button variant="primary" onClick={submitLitigeResponse} loading={savingLitige}
                leftIcon={<MessageSquare className="h-4 w-4" />}>
                Envoyer la réponse
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
