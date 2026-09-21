import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, startOfWeek, startOfMonth, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion } from 'framer-motion'
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Download, FileText, Eye, Search, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { usePharmacy } from './PharmacyContext'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { BarChart, LineChart, DonutChart, Gauge, type SeriesPoint } from '@/components/ui/charts'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'custom'
type PayFilter = 'all' | 'paye' | 'en_attente' | 'partiel'

interface MedDelivres {
  nom: string
  quantite_prescrite?: number
  quantite_servie: number
}

interface Dispensation {
  id: string
  ordonnance_soumise_id: string | null
  pharmacien_id: string | null
  patient_id: string
  praticien_id: string | null
  date_dispensation: string
  medicaments_delivres: MedDelivres[] | null
  montant_total: number | null
  montant_paye: number | null
  statut_paiement: 'paye' | 'en_attente' | 'partiel' | null
  notes_pharmacien: string | null
  bon_dispensation_url: string | null
  praticien?: { full_name: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(Math.round(n)) + ' FCFA'
}

function maskPatient(id: string) {
  return `P-${id.slice(0, 6).toUpperCase()}`
}

function getPeriodBounds(period: Period, custom: { start: string; end: string }) {
  const now = new Date()
  if (period === 'today') {
    const s = new Date(now); s.setHours(0, 0, 0, 0)
    const e = new Date(now); e.setHours(23, 59, 59, 999)
    return { start: s.toISOString(), end: e.toISOString() }
  }
  if (period === 'week') {
    const s = startOfWeek(now, { weekStartsOn: 1 })
    const e = new Date(now); e.setHours(23, 59, 59, 999)
    return { start: s.toISOString(), end: e.toISOString() }
  }
  if (period === 'month') {
    const s = startOfMonth(now)
    const e = new Date(now); e.setHours(23, 59, 59, 999)
    return { start: s.toISOString(), end: e.toISOString() }
  }
  // custom
  const s = custom.start
    ? new Date(`${custom.start}T00:00:00`).toISOString()
    : startOfMonth(now).toISOString()
  const e = custom.end
    ? new Date(`${custom.end}T23:59:59`).toISOString()
    : new Date(now).toISOString()
  return { start: s, end: e }
}

function payBadge(status: Dispensation['statut_paiement']) {
  if (status === 'paye')
    return <span className="rounded-full bg-green-100 px-s-2 py-s-0.5 text-micro font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">Payé</span>
  if (status === 'partiel')
    return <span className="rounded-full bg-status-warning/10 px-s-2 py-s-0.5 text-micro font-semibold text-status-warning">Partiel</span>
  return <span className="rounded-full bg-surface-2 px-s-2 py-s-0.5 text-micro font-semibold text-ink-3">En attente</span>
}

const RECHARTS_TOOLTIP = {
  background: 'var(--surface)', border: '1px solid var(--line)',
  borderRadius: 10, fontSize: 12, color: 'var(--ink)',
}
const AX = { stroke: 'var(--ink-3)', fontSize: 11 }

function HBarChart({ data, height = 280 }: { data: { nom: string; count: number }[]; height?: number }) {
  if (!data.length) return <div className="flex h-[280px] items-center justify-center text-small text-ink-3">Pas de données</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--line)" />
        <XAxis type="number" tickLine={false} axisLine={false} {...AX} />
        <YAxis type="category" dataKey="nom" tickLine={false} axisLine={false} width={110} {...AX} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={RECHARTS_TOOLTIP} />
        <Bar dataKey="count" fill="var(--accent)" radius={[0, 6, 6, 0]} />
      </ReBarChart>
    </ResponsiveContainer>
  )
}

function exportCsv(data: Dispensation[], period: string) {
  const rows = [
    ['ID', 'Date', 'Patient', 'Médicaments', 'Montant total', 'Montant payé', 'Statut paiement'],
    ...data.map(d => [
      d.id.slice(0, 8),
      format(parseISO(d.date_dispensation), 'dd/MM/yyyy HH:mm'),
      maskPatient(d.patient_id),
      (Array.isArray(d.medicaments_delivres) ? d.medicaments_delivres.map(m => m.nom).join(', ') : ''),
      String(d.montant_total ?? ''),
      String(d.montant_paye ?? ''),
      d.statut_paiement ?? 'non renseigné',
    ]),
  ]
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dispensations-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PharmacyDispensationsPage() {
  const { pharmacie } = usePharmacy()
  const db = supabase as any

  const [period, setPeriod] = useState<Period>('month')
  const [custom, setCustom] = useState({ start: '', end: '' })
  const [search, setSearch] = useState('')
  const [payFilter, setPayFilter] = useState<PayFilter>('all')
  const [data, setData] = useState<Dispensation[]>([])
  const [loading, setLoading] = useState(true)
  const [showStats, setShowStats] = useState(false)

  // Detail modal
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = useMemo(() => data.find(d => d.id === detailId) ?? null, [data, detailId])
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(false)

  // Avoir modal
  const [avoirId, setAvoirId] = useState<string | null>(null)
  const [avoirMotif, setAvoirMotif] = useState('')
  const [submittingAvoir, setSubmittingAvoir] = useState(false)

  // Rapport mensuel
  const [exportingRapport, setExportingRapport] = useState(false)

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoading(true)
    const { start, end } = getPeriodBounds(period, custom)

    let q = db
      .from('dispensations')
      .select(`
        id, ordonnance_soumise_id, pharmacien_id, patient_id, praticien_id,
        date_dispensation, medicaments_delivres, montant_total, montant_paye,
        statut_paiement, notes_pharmacien, bon_dispensation_url,
        praticien:profiles!praticien_id(full_name)
      `)
      .eq('pharmacie_id', pharmacie.id)
      .gte('date_dispensation', start)
      .lte('date_dispensation', end)
      .order('date_dispensation', { ascending: false })
      .limit(500)

    if (payFilter !== 'all') q = q.eq('statut_paiement', payFilter)

    const { data: rows, error } = await q
    if (error) { toast.error('Erreur de chargement.') }
    setData(rows ?? [])
    setLoading(false)
  }, [pharmacie?.id, period, custom, payFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Filtered list (client-side search) ───────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(d => {
      if (d.id.toLowerCase().includes(q)) return true
      const meds = Array.isArray(d.medicaments_delivres)
        ? d.medicaments_delivres.map(m => m.nom).join(' ').toLowerCase()
        : ''
      if (meds.includes(q)) return true
      if ((d.praticien as any)?.full_name?.toLowerCase().includes(q)) return true
      return false
    })
  }, [data, search])

  // ── Analytics (computed from full fetched dataset) ────────────────────────────
  const analytics = useMemo(() => {
    if (!data.length) return null

    // Dispensations par jour
    const byDayMap: Record<string, number> = {}
    const caByDayMap: Record<string, number> = {}
    data.forEach(d => {
      const day = format(parseISO(d.date_dispensation), 'dd/MM', { locale: fr })
      byDayMap[day] = (byDayMap[day] ?? 0) + 1
      caByDayMap[day] = (caByDayMap[day] ?? 0) + (d.montant_total ?? 0)
    })
    const byDay: SeriesPoint[] = Object.entries(byDayMap).map(([label, value]) => ({ label, value }))
    const caByDay: SeriesPoint[] = Object.entries(caByDayMap).map(([label, value]) => ({ label, value: Math.round(value) }))

    // Top 10 médicaments
    const medMap: Record<string, number> = {}
    data.forEach(d => {
      if (!Array.isArray(d.medicaments_delivres)) return
      d.medicaments_delivres.forEach(m => {
        const nom = m.nom ?? 'Inconnu'
        medMap[nom] = (medMap[nom] ?? 0) + (m.quantite_servie ?? 1)
      })
    })
    const top10 = Object.entries(medMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nom, count]) => ({ nom, count }))

    // Répartition par praticien
    const byPraticien: Record<string, number> = {}
    data.forEach(d => {
      const name = (d.praticien as any)?.full_name ?? 'Non identifié'
      byPraticien[name] = (byPraticien[name] ?? 0) + 1
    })
    const praticienData: SeriesPoint[] = Object.entries(byPraticien)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }))

    // Taux dispensations complètes
    const completes = data.filter(d => {
      if (!Array.isArray(d.medicaments_delivres)) return true
      return d.medicaments_delivres.every(m => !m.quantite_prescrite || m.quantite_servie >= m.quantite_prescrite)
    }).length
    const tauxComplet = data.length ? Math.round((completes / data.length) * 100) : 0

    // CA total
    const caTotal = data.reduce((s, d) => s + (d.montant_total ?? 0), 0)
    const caPaye = data.reduce((s, d) => s + (d.montant_paye ?? 0), 0)

    return { byDay, caByDay, top10, praticienData, tauxComplet, caTotal, caPaye, total: data.length }
  }, [data])

  // ── Load PDF URL for detail modal ─────────────────────────────────────────────
  useEffect(() => {
    if (!detailId) { setPdfUrl(null); return }
    const d = data.find(x => x.id === detailId)
    const path = d?.bon_dispensation_url
    if (!path) { setPdfUrl(null); return }
    setLoadingPdf(true)
    supabase.storage.from('dispensations').createSignedUrl(path, 3600)
      .then(({ data: r }) => { setPdfUrl(r?.signedUrl ?? null); setLoadingPdf(false) })
  }, [detailId, data])

  // ── Émettre avoir ────────────────────────────────────────────────────────────
  async function confirmerAvoir() {
    if (!avoirId || !avoirMotif.trim()) { toast.error('Veuillez saisir un motif.'); return }
    setSubmittingAvoir(true)
    const { error } = await supabase.functions.invoke('create-avoir', {
      body: {
        dispensation_id: avoirId,
        motif: avoirMotif.trim(),
        pharmacie_id: pharmacie?.id,
      },
    })
    if (error) { toast.error('Erreur lors de l\'émission de l\'avoir.'); setSubmittingAvoir(false); return }
    toast.success('Avoir émis. Patient et admin notifiés.')
    setSubmittingAvoir(false)
    setAvoirId(null)
    setAvoirMotif('')
    fetchData()
  }

  // ── Rapport MSAS ─────────────────────────────────────────────────────────────
  async function genererRapportMSAS() {
    if (!pharmacie?.id) return
    setExportingRapport(true)
    const now = new Date()
    const { data: res, error } = await supabase.functions.invoke('generate-rapport-msas', {
      body: {
        pharmacie_id: pharmacie.id,
        mois: now.getMonth() + 1,
        annee: now.getFullYear(),
      },
    })
    if (error || !res?.url) {
      toast.error('Impossible de générer le rapport MSAS.')
      setExportingRapport(false)
      return
    }
    window.open(res.url, '_blank')
    setExportingRapport(false)
  }

  // ── Period labels ─────────────────────────────────────────────────────────────
  const periodLabels: { key: Period; label: string }[] = [
    { key: 'today', label: 'Aujourd\'hui' },
    { key: 'week',  label: 'Cette semaine' },
    { key: 'month', label: 'Ce mois' },
    { key: 'custom', label: 'Personnalisée' },
  ]

  return (
    <div className="flex flex-col gap-s-5 pb-s-8">

      {/* ── En-tête ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-s-3">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-h1 font-semibold text-ink">Dispensations</h1>
          <div className="flex gap-s-2">
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={() => exportCsv(filtered, period)}
              disabled={!filtered.length}
            >
              CSV
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<FileText className="h-4 w-4" />}
              onClick={genererRapportMSAS}
              loading={exportingRapport}
            >
              Rapport MSAS
            </Button>
          </div>
        </div>

        {/* Période */}
        <div className="flex gap-s-1 flex-wrap">
          {periodLabels.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-full px-s-3 py-s-1 text-small font-medium transition-colors ${
                period === p.key
                  ? 'bg-primary text-white'
                  : 'bg-surface-2 text-ink-2 hover:bg-surface text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-s-2 flex-wrap">
            <input
              type="date"
              value={custom.start}
              onChange={e => setCustom(c => ({ ...c, start: e.target.value }))}
              className="rounded border border-line bg-surface px-s-3 py-s-1.5 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-small text-ink-3">—</span>
            <input
              type="date"
              value={custom.end}
              onChange={e => setCustom(c => ({ ...c, end: e.target.value }))}
              className="rounded border border-line bg-surface px-s-3 py-s-1.5 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}

        {/* Recherche + statut paiement */}
        <div className="flex gap-s-2 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ID dispensation, médicament, praticien…"
              className="w-full rounded border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-s-1">
            {(['all', 'paye', 'en_attente', 'partiel'] as PayFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setPayFilter(f)}
                className={`rounded px-s-2 py-s-1.5 text-small font-medium transition-colors ${
                  payFilter === f ? 'bg-primary text-white' : 'bg-surface-2 text-ink-2 hover:text-ink'
                }`}
              >
                {f === 'all' ? 'Tous' : f === 'paye' ? 'Payé' : f === 'en_attente' ? 'En attente' : 'Partiel'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Résumé ────────────────────────────────────────────────────────────── */}
      {!loading && analytics && (
        <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-4">
          {[
            { label: 'Dispensations', value: String(analytics.total), color: 'text-primary' },
            { label: 'CA total', value: formatFCFA(analytics.caTotal), color: 'text-green-600 dark:text-green-400' },
            { label: 'Montant encaissé', value: formatFCFA(analytics.caPaye), color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Taux complet', value: `${analytics.tauxComplet}%`, color: 'text-ink-2' },
          ].map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex flex-col gap-s-1 rounded-lg border border-line bg-surface px-s-4 py-s-3"
            >
              <p className={`font-display text-h2 font-semibold truncate ${k.color}`}>{k.value}</p>
              <p className="text-micro text-ink-3">{k.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Liste dispensations ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col gap-s-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-s-3 py-s-12 text-ink-3">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-small">Aucune dispensation pour cette période.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-s-2">
          {filtered.map(d => {
            const meds = Array.isArray(d.medicaments_delivres) ? d.medicaments_delivres : []
            const medStr = meds.map(m => m.nom).slice(0, 3).join(', ')
            const moreMeds = meds.length > 3 ? ` +${meds.length - 3}` : ''
            return (
              <div
                key={d.id}
                className="flex items-center gap-s-3 rounded-lg border border-line bg-surface px-s-4 py-s-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-s-2 flex-wrap">
                    <span className="font-mono text-small text-ink-2">
                      #{d.id.slice(0, 8).toUpperCase()}
                    </span>
                    {payBadge(d.statut_paiement)}
                  </div>
                  <p className="mt-s-0.5 text-micro text-ink-3">
                    {format(parseISO(d.date_dispensation), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    {' · '}{maskPatient(d.patient_id)}
                  </p>
                  {medStr && (
                    <p className="mt-s-0.5 truncate text-micro text-ink-2">
                      {medStr}{moreMeds}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-s-1 shrink-0">
                  {d.montant_total != null && (
                    <span className="text-small font-semibold text-ink">
                      {formatFCFA(d.montant_total)}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Eye className="h-4 w-4" />}
                    onClick={() => setDetailId(d.id)}
                  >
                    Détail
                  </Button>
                </div>
              </div>
            )
          })}
          {data.length >= 500 && (
            <p className="text-center text-micro text-ink-3 py-s-2">
              Affichage limité à 500 dispensations. Utilisez un filtre plus précis pour affiner.
            </p>
          )}
        </div>
      )}

      {/* ── Analytics (toggle) ────────────────────────────────────────────────── */}
      {!loading && analytics && (
        <div className="rounded-lg border border-line bg-surface overflow-hidden">
          <button
            className="flex w-full items-center justify-between px-s-4 py-s-3"
            onClick={() => setShowStats(s => !s)}
          >
            <span className="flex items-center gap-s-2 font-semibold text-ink">
              <BarChart2 className="h-5 w-5 text-primary" />
              Statistiques
            </span>
            {showStats ? <ChevronUp className="h-4 w-4 text-ink-3" /> : <ChevronDown className="h-4 w-4 text-ink-3" />}
          </button>

          {showStats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-t border-line px-s-4 pb-s-6 pt-s-4"
            >
              <div className="grid grid-cols-1 gap-s-6 sm:grid-cols-2">

                {/* Dispensations par jour */}
                <div>
                  <p className="mb-s-3 text-small font-semibold text-ink">Dispensations / jour</p>
                  <LineChart data={analytics.byDay} height={200} />
                </div>

                {/* CA par jour */}
                <div>
                  <p className="mb-s-3 text-small font-semibold text-ink">CA / jour (FCFA)</p>
                  <BarChart data={analytics.caByDay} height={200} />
                </div>

                {/* Top 10 médicaments */}
                <div className="sm:col-span-2">
                  <p className="mb-s-3 text-small font-semibold text-ink">Top 10 médicaments dispensés</p>
                  <HBarChart data={analytics.top10} height={280} />
                </div>

                {/* Répartition par praticien + taux complet */}
                <div>
                  <p className="mb-s-3 text-small font-semibold text-ink">Par praticien prescripteur</p>
                  <DonutChart data={analytics.praticienData} height={220} />
                  <ul className="mt-s-2 flex flex-col gap-s-1">
                    {analytics.praticienData.map((p, i) => {
                      const colors = ['var(--primary)', 'var(--accent)', 'var(--status-progress)', 'var(--status-pending)', 'var(--status-neutral)', 'var(--ink-3)']
                      return (
                        <li key={p.label} className="flex items-center gap-s-2 text-micro text-ink-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
                          <span className="flex-1 truncate">{p.label}</span>
                          <span className="font-medium text-ink">{p.value}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                {/* Taux complet */}
                <div className="flex flex-col items-center justify-center gap-s-3 py-s-4">
                  <p className="text-small font-semibold text-ink">Taux dispensations complètes</p>
                  <Gauge value={analytics.tauxComplet} label={`${analytics.tauxComplet}% complet`} size={140} />
                  <p className="text-micro text-ink-3 text-center">
                    {analytics.total} dispensations · {Math.round(analytics.total * analytics.tauxComplet / 100)} complètes
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ── Modal détail dispensation ─────────────────────────────────────────── */}
      <Modal
        open={!!detailId}
        onOpenChange={open => { if (!open) setDetailId(null) }}
        title={detail ? `Dispensation #${detail.id.slice(0, 8).toUpperCase()}` : ''}
        size="lg"
      >
        {detail && (
          <div className="flex flex-col gap-s-4">

            {/* Infos générales */}
            <div className="grid grid-cols-2 gap-s-3">
              <div>
                <p className="text-micro text-ink-3">Date</p>
                <p className="text-small font-medium text-ink">
                  {format(parseISO(detail.date_dispensation), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </p>
              </div>
              <div>
                <p className="text-micro text-ink-3">Patient</p>
                <p className="text-small font-medium text-ink">{maskPatient(detail.patient_id)}</p>
              </div>
              <div>
                <p className="text-micro text-ink-3">Praticien prescripteur</p>
                <p className="text-small font-medium text-ink">
                  {(detail.praticien as any)?.full_name ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-micro text-ink-3">Statut paiement</p>
                <div className="mt-s-0.5">{payBadge(detail.statut_paiement)}</div>
              </div>
              {detail.montant_total != null && (
                <div>
                  <p className="text-micro text-ink-3">Montant total</p>
                  <p className="text-small font-semibold text-ink">{formatFCFA(detail.montant_total)}</p>
                </div>
              )}
              {detail.montant_paye != null && (
                <div>
                  <p className="text-micro text-ink-3">Montant payé</p>
                  <p className="text-small font-semibold text-ink">{formatFCFA(detail.montant_paye)}</p>
                </div>
              )}
            </div>

            {/* Médicaments dispensés */}
            {Array.isArray(detail.medicaments_delivres) && detail.medicaments_delivres.length > 0 && (
              <div>
                <p className="mb-s-2 text-small font-semibold text-ink">Médicaments dispensés</p>
                <ul className="flex flex-col gap-s-1">
                  {detail.medicaments_delivres.map((m, i) => {
                    const diff = m.quantite_prescrite != null && m.quantite_servie !== m.quantite_prescrite
                    return (
                      <li key={i} className="flex items-center gap-s-3 rounded border border-line bg-surface-2 px-s-3 py-s-2">
                        <span className="flex-1 text-small text-ink">{m.nom}</span>
                        <span className="text-micro text-ink-3">
                          {m.quantite_prescrite != null ? `Prescrit : ${m.quantite_prescrite}` : ''}
                        </span>
                        <span className={`text-micro font-medium ${diff ? 'text-status-warning' : 'text-ink-2'}`}>
                          Servi : {m.quantite_servie}
                          {diff && ' ⚠'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Notes pharmacien */}
            {detail.notes_pharmacien && (
              <div>
                <p className="mb-s-1 text-small font-semibold text-ink">Notes pharmacien</p>
                <p className="rounded bg-surface-2 px-s-3 py-s-2 text-small italic text-ink-2">
                  {detail.notes_pharmacien}
                </p>
              </div>
            )}

            {/* Bon de dispensation */}
            <div className="flex flex-wrap gap-s-2">
              {detail.bon_dispensation_url && (
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Download className="h-4 w-4" />}
                  onClick={() => {
                    if (pdfUrl) window.open(pdfUrl, '_blank')
                  }}
                  loading={loadingPdf}
                >
                  Télécharger le bon
                </Button>
              )}
              {detail.statut_paiement === 'paye' && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => { setAvoirId(detail.id); setDetailId(null) }}
                >
                  Émettre un avoir
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal Avoir ───────────────────────────────────────────────────────── */}
      <Modal
        open={!!avoirId}
        onOpenChange={open => { if (!open) { setAvoirId(null); setAvoirMotif('') } }}
        title="Émettre un avoir"
      >
        <div className="flex flex-col gap-s-4">
          <p className="text-small text-ink-2">
            Un avoir sera créé pour cette dispensation. Le patient et l'administrateur seront notifiés.
          </p>
          <textarea
            value={avoirMotif}
            onChange={e => setAvoirMotif(e.target.value)}
            rows={3}
            placeholder="Motif de l'avoir (erreur de dispensation, produit défectueux, retour…)"
            className="resize-none rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => { setAvoirId(null); setAvoirMotif('') }}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={confirmerAvoir}
              loading={submittingAvoir}
            >
              Confirmer l'avoir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
