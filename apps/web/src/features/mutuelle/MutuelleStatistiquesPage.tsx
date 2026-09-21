import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, startOfYear } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  periode: { debut: string; fin: string }
  sante_financiere: {
    parMois: { mois: string; attendu: number; encaisse: number; rembourse: number }[]
    soldeCumul: { mois: string; solde: number }[]
    ratioSinistralite: number
    tauxRecouvrementMoyen: number
    reserveMois: number
    totalEncaisse: number
    totalRembourse: number
  }
  adherents: {
    evolution: { mois: string; actifs: number }[]
    adhesionsResiliations: { mois: string; adhesions: number; resiliations: number }[]
    parPlan: { nom: string; nb: number }[]
    top20: { rang: number; montant: number }[]
    adherentsAvecDemande: { mois: string; avecDemande: number; sansDemande: number }[]
  }
  demandes: {
    parTypeSoin: { type: string; nb: number; montant: number }[]
    delaiParMois: { mois: string; heures: number | null }[]
    repartitionStatut: { statut: string; nb: number }[]
    motifsRefus: { motif: string; nb: number }[]
    total: number
    totalApprouves: number
    montantTotal: number
  }
  prestataires: {
    top10: { nom: string; type: string; nb_demandes: number; montant: number }[]
    comparaisonMode: { tp: number; classique: number }
  }
  profil_risque: {
    distribution: { label: string; nb: number }[]
    topConsommateurs: { rang: number; montant: number }[]
    saisonnalite: { mois: string; nb_demandes: number }[]
  }
}

// ── Constantes ────────────────────────────────────────────────────────────────

const FCFA = (n: number) => new Intl.NumberFormat('fr-SN').format(Math.round(n)) + ' FCFA'
const N = (n: number) => new Intl.NumberFormat('fr-SN').format(Math.round(n))

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']
const PERIODE_OPTIONS = [
  { label: 'Ce mois', value: 'mois' },
  { label: '3 mois', value: '3m' },
  { label: '6 mois', value: '6m' },
  { label: 'Cette année', value: 'annee' },
  { label: 'Personnalisé', value: 'custom' },
]

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente', approuve: 'Approuvé', refuse: 'Refusé', rembourse: 'Remboursé',
}
const TYPE_LABELS: Record<string, string> = {
  consultation: 'Consultation', pharmacie: 'Pharmacie', hospitalisation: 'Hospitalisation',
  radiologie: 'Radiologie', biologie: 'Biologie', autre: 'Autre',
}

// ── Tooltip FCFA ──────────────────────────────────────────────────────────────

const FcfaTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-semibold">{typeof p.value === 'number' ? FCFA(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

const NbTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-semibold">{N(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

// ── Skeleton card ──────────────────────────────────────────────────────────────

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
)

// ── KPI Card ───────────────────────────────────────────────────────────────────

const KpiCard = ({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) => {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    purple: 'text-purple-600 dark:text-purple-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${colors[color] ?? colors.blue}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <span className="text-xl">{icon}</span>
    <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
  </div>
)

// ── Helpers export ────────────────────────────────────────────────────────────

function buildCsvRows(rows: string[][]): string {
  return '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function printHTML(html: string, title: string) {
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) { toast.error('Autoriser les pop-ups pour imprimer'); return }
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; padding: 24px; }
  h1 { font-size: 20px; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin-bottom: 16px; }
  h2 { font-size: 15px; color: #374151; margin: 20px 0 8px; border-left: 3px solid #3b82f6; padding-left: 8px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 20px; }
  .kpi-card { background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; }
  .kpi-label { font-size: 11px; color: #6b7280; }
  .kpi-value { font-size: 18px; font-weight: 700; color: #1e40af; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f3f4f6; padding: 6px 8px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; }
  td { padding: 5px 8px; border: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { margin-top: 24px; font-size: 10px; color: #9ca3af; text-align: right; }
  @media print { body { padding: 12px; } }
</style></head><body>
${html}
<div class="footer">Généré le ${new Date().toLocaleDateString('fr-SN')} — Sene Wérr Mutuelle</div>
<script>setTimeout(()=>window.print(),400)</script>
</body></html>`)
  w.document.close()
}

// ── Main component ────────────────────────────────────────────────────────────

export function MutuelleStatistiquesPage() {
  const [periode, setPeriode] = useState<string>('6m')
  const [customDebut, setCustomDebut] = useState('')
  const [customFin, setCustomFin] = useState('')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('sante')

  const getRange = useCallback((): { debut: string; fin: string } => {
    const now = new Date()
    const fmt = (d: Date) => format(d, 'yyyy-MM-dd')
    if (periode === 'mois') return { debut: fmt(startOfMonth(now)), fin: fmt(endOfMonth(now)) }
    if (periode === '3m') return { debut: fmt(startOfMonth(subMonths(now, 2))), fin: fmt(endOfMonth(now)) }
    if (periode === '6m') return { debut: fmt(startOfMonth(subMonths(now, 5))), fin: fmt(endOfMonth(now)) }
    if (periode === 'annee') return { debut: fmt(startOfYear(now)), fin: fmt(endOfMonth(now)) }
    if (periode === 'custom' && customDebut && customFin) return { debut: customDebut, fin: customFin }
    return { debut: fmt(startOfMonth(subMonths(now, 5))), fin: fmt(endOfMonth(now)) }
  }, [periode, customDebut, customFin])

  const loadData = useCallback(async () => {
    const range = getRange()
    if (!range.debut || !range.fin) return
    setLoading(true)
    try {
      const { data: result, error } = await supabase.functions.invoke('get-mutuelle-analytics', {
        body: range,
      })
      if (error) throw error
      setData(result.data ?? result)
    } catch (e: any) {
      toast.error('Erreur chargement analytics : ' + (e?.message ?? 'Erreur inconnue'))
    } finally {
      setLoading(false)
    }
  }, [getRange])

  useEffect(() => {
    if (periode !== 'custom') loadData()
  }, [periode, loadData])

  const handleExportCsv = () => {
    if (!data) return
    const range = getRange()
    const rows: string[][] = [
      ['Section', 'Indicateur', 'Valeur'],
      ['Santé financière', 'Total encaissé (FCFA)', String(data.sante_financiere.totalEncaisse)],
      ['Santé financière', 'Total remboursé (FCFA)', String(data.sante_financiere.totalRembourse)],
      ['Santé financière', 'Taux sinistralité (%)', String(data.sante_financiere.ratioSinistralite)],
      ['Santé financière', 'Taux recouvrement moyen (%)', String(data.sante_financiere.tauxRecouvrementMoyen)],
      ['Santé financière', 'Réserve (mois)', String(data.sante_financiere.reserveMois)],
      [],
      ['Mois', 'Cotis. attendues', 'Cotis. encaissées', 'Remboursements'],
      ...data.sante_financiere.parMois.map(m => [m.mois, String(m.attendu), String(m.encaisse), String(m.rembourse)]),
      [],
      ['Demandes', 'Total', 'Approuvées', 'Montant total (FCFA)'],
      ['', String(data.demandes.total), String(data.demandes.totalApprouves), String(data.demandes.montantTotal)],
      [],
      ['Type de soin', 'Nb demandes', 'Montant (FCFA)'],
      ...data.demandes.parTypeSoin.map(t => [TYPE_LABELS[t.type] ?? t.type, String(t.nb), String(t.montant)]),
    ]
    downloadCsv(buildCsvRows(rows), `analytics_${range.debut}_${range.fin}.csv`)
    toast.success('Export CSV téléchargé')
  }

  const handleExportPdf = () => {
    if (!data) return
    const range = getRange()
    const sf = data.sante_financiere
    const de = data.demandes

    const kpisHtml = `
<div class="kpi-grid">
  <div class="kpi-card"><div class="kpi-label">Total encaissé</div><div class="kpi-value">${FCFA(sf.totalEncaisse)}</div></div>
  <div class="kpi-card"><div class="kpi-label">Total remboursé</div><div class="kpi-value">${FCFA(sf.totalRembourse)}</div></div>
  <div class="kpi-card"><div class="kpi-label">Ratio sinistralité</div><div class="kpi-value">${sf.ratioSinistralite}%</div></div>
  <div class="kpi-card"><div class="kpi-label">Taux recouvrement</div><div class="kpi-value">${sf.tauxRecouvrementMoyen}%</div></div>
  <div class="kpi-card"><div class="kpi-label">Réserve</div><div class="kpi-value">${sf.reserveMois} mois</div></div>
  <div class="kpi-card"><div class="kpi-label">Demandes total</div><div class="kpi-value">${N(de.total)}</div></div>
</div>`

    const parMoisHtml = `
<h2>Cotisations &amp; Remboursements par mois</h2>
<table>
  <thead><tr><th>Mois</th><th>Attendu</th><th>Encaissé</th><th>Remboursé</th></tr></thead>
  <tbody>${sf.parMois.map(m => `<tr><td>${m.mois}</td><td>${FCFA(m.attendu)}</td><td>${FCFA(m.encaisse)}</td><td>${FCFA(m.rembourse)}</td></tr>`).join('')}</tbody>
</table>`

    const typeSoinHtml = `
<h2>Demandes par type de soin</h2>
<table>
  <thead><tr><th>Type</th><th>Nb demandes</th><th>Montant approuvé</th></tr></thead>
  <tbody>${de.parTypeSoin.map(t => `<tr><td>${TYPE_LABELS[t.type] ?? t.type}</td><td>${N(t.nb)}</td><td>${FCFA(t.montant)}</td></tr>`).join('')}</tbody>
</table>`

    const top10Html = data.prestataires.top10.length > 0 ? `
<h2>Top 10 prestataires</h2>
<table>
  <thead><tr><th>Prestataire</th><th>Type</th><th>Nb demandes</th><th>Montant réglé</th></tr></thead>
  <tbody>${data.prestataires.top10.map(p => `<tr><td>${p.nom}</td><td>${p.type}</td><td>${N(p.nb_demandes)}</td><td>${FCFA(p.montant)}</td></tr>`).join('')}</tbody>
</table>` : ''

    const html = `
<h1>Rapport analytique — ${range.debut} au ${range.fin}</h1>
${kpisHtml}
${parMoisHtml}
${typeSoinHtml}
${top10Html}`
    printHTML(html, `Rapport analytique ${range.debut}`)
  }

  const sections = [
    { id: 'sante', label: 'Santé financière', icon: '💰' },
    { id: 'adherents', label: 'Adhérents', icon: '👥' },
    { id: 'demandes', label: 'Remboursements', icon: '📋' },
    { id: 'prestataires', label: 'Prestataires', icon: '🏥' },
    { id: 'risque', label: 'Profil de risque', icon: '📊' },
  ]

  return (
    <div className="space-y-6">

      {/* ── Header + sélecteur période ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Statistiques &amp; Analytics</h1>
            {data && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Période : {data.periode.debut} → {data.periode.fin}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {PERIODE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPeriode(opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    periode === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {periode === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customDebut}
                  onChange={e => setCustomDebut(e.target.value)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                />
                <span className="text-gray-400 text-xs">→</span>
                <input
                  type="date"
                  value={customFin}
                  onChange={e => setCustomFin(e.target.value)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                />
                <Button variant="primary" onClick={loadData} disabled={!customDebut || !customFin}>
                  Appliquer
                </Button>
              </div>
            )}
            <div className="flex gap-2 ml-2">
              <Button variant="secondary" onClick={handleExportCsv} disabled={!data || loading}>
                ↓ CSV
              </Button>
              <Button variant="secondary" onClick={handleExportPdf} disabled={!data || loading}>
                ↓ PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Nav sections ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg whitespace-nowrap font-medium transition-colors ${
              activeSection === s.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      {/* ── Sections ── */}
      <motion.div
        key={activeSection}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeSection === 'sante' && <SantePage data={data} loading={loading} />}
        {activeSection === 'adherents' && <AdherentsPage data={data} loading={loading} />}
        {activeSection === 'demandes' && <DemandesPage data={data} loading={loading} />}
        {activeSection === 'prestataires' && <PrestatairesPage data={data} loading={loading} />}
        {activeSection === 'risque' && <RisquePage data={data} loading={loading} />}
      </motion.div>
    </div>
  )
}

// ── Section 1 : Santé financière ──────────────────────────────────────────────

function SantePage({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  if (loading) return <LoadingSkeleton />
  if (!data) return <EmptyMsg />
  const sf = data.sante_financiere
  return (
    <div className="space-y-6">
      <SectionHeader title="Santé financière" icon="💰" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Total encaissé" value={FCFA(sf.totalEncaisse)} color="green" />
        <KpiCard label="Total remboursé" value={FCFA(sf.totalRembourse)} color="red" />
        <KpiCard
          label="Ratio sinistralité"
          value={`${sf.ratioSinistralite}%`}
          sub="remboursé / encaissé"
          color={sf.ratioSinistralite > 80 ? 'red' : sf.ratioSinistralite > 60 ? 'yellow' : 'green'}
        />
        <KpiCard
          label="Taux recouvrement"
          value={`${sf.tauxRecouvrementMoyen}%`}
          sub="encaissé / attendu"
          color={sf.tauxRecouvrementMoyen < 70 ? 'red' : sf.tauxRecouvrementMoyen < 85 ? 'yellow' : 'green'}
        />
        <KpiCard
          label="Réserve"
          value={`${sf.reserveMois} mois`}
          sub="solde / cotis. mensuelle"
          color={sf.reserveMois < 2 ? 'red' : sf.reserveMois < 4 ? 'yellow' : 'green'}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Cotisations vs Remboursements par mois</h3>
        <div className="overflow-x-auto">
          <div style={{ minWidth: 400 }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sf.parMois} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<FcfaTooltip />} />
                <Legend />
                <Bar dataKey="attendu" name="Attendu" fill="#93c5fd" radius={[2, 2, 0, 0]} />
                <Bar dataKey="encaisse" name="Encaissé" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="rembourse" name="Remboursé" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Solde net cumulé</h3>
        <div className="overflow-x-auto">
          <div style={{ minWidth: 400 }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={sf.soldeCumul} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<FcfaTooltip />} />
                <Line type="monotone" dataKey="solde" name="Solde cumulé" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section 2 : Adhérents ─────────────────────────────────────────────────────

function AdherentsPage({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  if (loading) return <LoadingSkeleton />
  if (!data) return <EmptyMsg />
  const ad = data.adherents
  return (
    <div className="space-y-6">
      <SectionHeader title="Activité adhérents" icon="👥" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution actifs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Évolution adhérents actifs</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={ad.evolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<NbTooltip />} />
              <Line type="monotone" dataKey="actifs" name="Actifs" stroke="#3b82f6" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Adhésions vs résiliations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Adhésions vs Résiliations</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ad.adhesionsResiliations}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<NbTooltip />} />
              <Legend />
              <Bar dataKey="adhesions" name="Adhésions" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="resiliations" name="Résiliations" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Répartition par plan */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Répartition par plan</h3>
          {ad.parPlan.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={ad.parPlan} dataKey="nb" nameKey="nom" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                    {ad.parPlan.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [N(v), name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {ad.parPlan.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-700 dark:text-gray-300">{p.nom}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{N(p.nb)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Adhérents avec/sans demande */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Recours aux soins par mois</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ad.adherentsAvecDemande}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<NbTooltip />} />
              <Legend />
              <Bar dataKey="avecDemande" name="Avec demande" stackId="a" fill="#3b82f6" />
              <Bar dataKey="sansDemande" name="Sans demande" stackId="a" fill="#e5e7eb" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 20 anonymisé */}
      {ad.top20.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            Top 20 consommateurs — anonymisé
            <span className="ml-2 text-xs font-normal text-gray-400">(identités non transmises)</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 text-gray-500 dark:text-gray-400 font-medium">Rang</th>
                  <th className="pb-2 text-gray-500 dark:text-gray-400 font-medium text-right">Montant remboursé</th>
                </tr>
              </thead>
              <tbody>
                {ad.top20.map((r) => (
                  <tr key={r.rang} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-1.5 text-gray-700 dark:text-gray-300">#{r.rang}</td>
                    <td className="py-1.5 text-right font-semibold text-gray-900 dark:text-white">{FCFA(r.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section 3 : Demandes de remboursement ─────────────────────────────────────

function DemandesPage({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  if (loading) return <LoadingSkeleton />
  if (!data) return <EmptyMsg />
  const de = data.demandes
  const tauxAppro = de.total > 0 ? Math.round((de.totalApprouves / de.total) * 100) : 0
  return (
    <div className="space-y-6">
      <SectionHeader title="Demandes de remboursement" icon="📋" />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard label="Total demandes" value={N(de.total)} color="blue" />
        <KpiCard label="Approuvées" value={N(de.totalApprouves)} sub={`${tauxAppro}% d'approbation`} color="green" />
        <KpiCard label="Montant total approuvé" value={FCFA(de.montantTotal)} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Par type de soin — horizontal */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Demandes par type de soin</h3>
          {de.parTypeSoin.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune demande</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={de.parTypeSoin} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={90}
                  tickFormatter={v => TYPE_LABELS[v] ?? v} />
                <Tooltip content={<NbTooltip />} />
                <Bar dataKey="nb" name="Nb demandes" fill="#3b82f6" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Répartition statuts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Répartition par statut</h3>
          {de.repartitionStatut.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={de.repartitionStatut} dataKey="nb" nameKey="statut" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                    {de.repartitionStatut.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [N(v), STATUT_LABELS[name] ?? name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {de.repartitionStatut.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-700 dark:text-gray-300">{STATUT_LABELS[s.statut] ?? s.statut}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{N(s.nb)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Délai moyen de traitement */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Délai moyen de traitement (heures)</h3>
          <span className="text-xs text-gray-400">Objectif : &lt; 72h</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={de.delaiParMois.filter(d => d.heures !== null)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<NbTooltip />} />
            <Line type="monotone" dataKey="heures" name="Délai (h)" stroke="#f59e0b" strokeWidth={2} dot />
            {/* Ligne objectif 72h */}
            <Line dataKey={() => 72} name="Objectif 72h" stroke="#ef4444" strokeDasharray="5 5" dot={false} legendType="line" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Motifs de refus */}
      {de.motifsRefus.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Principaux motifs de refus</h3>
          <div className="space-y-2">
            {de.motifsRefus.map((m, i) => {
              const maxNb = de.motifsRefus[0]?.nb ?? 1
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-32 flex-shrink-0 truncate" title={m.motif}>{m.motif}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all"
                      style={{ width: `${(m.nb / maxNb) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-8 text-right">{m.nb}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section 4 : Prestataires ──────────────────────────────────────────────────

function PrestatairesPage({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  if (loading) return <LoadingSkeleton />
  if (!data) return <EmptyMsg />
  const pr = data.prestataires
  const totalMode = pr.comparaisonMode.tp + pr.comparaisonMode.classique
  return (
    <div className="space-y-6">
      <SectionHeader title="Performance prestataires" icon="🏥" />

      {/* Comparaison mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Mode de remboursement</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Tiers payant', value: pr.comparaisonMode.tp },
                    { name: 'Classique', value: pr.comparaisonMode.classique },
                  ]}
                  dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60}
                >
                  <Cell fill="#3b82f6" />
                  <Cell fill="#10b981" />
                </Pie>
                <Tooltip formatter={(v: number) => [N(v), '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-600 dark:text-gray-300">Tiers payant</span>
                <span className="font-bold text-gray-900 dark:text-white">{N(pr.comparaisonMode.tp)}</span>
                {totalMode > 0 && <span className="text-xs text-gray-400">({Math.round(pr.comparaisonMode.tp / totalMode * 100)}%)</span>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-gray-600 dark:text-gray-300">Classique</span>
                <span className="font-bold text-gray-900 dark:text-white">{N(pr.comparaisonMode.classique)}</span>
                {totalMode > 0 && <span className="text-xs text-gray-400">({Math.round(pr.comparaisonMode.classique / totalMode * 100)}%)</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Top 10 prestataires (montants réglés)</h3>
        {pr.top10.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucune donnée de tiers payant pour la période</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 text-gray-500 dark:text-gray-400 font-medium">#</th>
                  <th className="pb-2 text-gray-500 dark:text-gray-400 font-medium">Prestataire</th>
                  <th className="pb-2 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                  <th className="pb-2 text-gray-500 dark:text-gray-400 font-medium text-center">Demandes</th>
                  <th className="pb-2 text-gray-500 dark:text-gray-400 font-medium text-right">Montant réglé</th>
                </tr>
              </thead>
              <tbody>
                {pr.top10.map((p, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-2 text-gray-400">#{i + 1}</td>
                    <td className="py-2 font-medium text-gray-800 dark:text-gray-200">{p.nom}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.type === 'pharmacie' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                        {p.type === 'pharmacie' ? 'Pharmacie' : 'Praticien'}
                      </span>
                    </td>
                    <td className="py-2 text-center text-gray-700 dark:text-gray-300">{N(p.nb_demandes)}</td>
                    <td className="py-2 text-right font-semibold text-gray-900 dark:text-white">{FCFA(p.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section 5 : Profil de risque ──────────────────────────────────────────────

function RisquePage({ data, loading }: { data: AnalyticsData | null; loading: boolean }) {
  if (loading) return <LoadingSkeleton />
  if (!data) return <EmptyMsg />
  const ri = data.profil_risque
  return (
    <div className="space-y-6">
      <SectionHeader title="Profil de risque" icon="📊" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution montants */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Distribution des montants remboursés (FCFA)</h3>
          {ri.distribution.every(d => d.nb === 0) ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune demande approuvée</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ri.distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<NbTooltip />} />
                <Bar dataKey="nb" name="Nb adhérents" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Saisonnalité */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Saisonnalité des demandes</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ri.saisonnalite}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<NbTooltip />} />
              <Bar dataKey="nb_demandes" name="Demandes" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top consommateurs (top 5%) */}
      {ri.topConsommateurs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Top 5% consommateurs</h3>
            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">anonymisé</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 text-gray-500 dark:text-gray-400 font-medium">Rang</th>
                  <th className="pb-2 text-gray-500 dark:text-gray-400 font-medium text-right">Montant total remboursé</th>
                </tr>
              </thead>
              <tbody>
                {ri.topConsommateurs.map((c) => (
                  <tr key={c.rang} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 text-gray-600 dark:text-gray-400">#{c.rang}</td>
                    <td className="py-2 text-right font-semibold text-gray-900 dark:text-white">{FCFA(c.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

function EmptyMsg() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
      <p className="text-gray-400 text-sm">Sélectionnez une période pour charger les analytics.</p>
    </div>
  )
}

export default MutuelleStatistiquesPage
