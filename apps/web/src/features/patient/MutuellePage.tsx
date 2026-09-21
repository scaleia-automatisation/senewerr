import { useState, useEffect, useCallback, useRef } from 'react'
import { format, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Eye, EyeOff, Maximize2, Download, AlertTriangle, ChevronRight,
  Users, FileText, CreditCard, Shield, RefreshCw, Plus, X,
  CheckCircle, Clock, XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Banner } from '@/components/ui/Banner'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Garantie {
  base_ss: string
  mutuelle: string
  plafond_annuel: number
  rembourse: number
}

interface AyantDroit {
  prenom: string
  lien: string
  date_naissance?: string
  consommation: number
  plafond: number
}

interface Mutuelle {
  id: string
  patient_id: string
  organisme: string
  numero_adherent: string
  numero_contrat: string
  formule: string
  date_debut: string
  date_fin_validite: string
  cotisation_mensuelle: number
  prochaine_echeance: string | null
  garanties: Record<string, Garantie>
  logo_url: string | null
  ayants_droit: AyantDroit[]
}

interface Remboursement {
  id: string
  date_acte: string
  type_acte: string
  montant_ss: number
  montant_mutuelle: number
  reste_a_charge: number
  statut: 'en_traitement' | 'rembourse' | 'rejete'
}

interface DocMutuelle {
  name: string
  path: string
  created_at: string
  size: number
}

type Tab = 'garanties' | 'remboursements' | 'contrat' | 'documents' | 'famille'

// ─── Constantes ──────────────────────────────────────────────────────────────
const POSTES = [
  { key: 'medecine_generale', label: 'Médecine générale' },
  { key: 'specialistes',      label: 'Spécialistes' },
  { key: 'dentaire',          label: 'Dentaire' },
  { key: 'optique',           label: 'Optique' },
  { key: 'hospitalisation',   label: 'Hospitalisation' },
  { key: 'paramedical',       label: 'Paramédical' },
  { key: 'maternite',         label: 'Maternité' },
  { key: 'medicaments',       label: 'Médicaments' },
  { key: 'urgences',          label: 'Urgences' },
]

const STATUT_CFG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  rembourse:    { label: 'Remboursé',      icon: <CheckCircle className="h-3.5 w-3.5" />, cls: 'bg-status-success/10 text-status-success' },
  en_traitement:{ label: 'En traitement',  icon: <Clock className="h-3.5 w-3.5" />,       cls: 'bg-status-pending/10 text-status-pending' },
  rejete:       { label: 'Rejeté',         icon: <XCircle className="h-3.5 w-3.5" />,     cls: 'bg-status-danger/10 text-status-danger'   },
}

const FCFA = (n: number) => new Intl.NumberFormat('fr-SN', { maximumFractionDigits: 0 }).format(n) + ' F'

// ─── Export helpers ───────────────────────────────────────────────────────────
function exportCSV(rows: Remboursement[], label: string) {
  const headers = ['Date', 'Acte', 'Sécurité sociale', 'Mutuelle', 'Reste à charge', 'Statut']
  const lines = rows.map(r => [
    format(new Date(r.date_acte), 'dd/MM/yyyy'),
    `"${r.type_acte}"`,
    r.montant_ss,
    r.montant_mutuelle,
    r.reste_a_charge,
    STATUT_CFG[r.statut]?.label ?? r.statut,
  ].join(';'))
  const csv = '﻿' + [headers.join(';'), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `remboursements-${label}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function exportPDF(rows: Remboursement[], mutuelle: Mutuelle, label: string) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Remboursements — ${mutuelle.organisme}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 24px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  p  { color: #666; margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #f3f4f6; padding: 8px; text-align: left; border: 1px solid #e5e7eb; font-size: 11px; }
  td { padding: 8px; border: 1px solid #e5e7eb; }
  .total { font-weight: bold; background: #f9fafb; }
</style></head><body>
<h1>Remboursements mutuelle</h1>
<p>${mutuelle.organisme} · ${mutuelle.numero_adherent} · Période : ${label}</p>
<table>
<thead><tr><th>Date</th><th>Acte</th><th>SS</th><th>Mutuelle</th><th>Reste à charge</th><th>Statut</th></tr></thead>
<tbody>
${rows.map(r => `<tr>
  <td>${format(new Date(r.date_acte), 'dd/MM/yyyy')}</td>
  <td>${r.type_acte}</td><td>${FCFA(r.montant_ss)}</td>
  <td>${FCFA(r.montant_mutuelle)}</td><td>${FCFA(r.reste_a_charge)}</td>
  <td>${STATUT_CFG[r.statut]?.label ?? r.statut}</td></tr>`).join('')}
<tr class="total">
  <td colspan="2">Total</td>
  <td>${FCFA(rows.reduce((s,r) => s + r.montant_ss, 0))}</td>
  <td>${FCFA(rows.reduce((s,r) => s + r.montant_mutuelle, 0))}</td>
  <td>${FCFA(rows.reduce((s,r) => s + r.reste_a_charge, 0))}</td><td></td></tr>
</tbody></table></body></html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close(); w.print() }
}

// ─── VirtualCard ─────────────────────────────────────────────────────────────
function VirtualCard({ mutuelle }: { mutuelle: Mutuelle }) {
  const [revealed, setRevealed] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const joursExpiry = differenceInDays(new Date(mutuelle.date_fin_validite), new Date())

  async function goFullscreen() {
    try {
      await document.documentElement.requestFullscreen()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (screen.orientation as any).lock?.('landscape')
    } catch { /* browser may not support */ }
  }

  function downloadCard() {
    // Ouvre la carte seule dans une nouvelle page pour impression
    const cardHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Carte tiers payant</title>
<style>
  body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #111; }
  .card { width: 340px; height: 200px; border-radius: 16px; padding: 24px;
    background: linear-gradient(135deg, #0f3460 0%, #16213e 50%, #0f3460 100%);
    color: white; display: flex; flex-direction: column; justify-content: space-between;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .organisme { font-size: 14px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .chip { width: 36px; height: 28px; background: linear-gradient(135deg, #ffd700, #ffa500); border-radius: 4px; }
  .mid { font-size: 11px; opacity: .7; text-transform: uppercase; letter-spacing: 2px; }
  .num { font-size: 13px; letter-spacing: 3px; font-family: monospace; }
  .bot { display: flex; align-items: flex-end; justify-content: space-between; }
  .label { font-size: 9px; opacity: .6; text-transform: uppercase; letter-spacing: 1px; }
  .val { font-size: 12px; font-weight: 600; margin-top: 2px; }
  @media print { body { background: white; } }
</style></head><body><div class="card">
<div class="top"><div class="organisme">${mutuelle.organisme}</div><div class="chip"></div></div>
<div><div class="mid">Tiers payant</div><div class="num">${mutuelle.numero_adherent}</div></div>
<div class="bot">
  <div><div class="label">Titulaire</div><div class="val">${mutuelle.formule}</div></div>
  <div><div class="label">Valide jusqu'au</div><div class="val">${format(new Date(mutuelle.date_fin_validite), 'MM/yyyy')}</div></div>
  <div><div class="label">Contrat</div><div class="val">${mutuelle.numero_contrat}</div></div>
</div></div></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(cardHtml); w.document.close(); setTimeout(() => w.print(), 500) }
  }

  const masked = mutuelle.numero_adherent.replace(/./g, (c, i) =>
    i < mutuelle.numero_adherent.length - 4 ? '•' : c
  )

  return (
    <div className="space-y-s-3">
      {joursExpiry > 0 && joursExpiry <= 30 && (
        <Banner kind="warning" className="rounded-md">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Votre mutuelle expire dans {joursExpiry} jour{joursExpiry > 1 ? 's' : ''}. Pensez à la renouveler.
        </Banner>
      )}
      {joursExpiry <= 0 && (
        <Banner kind="warning" className="rounded-md">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Votre mutuelle a expiré. Contactez votre organisme pour la renouveler.
        </Banner>
      )}

      {/* Carte physique */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl p-s-5 text-white shadow-2"
        style={{ background: 'linear-gradient(135deg, #0f3460 0%, #16213e 50%, #1a1a5e 100%)', minHeight: 200 }}
      >
        {/* Cercles décoratifs */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-pill bg-white/5" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-pill bg-white/5" />

        {/* Ligne haut */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-s-3">
            {mutuelle.logo_url ? (
              <img src={mutuelle.logo_url} alt={mutuelle.organisme} className="h-8 w-8 rounded object-contain bg-white p-0.5" />
            ) : (
              <Shield className="h-6 w-6 text-white/80" />
            )}
            <div>
              <p className="text-micro font-bold uppercase tracking-widest text-white/60">Tiers payant</p>
              <p className="font-bold tracking-wide">{mutuelle.organisme}</p>
            </div>
          </div>
          {/* Chip */}
          <div className="h-8 w-10 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500" />
        </div>

        {/* Numéro adhérent */}
        <div className="my-s-4 flex items-center gap-s-3">
          <p className="font-mono text-h3 tracking-widest">
            {revealed ? mutuelle.numero_adherent : masked}
          </p>
          <button
            onClick={() => setRevealed(v => !v)}
            className="rounded p-1 text-white/60 hover:text-white transition-colors"
            aria-label={revealed ? 'Masquer' : 'Révéler'}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Ligne bas */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-micro uppercase tracking-widest text-white/50">Formule</p>
            <p className="text-small font-semibold">{mutuelle.formule}</p>
          </div>
          <div>
            <p className="text-micro uppercase tracking-widest text-white/50">Valide jusqu'au</p>
            <p className="text-small font-semibold">{format(new Date(mutuelle.date_fin_validite), 'MM/yyyy')}</p>
          </div>
          <div>
            <p className="text-micro uppercase tracking-widest text-white/50">N° contrat</p>
            <p className="text-small font-semibold">{mutuelle.numero_contrat}</p>
          </div>
        </div>
      </div>

      {/* Actions carte */}
      <div className="flex flex-wrap gap-s-2">
        <Button size="sm" variant="secondary" leftIcon={<Maximize2 className="h-4 w-4" />} onClick={goFullscreen}>
          Plein écran
        </Button>
        <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={downloadCard}>
          Télécharger PDF
        </Button>
      </div>
    </div>
  )
}

// ─── NoMutuelle ───────────────────────────────────────────────────────────────
function NoMutuelle({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={<Shield className="h-10 w-10" />}
      title="Aucune mutuelle enregistrée"
      description="Ajoutez votre mutuelle pour accéder au tiers payant virtuel et suivre vos remboursements."
      action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={onAdd}>Ajouter ma mutuelle</Button>}
    />
  )
}

// ─── GaugeBar ─────────────────────────────────────────────────────────────────
function GaugeBar({ value, max, colorClass = 'bg-primary' }: { value: number; max: number; colorClass?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-s-2">
      <div className="flex-1 h-1.5 rounded-pill bg-surface-2 overflow-hidden">
        <div
          className={cn('h-full rounded-pill transition-all', pct > 80 ? 'bg-status-danger' : pct > 50 ? 'bg-status-pending' : colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-micro text-ink-3 w-8 text-right">{pct}%</span>
    </div>
  )
}

// ─── TabGaranties ─────────────────────────────────────────────────────────────
function TabGaranties({ garanties }: { garanties: Record<string, Garantie> }) {
  const rows = POSTES.map(p => ({ ...p, g: garanties[p.key] ?? null }))

  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-[540px] text-small">
        <thead>
          <tr className="bg-surface-2 border-b border-line">
            <th className="text-left px-s-3 py-s-2 font-semibold text-ink">Poste</th>
            <th className="text-center px-s-3 py-s-2 font-semibold text-ink">Base SS</th>
            <th className="text-center px-s-3 py-s-2 font-semibold text-ink">% Mutuelle</th>
            <th className="text-center px-s-3 py-s-2 font-semibold text-ink">Plafond annuel</th>
            <th className="text-left px-s-3 py-s-2 font-semibold text-ink w-40">Consommation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(r => (
            <tr key={r.key} className="hover:bg-surface-2 transition-colors">
              <td className="px-s-3 py-s-2 font-medium text-ink">{r.label}</td>
              <td className="px-s-3 py-s-2 text-center text-ink-2">{r.g?.base_ss ?? '—'}</td>
              <td className="px-s-3 py-s-2 text-center text-primary font-semibold">{r.g?.mutuelle ?? '—'}</td>
              <td className="px-s-3 py-s-2 text-center text-ink-2">
                {r.g?.plafond_annuel ? FCFA(r.g.plafond_annuel) : '—'}
              </td>
              <td className="px-s-3 py-s-2">
                {r.g?.plafond_annuel ? (
                  <div>
                    <GaugeBar value={r.g.rembourse ?? 0} max={r.g.plafond_annuel} />
                    <p className="text-micro text-ink-3 mt-0.5">
                      {FCFA(r.g.rembourse ?? 0)} / {FCFA(r.g.plafond_annuel)}
                    </p>
                  </div>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── TabRemboursements ────────────────────────────────────────────────────────
function TabRemboursements({
  mutuelle, rows, loading, onLoadMore, hasMore,
}: {
  mutuelle: Mutuelle
  rows: Remboursement[]
  loading: boolean
  onLoadMore: () => void
  hasMore: boolean
}) {
  const [filterStatut, setFilterStatut] = useState('')
  const [filterType, setFilterType]     = useState('')
  const [filterPeriode, setFilterPeriode] = useState('all')

  const filtered = rows.filter(r => {
    const matchS = !filterStatut || r.statut === filterStatut
    const matchT = !filterType   || r.type_acte.toLowerCase().includes(filterType.toLowerCase())
    if (filterPeriode !== 'all') {
      const months = filterPeriode === '1m' ? 1 : filterPeriode === '3m' ? 3 : filterPeriode === '6m' ? 6 : 12
      const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months)
      if (new Date(r.date_acte) < cutoff) return false
    }
    return matchS && matchT
  })

  const total_ss  = filtered.reduce((s, r) => s + r.montant_ss, 0)
  const total_mut = filtered.reduce((s, r) => s + r.montant_mutuelle, 0)
  const total_rac = filtered.reduce((s, r) => s + r.reste_a_charge, 0)

  const periodLabel = filterPeriode === '1m' ? '1 mois' : filterPeriode === '3m' ? '3 mois' :
    filterPeriode === '6m' ? '6 mois' : filterPeriode === '12m' ? '12 mois' : 'Tout'

  return (
    <div className="flex flex-col gap-s-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-s-2">
        <select
          value={filterPeriode}
          onChange={e => setFilterPeriode(e.target.value)}
          className="rounded-md border border-line bg-surface px-s-3 py-s-1.5 text-small text-ink focus:outline-none focus:shadow-focus"
        >
          <option value="all">Toute période</option>
          <option value="1m">1 mois</option>
          <option value="3m">3 mois</option>
          <option value="6m">6 mois</option>
          <option value="12m">12 mois</option>
        </select>
        <select
          value={filterStatut}
          onChange={e => setFilterStatut(e.target.value)}
          className="rounded-md border border-line bg-surface px-s-3 py-s-1.5 text-small text-ink focus:outline-none focus:shadow-focus"
        >
          <option value="">Tous les statuts</option>
          <option value="rembourse">Remboursé</option>
          <option value="en_traitement">En traitement</option>
          <option value="rejete">Rejeté</option>
        </select>
        <input
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          placeholder="Type d'acte…"
          className="rounded-md border border-line bg-surface px-s-3 py-s-1.5 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:shadow-focus"
        />
        <div className="flex-1" />
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Download className="h-4 w-4" />}
          onClick={() => exportCSV(filtered, periodLabel)}
          disabled={filtered.length === 0}
        >
          CSV
        </Button>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<FileText className="h-4 w-4" />}
          onClick={() => exportPDF(filtered, mutuelle, periodLabel)}
          disabled={filtered.length === 0}
        >
          PDF
        </Button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex flex-col gap-s-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-md" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<RefreshCw className="h-8 w-8" />} title="Aucun remboursement" description="Vos remboursements apparaîtront ici après traitement par votre organisme." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[520px] text-small">
              <thead>
                <tr className="bg-surface-2 border-b border-line">
                  <th className="text-left px-s-3 py-s-2 font-semibold text-ink">Date</th>
                  <th className="text-left px-s-3 py-s-2 font-semibold text-ink">Acte</th>
                  <th className="text-right px-s-3 py-s-2 font-semibold text-ink">SS</th>
                  <th className="text-right px-s-3 py-s-2 font-semibold text-ink">Mutuelle</th>
                  <th className="text-right px-s-3 py-s-2 font-semibold text-ink">Reste</th>
                  <th className="text-center px-s-3 py-s-2 font-semibold text-ink">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map(r => {
                  const s = STATUT_CFG[r.statut] ?? { label: r.statut, icon: null, cls: 'bg-surface-2 text-ink-2' }
                  return (
                    <tr key={r.id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-s-3 py-s-2 text-ink-2 whitespace-nowrap">
                        {format(new Date(r.date_acte), 'd MMM yyyy', { locale: fr })}
                      </td>
                      <td className="px-s-3 py-s-2 text-ink">{r.type_acte}</td>
                      <td className="px-s-3 py-s-2 text-right text-ink-2">{FCFA(r.montant_ss)}</td>
                      <td className="px-s-3 py-s-2 text-right text-status-success font-medium">{FCFA(r.montant_mutuelle)}</td>
                      <td className="px-s-3 py-s-2 text-right text-ink font-semibold">{FCFA(r.reste_a_charge)}</td>
                      <td className="px-s-3 py-s-2 text-center">
                        <span className={cn('inline-flex items-center gap-s-1 rounded-pill px-s-2 py-0.5 text-micro font-medium', s.cls)}>
                          {s.icon}{s.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Totaux */}
              <tfoot>
                <tr className="bg-surface-2 border-t-2 border-line font-semibold text-ink">
                  <td className="px-s-3 py-s-2" colSpan={2}>Total ({filtered.length} acte{filtered.length > 1 ? 's' : ''})</td>
                  <td className="px-s-3 py-s-2 text-right">{FCFA(total_ss)}</td>
                  <td className="px-s-3 py-s-2 text-right text-status-success">{FCFA(total_mut)}</td>
                  <td className="px-s-3 py-s-2 text-right">{FCFA(total_rac)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {hasMore && (
            <Button variant="secondary" size="sm" loading={loading} onClick={onLoadMore}>Voir plus</Button>
          )}
        </>
      )}
    </div>
  )
}

// ─── TabContrat ───────────────────────────────────────────────────────────────
function TabContrat({ mutuelle }: { mutuelle: Mutuelle }) {
  const joursEcheance = mutuelle.prochaine_echeance
    ? differenceInDays(new Date(mutuelle.prochaine_echeance), new Date())
    : null

  return (
    <div className="flex flex-col gap-s-4">
      <div className="rounded-md border border-line divide-y divide-line">
        {[
          { label: 'Organisme',          val: mutuelle.organisme },
          { label: 'Numéro de contrat',  val: mutuelle.numero_contrat },
          { label: 'Formule',            val: mutuelle.formule },
          { label: 'Date d\'adhésion',   val: format(new Date(mutuelle.date_debut), 'd MMMM yyyy', { locale: fr }) },
          { label: 'Validité',           val: `jusqu\'au ${format(new Date(mutuelle.date_fin_validite), 'd MMMM yyyy', { locale: fr })}` },
          {
            label: 'Cotisation mensuelle',
            val: FCFA(mutuelle.cotisation_mensuelle),
          },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between px-s-4 py-s-3">
            <span className="text-small text-ink-2">{row.label}</span>
            <span className="text-small font-medium text-ink">{row.val}</span>
          </div>
        ))}
        {mutuelle.prochaine_echeance && (
          <div className="flex items-center justify-between px-s-4 py-s-3">
            <span className="text-small text-ink-2">Prochaine échéance</span>
            <div className="flex items-center gap-s-2">
              <span className="text-small font-medium text-ink">
                {format(new Date(mutuelle.prochaine_echeance), 'd MMM yyyy', { locale: fr })}
              </span>
              {joursEcheance !== null && joursEcheance <= 7 && joursEcheance >= 0 && (
                <span className="rounded-pill bg-status-pending/10 px-s-2 py-0.5 text-micro font-medium text-status-pending">
                  dans {joursEcheance}j
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <Button variant="secondary">
        Modifier ma formule <ChevronRight className="inline h-4 w-4 ml-s-1" />
      </Button>
      <p className="text-micro text-ink-3">Vous serez redirigé vers le portail de votre organisme mutualiste.</p>
    </div>
  )
}

// ─── TabDocuments ─────────────────────────────────────────────────────────────
function TabDocuments({ patientId }: { patientId: string }) {
  const [docs, setDocs]   = useState<DocMutuelle[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    supabase.storage.from('documents')
      .list(`mutuelle/${patientId}`, { sortBy: { column: 'created_at', order: 'desc' } })
      .then(({ data }) => {
        setDocs((data ?? []).map(f => ({
          name: f.name,
          path: `mutuelle/${patientId}/${f.name}`,
          created_at: f.created_at ?? '',
          size: f.metadata?.size ?? 0,
        })))
        setLoading(false)
      })
  }, [patientId])

  async function download(path: string, name: string) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
    if (data?.signedUrl) {
      const a = document.createElement('a'); a.href = data.signedUrl; a.download = name; a.click()
    }
  }

  return (
    <div className="flex flex-col gap-s-3">
      {loading ? (
        [1, 2].map(i => <Skeleton key={i} className="h-14 rounded-md" />)
      ) : docs.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="Aucun document" description="Attestations de droits et justificatifs de cotisation apparaîtront ici." />
      ) : (
        docs.map(doc => (
          <div key={doc.path} className="flex items-center justify-between rounded-md border border-line px-s-4 py-s-3">
            <div className="flex items-center gap-s-3 min-w-0">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-small font-medium text-ink truncate">{doc.name}</p>
                {doc.created_at && (
                  <p className="text-micro text-ink-3">
                    {format(new Date(doc.created_at), 'd MMM yyyy', { locale: fr })}
                  </p>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" leftIcon={<Download className="h-4 w-4" />} onClick={() => download(doc.path, doc.name)}>
              Télécharger
            </Button>
          </div>
        ))
      )}
    </div>
  )
}

// ─── TabFamille ───────────────────────────────────────────────────────────────
function TabFamille({ ayants_droit }: { ayants_droit: AyantDroit[] }) {
  if (ayants_droit.length === 0) {
    return (
      <EmptyState icon={<Users className="h-8 w-8" />} title="Aucun ayant droit" description="Les membres couverts par votre contrat apparaîtront ici." />
    )
  }
  return (
    <div className="flex flex-col gap-s-3">
      {ayants_droit.map((a, i) => (
        <div key={i} className="rounded-md border border-line px-s-4 py-s-3">
          <div className="flex items-center justify-between mb-s-2">
            <div>
              <p className="font-medium text-ink">{a.prenom}</p>
              <p className="text-small text-ink-2">{a.lien}</p>
              {a.date_naissance && (
                <p className="text-micro text-ink-3">
                  Né(e) le {format(new Date(a.date_naissance), 'd MMM yyyy', { locale: fr })}
                </p>
              )}
            </div>
            <span className="text-small font-medium text-ink">{FCFA(a.consommation)} / {FCFA(a.plafond)}</span>
          </div>
          <GaugeBar value={a.consommation} max={a.plafond} />
        </div>
      ))}
    </div>
  )
}

// ─── AddMutuelleModal ─────────────────────────────────────────────────────────
function AddMutuelleModal({
  patientId, onClose, onSaved,
}: {
  patientId: string; onClose: () => void; onSaved: () => void
}) {
  const db = supabase as any
  const [form, setForm] = useState({
    organisme: '', numero_adherent: '', numero_contrat: '',
    formule: '', date_debut: '', date_fin_validite: '', cotisation_mensuelle: '',
  })
  const [saving, setSaving] = useState(false)

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const valid = form.organisme && form.numero_adherent && form.date_debut && form.date_fin_validite

  async function save() {
    if (!valid) return
    setSaving(true)
    await db.from('mutuelles_patients').insert({
      patient_id: patientId,
      organisme: form.organisme,
      numero_adherent: form.numero_adherent,
      numero_contrat: form.numero_contrat || null,
      formule: form.formule || null,
      date_debut: form.date_debut,
      date_fin_validite: form.date_fin_validite,
      cotisation_mensuelle: form.cotisation_mensuelle ? parseFloat(form.cotisation_mensuelle) : 0,
      garanties: {},
      ayants_droit: [],
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open onOpenChange={v => !v && onClose()} title="Ajouter ma mutuelle" size="md">
      <div className="flex flex-col gap-s-3">
        {[
          { k: 'organisme',         label: 'Organisme *',          type: 'text', ph: 'ex : IPRES, LONASE Santé…' },
          { k: 'numero_adherent',   label: 'N° adhérent *',        type: 'text', ph: '' },
          { k: 'numero_contrat',    label: 'N° contrat',           type: 'text', ph: '' },
          { k: 'formule',           label: 'Formule',              type: 'text', ph: 'ex : Famille, Essentiel…' },
          { k: 'date_debut',        label: 'Date d\'adhésion *',   type: 'date', ph: '' },
          { k: 'date_fin_validite', label: 'Date d\'expiration *', type: 'date', ph: '' },
          { k: 'cotisation_mensuelle', label: 'Cotisation mensuelle (F CFA)', type: 'number', ph: '' },
        ].map(row => (
          <div key={row.k}>
            <label className="mb-s-1 block text-small font-medium text-ink">{row.label}</label>
            <input
              type={row.type}
              value={(form as Record<string, string>)[row.k]}
              onChange={e => f(row.k, e.target.value)}
              placeholder={row.ph}
              className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:shadow-focus"
            />
          </div>
        ))}
        <div className="flex gap-s-2 pt-s-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1" onClick={save} loading={saving} disabled={!valid}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── MutuellePage ─────────────────────────────────────────────────────────────
const PAGE_SIZE = 20

export default function MutuellePage() {
  const db = supabase as any
  const { profile } = useAuth()

  const [mutuelle, setMutuelle]     = useState<Mutuelle | null>(null)
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<Tab>('garanties')
  const [rembos, setRembos]         = useState<Remboursement[]>([])
  const [rembosLoading, setRembosLoading] = useState(false)
  const [rembosPage, setRembosPage] = useState(0)
  const [rembosHasMore, setRembosHasMore] = useState(false)
  const [addOpen, setAddOpen]       = useState(false)

  const fetchMutuelle = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await db.from('mutuelles_patients')
      .select('*')
      .eq('patient_id', profile.id)
      .order('date_fin_validite', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setMutuelle({
        ...data,
        garanties: data.garanties ?? {},
        ayants_droit: Array.isArray(data.ayants_droit) ? data.ayants_droit : [],
      })
    }
    setLoading(false)
  }, [profile?.id])

  const fetchRembos = useCallback(async (reset = false) => {
    if (!profile?.id) return
    setRembosLoading(true)
    const p = reset ? 0 : rembosPage
    if (reset) setRembosPage(0)
    const { data } = await db.from('remboursements_mutuelle')
      .select('*')
      .eq('patient_id', profile.id)
      .order('date_acte', { ascending: false })
      .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE)
    const mapped = (data ?? []) as Remboursement[]
    setRembos(reset ? mapped : prev => [...prev, ...mapped])
    setRembosHasMore(mapped.length > PAGE_SIZE)
    setRembosLoading(false)
  }, [profile?.id, rembosPage])

  useEffect(() => { fetchMutuelle() }, [fetchMutuelle])

  useEffect(() => {
    if (tab === 'remboursements') fetchRembos(true)
  }, [tab])

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'garanties',      label: 'Garanties',     icon: <Shield className="h-4 w-4" /> },
    { key: 'remboursements', label: 'Remboursements', icon: <RefreshCw className="h-4 w-4" /> },
    { key: 'contrat',        label: 'Contrat',        icon: <CreditCard className="h-4 w-4" /> },
    { key: 'documents',      label: 'Documents',      icon: <FileText className="h-4 w-4" /> },
    { key: 'famille',        label: 'Famille',        icon: <Users className="h-4 w-4" /> },
  ]

  if (loading) {
    return (
      <div className="flex flex-col gap-s-4 pb-s-8">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-[200px] rounded-2xl" />
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-48 rounded-md" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-s-5 pb-s-8">

      {/* Header */}
      <h1 className="font-display text-h1 font-semibold text-ink">Ma mutuelle</h1>

      {/* Carte virtuelle ou état vide */}
      {mutuelle ? (
        <VirtualCard mutuelle={mutuelle} />
      ) : (
        <NoMutuelle onAdd={() => setAddOpen(true)} />
      )}

      {/* Onglets — seulement si mutuelle existe */}
      {mutuelle && (
        <>
          <div className="flex gap-0 overflow-x-auto border-b border-line scrollbar-none">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-s-1.5 whitespace-nowrap pb-s-2 px-s-3 text-small font-medium transition-colors shrink-0',
                  tab === t.key ? 'border-b-2 border-primary text-primary' : 'text-ink-2 hover:text-ink',
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div>
            {tab === 'garanties'      && <TabGaranties garanties={mutuelle.garanties} />}
            {tab === 'remboursements' && (
              <TabRemboursements
                mutuelle={mutuelle}
                rows={rembos}
                loading={rembosLoading}
                onLoadMore={() => { setRembosPage(p => p + 1); fetchRembos() }}
                hasMore={rembosHasMore}
              />
            )}
            {tab === 'contrat'        && <TabContrat mutuelle={mutuelle} />}
            {tab === 'documents'      && <TabDocuments patientId={profile!.id} />}
            {tab === 'famille'        && <TabFamille ayants_droit={mutuelle.ayants_droit} />}
          </div>
        </>
      )}

      {/* Modal ajout mutuelle */}
      {addOpen && (
        <AddMutuelleModal
          patientId={profile!.id}
          onClose={() => setAddOpen(false)}
          onSaved={fetchMutuelle}
        />
      )}
    </div>
  )
}
