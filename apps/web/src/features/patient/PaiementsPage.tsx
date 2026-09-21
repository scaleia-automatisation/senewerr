import { useState, useEffect, useCallback, useRef } from 'react'
import { format, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  CreditCard, Download, FileText, AlertTriangle, CheckCircle,
  Clock, XCircle, Plus, Trash2, Upload, Paperclip, X, RefreshCw,
} from 'lucide-react'
import { loadStripe, type Stripe, type StripeCardElement } from '@stripe/stripe-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Banner } from '@/components/ui/Banner'
import { cn } from '@/lib/utils'

// ─── Stripe singleton (publishable key uniquement) ────────────────────────────
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '')

// ─── Types ────────────────────────────────────────────────────────────────────
interface Facture {
  id: string
  praticien_id: string | null
  date_facture: string
  montant_total: number
  montant_rembourse_ss: number
  montant_rembourse_mutuelle: number
  reste_a_charge: number
  statut: 'a_payer' | 'en_attente_remboursement' | 'reglee'
  echeance: string | null
  pdf_url: string | null
  praticien_nom: string
}

interface Paiement {
  id: string
  facture_id: string
  montant: number
  date_paiement: string
  mode_paiement: string
  type_acte?: string
  praticien_nom?: string
}

interface SavedCard {
  id: string
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

interface FeuilleSoin {
  id: string
  date_soin: string
  statut: 'en_traitement' | 'rembourse' | 'rejete'
  motif_rejet: string | null
  montant?: number
}

type Tab = 'factures' | 'historique' | 'cartes' | 'feuilles'

// ─── Constantes ───────────────────────────────────────────────────────────────
const FCFA = (n: number) => new Intl.NumberFormat('fr-SN', { maximumFractionDigits: 0 }).format(n) + ' F'

const STATUT_FACTURE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  a_payer:                 { label: 'À payer',                     cls: 'bg-status-danger/10 text-status-danger',   icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  en_attente_remboursement:{ label: 'En attente remboursement',    cls: 'bg-status-pending/10 text-status-pending', icon: <Clock className="h-3.5 w-3.5" /> },
  reglee:                  { label: 'Réglée',                      cls: 'bg-status-success/10 text-status-success', icon: <CheckCircle className="h-3.5 w-3.5" /> },
}

const STATUT_FEUILLE: Record<string, { label: string; cls: string }> = {
  en_traitement: { label: 'En traitement', cls: 'bg-status-pending/10 text-status-pending' },
  rembourse:     { label: 'Remboursé',     cls: 'bg-status-success/10 text-status-success' },
  rejete:        { label: 'Rejeté',        cls: 'bg-status-danger/10 text-status-danger'   },
}

// ─── useCountUp hook ──────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target === 0) return
    const start = Date.now()
    const raf = () => {
      const elapsed = Date.now() - start
      const pct = Math.min(elapsed / duration, 1)
      // easeOutQuad
      setValue(Math.round(target * (1 - (1 - pct) ** 2)))
      if (pct < 1) requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
  }, [target, duration])
  return value
}

// ─── BillanCards ─────────────────────────────────────────────────────────────
function BillanCards({ totalActes, totalRembourse, resteACharge }: {
  totalActes: number; totalRembourse: number; resteACharge: number
}) {
  const cActes      = useCountUp(totalActes)
  const cRembourse  = useCountUp(totalRembourse)
  const cReste      = useCountUp(resteACharge)

  const cards = [
    { label: 'Total actes (année)',     val: cActes,     cls: 'text-ink' },
    { label: 'Remboursé SS + mutuelle', val: cRembourse, cls: 'text-status-success' },
    { label: 'Reste à charge',          val: cReste,     cls: 'text-status-danger' },
  ]

  return (
    <div className="grid grid-cols-3 gap-s-3">
      {cards.map(c => (
        <div key={c.label} className="rounded-md border border-line bg-surface px-s-4 py-s-3 text-center">
          <p className={cn('font-display text-h2 font-bold', c.cls)}>{FCFA(c.val)}</p>
          <p className="mt-s-1 text-micro text-ink-3">{c.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── PaymentModal (Stripe CardElement) ───────────────────────────────────────
function PaymentModal({
  facture, open, onClose, onSuccess, savedCards,
}: {
  facture: Facture | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
  savedCards: SavedCard[]
}) {
  const [selectedCard, setSelectedCard] = useState<string>('new')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripeObj, setStripeObj]       = useState<Stripe | null>(null)
  const [cardEl, setCardEl]             = useState<StripeCardElement | null>(null)
  const [paying, setPaying]             = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [success, setSuccess]           = useState(false)
  const cardDivRef = useRef<HTMLDivElement>(null)

  // Charger l'intent au montage
  useEffect(() => {
    if (!open || !facture) return
    setError(null); setSuccess(false)
    supabase.functions.invoke('create-payment-intent', {
      body: { factureId: facture.id, currency: 'xof' },
    }).then(({ data }) => setClientSecret(data?.clientSecret ?? null))
    stripePromise.then(s => setStripeObj(s))
  }, [open, facture?.id])

  // Monter CardElement quand on choisit "new"
  useEffect(() => {
    if (!open || selectedCard !== 'new' || !stripeObj || !cardDivRef.current) return
    if (cardEl) { cardEl.unmount(); setCardEl(null) }
    const elements = stripeObj.elements()
    const card = elements.create('card', {
      style: {
        base: { fontSize: '15px', fontFamily: 'inherit', color: '#111', '::placeholder': { color: '#9ca3af' } },
        invalid: { color: '#ef4444' },
      },
    })
    card.mount(cardDivRef.current)
    setCardEl(card)
    return () => { card.unmount() }
  }, [open, selectedCard, stripeObj])

  async function pay() {
    if (!stripeObj || !clientSecret || !facture) return
    setPaying(true); setError(null)
    try {
      let result
      if (selectedCard !== 'new') {
        result = await stripeObj.confirmCardPayment(clientSecret, {
          payment_method: selectedCard,
        })
      } else {
        if (!cardEl) { setPaying(false); return }
        result = await stripeObj.confirmCardPayment(clientSecret, {
          payment_method: { card: cardEl },
        })
      }
      if (result.error) {
        setError(result.error.message ?? 'Paiement échoué')
      } else if (result.paymentIntent?.status === 'succeeded') {
        setSuccess(true)
        setTimeout(() => { onClose(); onSuccess() }, 2000)
      }
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erreur inattendue')
    }
    setPaying(false)
  }

  return (
    <Modal open={open} onOpenChange={v => !v && !paying && onClose()} title="Paiement sécurisé" size="md">
      {!facture ? null : success ? (
        <div className="flex flex-col items-center gap-s-4 py-s-6 text-center">
          <CheckCircle className="h-12 w-12 text-status-success" />
          <div>
            <p className="font-semibold text-ink">Paiement confirmé !</p>
            <p className="text-small text-ink-2 mt-s-1">Vous recevrez une confirmation par notification.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-s-4">
          {/* Récap */}
          <div className="rounded-md bg-surface-2 px-s-4 py-s-3 flex items-center justify-between">
            <div>
              <p className="text-small font-medium text-ink">{facture.praticien_nom}</p>
              <p className="text-micro text-ink-3">{format(new Date(facture.date_facture), 'd MMM yyyy', { locale: fr })}</p>
            </div>
            <p className="font-display text-h3 font-bold text-ink">{FCFA(facture.reste_a_charge)}</p>
          </div>

          {/* Moyen de paiement */}
          {savedCards.length > 0 && (
            <div className="flex flex-col gap-s-2">
              {savedCards.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCard(c.id)}
                  className={cn(
                    'flex items-center gap-s-3 rounded-md border p-s-3 text-left transition-colors',
                    selectedCard === c.id ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-2',
                  )}
                >
                  <CreditCard className="h-5 w-5 text-ink-3 shrink-0" />
                  <span className="flex-1 text-small text-ink capitalize">
                    {c.brand} •••• {c.last4}
                  </span>
                  <span className="text-micro text-ink-3">{c.exp_month}/{c.exp_year}</span>
                </button>
              ))}
              <button
                onClick={() => setSelectedCard('new')}
                className={cn(
                  'flex items-center gap-s-3 rounded-md border p-s-3 text-left transition-colors',
                  selectedCard === 'new' ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-2',
                )}
              >
                <Plus className="h-5 w-5 text-primary shrink-0" />
                <span className="text-small text-primary font-medium">Nouvelle carte</span>
              </button>
            </div>
          )}

          {/* Stripe CardElement */}
          {(selectedCard === 'new' || savedCards.length === 0) && (
            <div>
              <p className="mb-s-2 text-small font-medium text-ink">Carte bancaire</p>
              <div
                ref={cardDivRef}
                id="stripe-card-element"
                className="rounded-md border border-line bg-surface px-s-3 py-s-3 min-h-[42px]"
              />
              <div className="mt-s-2 flex items-center gap-s-2 text-micro text-ink-3">
                <svg className="h-4 w-10 shrink-0" viewBox="0 0 40 16" fill="none" aria-hidden="true">
                  <rect width="40" height="16" rx="3" fill="#635bff" />
                  <text x="4" y="12" fill="white" fontSize="9" fontFamily="sans-serif">stripe</text>
                </svg>
                Paiement sécurisé par Stripe · TLS 256 bits
              </div>
            </div>
          )}

          {error && (
            <Banner kind="warning" className="rounded-md">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </Banner>
          )}

          <div className="flex gap-s-2">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={paying}>Annuler</Button>
            <Button className="flex-1" onClick={pay} loading={paying} disabled={!clientSecret}>
              Payer {FCFA(facture.reste_a_charge)}
            </Button>
          </div>
          <p className="text-center text-micro text-ink-3">
            Aucune donnée de carte stockée sur nos serveurs. Traitement sécurisé par Stripe.
          </p>
        </div>
      )}
    </Modal>
  )
}

// ─── InstallmentModal ─────────────────────────────────────────────────────────
function InstallmentModal({
  facture, open, onClose, onSuccess,
}: {
  facture: Facture | null; open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [plan, setPlan] = useState<2 | 3>(2)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function confirm() {
    if (!facture) return
    setSubmitting(true)
    await supabase.functions.invoke('create-installment-plan', {
      body: { factureId: facture.id, installments: plan },
    })
    setDone(true)
    setSubmitting(false)
    setTimeout(() => { onClose(); onSuccess() }, 1800)
  }

  if (!facture) return null
  const tranche = Math.ceil(facture.reste_a_charge / plan)

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title="Paiement en plusieurs fois" size="sm">
      {done ? (
        <div className="flex flex-col items-center gap-s-4 py-s-6 text-center">
          <CheckCircle className="h-12 w-12 text-status-success" />
          <p className="font-semibold text-ink">Échéancier créé !</p>
        </div>
      ) : (
        <div className="flex flex-col gap-s-4">
          <div className="grid grid-cols-2 gap-s-2">
            {([2, 3] as const).map(n => (
              <button
                key={n}
                onClick={() => setPlan(n)}
                className={cn(
                  'rounded-md border p-s-3 text-center transition-colors',
                  plan === n ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-2',
                )}
              >
                <p className="font-bold text-ink">{n}x</p>
                <p className="text-small text-ink-2">{FCFA(Math.ceil(facture.reste_a_charge / n))} / mois</p>
              </button>
            ))}
          </div>
          <div className="rounded-md bg-surface-2 px-s-4 py-s-3">
            <p className="text-small font-medium text-ink">Récapitulatif</p>
            <div className="mt-s-2 flex flex-col gap-s-1">
              {Array.from({ length: plan }, (_, i) => (
                <div key={i} className="flex justify-between text-small">
                  <span className="text-ink-2">Versement {i + 1}</span>
                  <span className="font-medium text-ink">{FCFA(i < plan - 1 ? tranche : facture.reste_a_charge - tranche * (plan - 1))}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-s-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button className="flex-1" onClick={confirm} loading={submitting}>Confirmer</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── FactureCard ──────────────────────────────────────────────────────────────
function FactureCard({
  facture, onPay, onInstallment, savedCards,
}: {
  facture: Facture
  onPay: () => void
  onInstallment: () => void
  savedCards: SavedCard[]
}) {
  const st      = STATUT_FACTURE[facture.statut]
  const overdue = facture.echeance ? isPast(new Date(facture.echeance)) : false

  async function downloadPDF() {
    if (!facture.pdf_url) return
    if (facture.pdf_url.startsWith('http')) { window.open(facture.pdf_url, '_blank'); return }
    const { data } = await supabase.storage.from('factures').createSignedUrl(facture.pdf_url, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className={cn('rounded-md border bg-surface p-s-4', overdue ? 'border-status-danger' : 'border-line')}>
      <div className="flex items-start justify-between gap-s-3">
        <div className="min-w-0">
          <p className="font-medium text-ink truncate">{facture.praticien_nom || 'Consultation'}</p>
          <p className="text-small text-ink-2">
            {format(new Date(facture.date_facture), 'd MMM yyyy', { locale: fr })}
            {facture.echeance ? ` · échéance ${format(new Date(facture.echeance), 'd MMM', { locale: fr })}` : ''}
          </p>
        </div>
        <span className={cn('shrink-0 flex items-center gap-s-1 rounded-pill px-s-2 py-0.5 text-micro font-medium', st.cls)}>
          {st.icon}{st.label}
        </span>
      </div>

      {/* Détail montants */}
      <div className="mt-s-3 grid grid-cols-3 gap-s-2 rounded-md bg-surface-2 px-s-3 py-s-2">
        <div className="text-center">
          <p className="text-micro text-ink-3">Total</p>
          <p className="text-small font-semibold text-ink">{FCFA(facture.montant_total)}</p>
        </div>
        <div className="text-center border-x border-line">
          <p className="text-micro text-ink-3">Remboursé</p>
          <p className="text-small font-semibold text-status-success">
            {FCFA(facture.montant_rembourse_ss + facture.montant_rembourse_mutuelle)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-micro text-ink-3">Reste à charge</p>
          <p className="text-small font-bold text-status-danger">{FCFA(facture.reste_a_charge)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-s-3 flex flex-wrap gap-s-2">
        {facture.statut === 'a_payer' && (
          <>
            <Button size="sm" onClick={onPay} leftIcon={<CreditCard className="h-4 w-4" />}>
              Payer en ligne
            </Button>
            {facture.reste_a_charge > 100000 && (
              <Button size="sm" variant="secondary" onClick={onInstallment}>
                Payer en 2x / 3x
              </Button>
            )}
          </>
        )}
        {facture.pdf_url && (
          <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={downloadPDF}>
            Facture PDF
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── HistoriqueTab ────────────────────────────────────────────────────────────
function HistoriqueTab({
  paiements, loading, patientId,
}: {
  paiements: Paiement[]; loading: boolean; patientId: string
}) {
  const [filterMode, setFilterMode] = useState('')
  const [search, setSearch] = useState('')

  const filtered = paiements.filter(p => {
    const matchMode = !filterMode || p.mode_paiement === filterMode
    const matchSearch = !search || (p.praticien_nom ?? '').toLowerCase().includes(search.toLowerCase())
    return matchMode && matchSearch
  })

  function exportCSV() {
    const headers = ['Date', 'Praticien', 'Montant', 'Mode', 'Réf.']
    const lines = filtered.map(p => [
      format(new Date(p.date_paiement), 'dd/MM/yyyy'),
      `"${p.praticien_nom ?? ''}"`,
      p.montant,
      p.mode_paiement,
      p.id.slice(0, 8),
    ].join(';'))
    const csv = '﻿' + [headers.join(';'), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'paiements.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function exportJustificatif() {
    await supabase.functions.invoke('generate-tax-receipt', {
      body: { patientId, year: new Date().getFullYear() },
    }).then(({ data }) => {
      if (data?.url) window.open(data.url, '_blank')
    })
  }

  return (
    <div className="flex flex-col gap-s-4">
      <div className="flex flex-wrap gap-s-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Praticien…"
          className="rounded-md border border-line bg-surface px-s-3 py-s-1.5 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:shadow-focus"
        />
        <select
          value={filterMode}
          onChange={e => setFilterMode(e.target.value)}
          className="rounded-md border border-line bg-surface px-s-3 py-s-1.5 text-small text-ink focus:outline-none focus:shadow-focus"
        >
          <option value="">Tous les modes</option>
          <option value="card">Carte</option>
          <option value="cash">Espèces</option>
          <option value="virement">Virement</option>
          <option value="mobile_money">Mobile money</option>
        </select>
        <div className="flex-1" />
        <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={exportCSV} disabled={filtered.length === 0}>
          CSV
        </Button>
        <Button size="sm" variant="secondary" leftIcon={<FileText className="h-4 w-4" />} onClick={exportJustificatif}>
          Justificatif fiscal
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-s-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<RefreshCw className="h-8 w-8" />} title="Aucun paiement" description="Vos paiements effectués apparaîtront ici." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[460px] text-small">
            <thead>
              <tr className="bg-surface-2 border-b border-line">
                <th className="text-left px-s-3 py-s-2 font-semibold text-ink">Date</th>
                <th className="text-left px-s-3 py-s-2 font-semibold text-ink">Praticien</th>
                <th className="text-right px-s-3 py-s-2 font-semibold text-ink">Montant</th>
                <th className="text-center px-s-3 py-s-2 font-semibold text-ink">Mode</th>
                <th className="text-center px-s-3 py-s-2 font-semibold text-ink">Réf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-s-3 py-s-2 text-ink-2 whitespace-nowrap">
                    {format(new Date(p.date_paiement), 'd MMM yyyy', { locale: fr })}
                  </td>
                  <td className="px-s-3 py-s-2 text-ink">{p.praticien_nom ?? '—'}</td>
                  <td className="px-s-3 py-s-2 text-right font-semibold text-ink">{FCFA(p.montant)}</td>
                  <td className="px-s-3 py-s-2 text-center text-ink-2 capitalize">{p.mode_paiement}</td>
                  <td className="px-s-3 py-s-2 text-center font-mono text-micro text-ink-3">{p.id.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── AddCardModal ─────────────────────────────────────────────────────────────
function AddCardModal({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [stripeObj, setStripeObj]   = useState<Stripe | null>(null)
  const [cardEl, setCardEl]         = useState<StripeCardElement | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const cardDivRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    Promise.all([
      stripePromise,
      supabase.functions.invoke('create-setup-intent'),
    ]).then(([s, { data }]) => {
      setStripeObj(s)
      setClientSecret(data?.clientSecret ?? null)
    })
  }, [open])

  useEffect(() => {
    if (!open || !stripeObj || !cardDivRef.current) return
    if (cardEl) { cardEl.unmount(); setCardEl(null) }
    const elements = stripeObj.elements()
    const card = elements.create('card', {
      style: { base: { fontSize: '15px', fontFamily: 'inherit', color: '#111', '::placeholder': { color: '#9ca3af' } } },
    })
    card.mount(cardDivRef.current)
    setCardEl(card)
    return () => { card.unmount() }
  }, [open, stripeObj])

  async function save() {
    if (!stripeObj || !clientSecret || !cardEl) return
    setSaving(true); setError(null)
    const { setupIntent, error: stripeError } = await stripeObj.confirmCardSetup(clientSecret, {
      payment_method: { card: cardEl },
    })
    if (stripeError) {
      setError(stripeError.message ?? 'Erreur')
    } else if (setupIntent?.status === 'succeeded') {
      onSaved(); onClose()
    }
    setSaving(false)
  }

  return (
    <Modal open={open} onOpenChange={v => !v && !saving && onClose()} title="Ajouter une carte" size="sm">
      <div className="flex flex-col gap-s-4">
        <div
          ref={cardDivRef}
          className="rounded-md border border-line bg-surface px-s-3 py-s-3 min-h-[42px]"
        />
        {error && <Banner kind="warning" className="rounded-md"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</Banner>}
        <div className="flex gap-s-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button className="flex-1" onClick={save} loading={saving} disabled={!clientSecret}>Enregistrer</Button>
        </div>
        <p className="text-center text-micro text-ink-3">Aucune donnée bancaire stockée sur nos serveurs.</p>
      </div>
    </Modal>
  )
}

// ─── CartesTab ────────────────────────────────────────────────────────────────
function CartesTab({ cards, loading, onAdd, onDelete }: {
  cards: SavedCard[]; loading: boolean; onAdd: () => void; onDelete: (id: string) => void
}) {
  const BRAND_ICON: Record<string, string> = { visa: '💳', mastercard: '💳', amex: '💳' }

  return (
    <div className="flex flex-col gap-s-3">
      {loading ? (
        [1, 2].map(i => <Skeleton key={i} className="h-16 rounded-md" />)
      ) : cards.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-8 w-8" />} title="Aucun moyen de paiement" description="Ajoutez une carte pour payer rapidement vos factures." />
      ) : (
        cards.map(c => (
          <div key={c.id} className="flex items-center justify-between rounded-md border border-line px-s-4 py-s-3">
            <div className="flex items-center gap-s-3">
              <span className="text-h2">{BRAND_ICON[c.brand.toLowerCase()] ?? '💳'}</span>
              <div>
                <p className="text-small font-medium text-ink capitalize">{c.brand} •••• {c.last4}</p>
                <p className="text-micro text-ink-3">Expire {c.exp_month}/{c.exp_year}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={() => onDelete(c.id)}
              className="text-status-danger hover:bg-status-danger/5"
            >
              Supprimer
            </Button>
          </div>
        ))
      )}
      <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={onAdd}>
        Ajouter une carte
      </Button>
    </div>
  )
}

// ─── FeuillesSoinsTab ─────────────────────────────────────────────────────────
function FeuillesSoinsTab({ patientId }: { patientId: string }) {
  const db = supabase as any
  const fileRef = useRef<HTMLInputElement>(null)
  const [feuilles, setFeuilles]   = useState<FeuilleSoin[]>([])
  const [loading, setLoading]     = useState(false)
  const [file, setFile]           = useState<File | null>(null)
  const [date, setDate]           = useState('')
  const [montant, setMontant]     = useState('')
  const [praticienNom, setPraticien] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    db.from('feuilles_soins').select('id, date_soin, statut, motif_rejet, montant')
      .eq('patient_id', patientId)
      .order('date_soin', { ascending: false })
      .then(({ data }: any) => { setFeuilles(data ?? []); setLoading(false) })
  }, [patientId])

  useEffect(() => { load() }, [load])

  async function submit() {
    if (!file || !date) return
    setSubmitting(true)

    // Upload fichier
    const path = `feuilles-soins/${patientId}/${Date.now()}-${file.name}`
    await supabase.storage.from('documents').upload(path, file)

    // INSERT feuille
    const { data: fs } = await db.from('feuilles_soins').insert({
      patient_id: patientId,
      date_soin: date,
      fichier_url: path,
      statut: 'en_traitement',
      montant: montant ? parseFloat(montant) : null,
      praticien_nom: praticienNom || null,
    }).select('id').single()

    // Notifier admin
    if (fs?.id) {
      try {
        await db.from('notifications').insert({
          event_type: 'nouvelle_feuille_soins',
          title: 'Nouvelle feuille de soins',
          message: `Un patient a soumis une feuille de soins pour le ${format(new Date(date), 'd MMM yyyy', { locale: fr })}.`,
          badge_category: 'document',
          priority: 'normal',
          data: { feuille_id: fs.id, patient_id: patientId },
        })
      } catch { /* silent */ }
    }

    setFile(null); setDate(''); setMontant(''); setPraticien('')
    setSubmitting(false)
    load()
  }

  return (
    <div className="flex flex-col gap-s-5">
      {/* Formulaire */}
      <div className="rounded-md border border-line bg-surface p-s-4 flex flex-col gap-s-3">
        <h3 className="font-semibold text-ink">Soumettre une feuille de soins</h3>

        <button
          onClick={() => fileRef.current?.click()}
          className={cn(
            'flex flex-col items-center gap-s-2 rounded-md border-2 border-dashed py-s-5 transition-colors',
            file ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-2',
          )}
        >
          {file ? (
            <div className="flex items-center gap-s-2">
              <Paperclip className="h-5 w-5 text-primary" />
              <span className="text-small font-medium text-primary">{file.name}</span>
              <button
                onClick={e => { e.stopPropagation(); setFile(null) }}
                className="text-ink-3 hover:text-status-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="h-6 w-6 text-ink-3" />
              <span className="text-small text-ink-2">Feuille de soins (PDF ou image)</span>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />

        <div className="grid grid-cols-2 gap-s-2">
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Date du soin *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small focus:outline-none focus:shadow-focus" />
          </div>
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Montant (F CFA)</label>
            <input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0"
              className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small focus:outline-none focus:shadow-focus" />
          </div>
        </div>
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Praticien</label>
          <input type="text" value={praticienNom} onChange={e => setPraticien(e.target.value)} placeholder="Nom du praticien"
            className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small placeholder:text-ink-3 focus:outline-none focus:shadow-focus" />
        </div>
        <Button onClick={submit} loading={submitting} disabled={!file || !date} leftIcon={<Upload className="h-4 w-4" />}>
          Soumettre
        </Button>
      </div>

      {/* Suivi */}
      <div>
        <h3 className="mb-s-3 font-semibold text-ink">Mes demandes</h3>
        {loading ? (
          [1, 2].map(i => <Skeleton key={i} className="h-14 rounded-md mb-s-2" />)
        ) : feuilles.length === 0 ? (
          <EmptyState icon={<FileText className="h-8 w-8" />} title="Aucune feuille soumise" />
        ) : (
          <div className="flex flex-col gap-s-2">
            {feuilles.map(f => {
              const s = STATUT_FEUILLE[f.statut]
              return (
                <div key={f.id} className="rounded-md border border-line px-s-4 py-s-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-small font-medium text-ink">
                        {format(new Date(f.date_soin), 'd MMM yyyy', { locale: fr })}
                        {f.montant ? ` · ${FCFA(f.montant)}` : ''}
                      </p>
                    </div>
                    <span className={cn('rounded-pill px-s-2 py-0.5 text-micro font-medium', s.cls)}>{s.label}</span>
                  </div>
                  {f.statut === 'rejete' && f.motif_rejet && (
                    <p className="mt-s-1 text-micro text-ink-3">Motif : {f.motif_rejet}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PaiementsPage ────────────────────────────────────────────────────────────
const PAGE_SIZE = 30

export default function PaiementsPage() {
  const db = supabase as any
  const { profile } = useAuth()

  const [tab, setTab]               = useState<Tab>('factures')
  const [factures, setFactures]     = useState<Facture[]>([])
  const [paiements, setPaiements]   = useState<Paiement[]>([])
  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [loadingF, setLoadingF]     = useState(false)
  const [loadingP, setLoadingP]     = useState(false)
  const [loadingC, setLoadingC]     = useState(false)

  const [payTarget, setPayTarget]   = useState<Facture | null>(null)
  const [payOpen, setPayOpen]       = useState(false)
  const [installTarget, setInstallTarget] = useState<Facture | null>(null)
  const [installOpen, setInstallOpen]     = useState(false)
  const [addCardOpen, setAddCardOpen]     = useState(false)

  // Bilan annuel (calculé depuis les factures réglées de l'année)
  const [bilan, setBilan] = useState({ actes: 0, rembourse: 0, reste: 0 })

  const fetchFactures = useCallback(async () => {
    if (!profile?.id) return
    setLoadingF(true)
    const { data } = await db.from('factures')
      .select('id, praticien_id, date_facture, montant_total, montant_rembourse_ss, montant_rembourse_mutuelle, reste_a_charge, statut, echeance, pdf_url, praticien:profiles!praticien_id(first_name, last_name)')
      .eq('patient_id', profile.id)
      .order('date_facture', { ascending: false })
      .limit(50)
    const mapped: Facture[] = (data ?? []).map((f: any) => ({
      ...f,
      praticien_nom: f.praticien ? `${f.praticien.first_name ?? ''} ${f.praticien.last_name ?? ''}`.trim() : 'Consultation',
    }))
    setFactures(mapped)

    // Bilan année courante
    const now = new Date()
    const annee = mapped.filter(f => new Date(f.date_facture).getFullYear() === now.getFullYear())
    setBilan({
      actes:     annee.reduce((s, f) => s + f.montant_total, 0),
      rembourse: annee.reduce((s, f) => s + f.montant_rembourse_ss + f.montant_rembourse_mutuelle, 0),
      reste:     annee.reduce((s, f) => s + f.reste_a_charge, 0),
    })
    setLoadingF(false)
  }, [profile?.id])

  const fetchPaiements = useCallback(async () => {
    if (!profile?.id) return
    setLoadingP(true)
    const { data } = await db.from('paiements')
      .select('id, facture_id, montant, date_paiement, mode_paiement, facture:factures(praticien:profiles!praticien_id(first_name, last_name))')
      .eq('patient_id', profile.id)
      .order('date_paiement', { ascending: false })
      .limit(PAGE_SIZE)
    setPaiements((data ?? []).map((p: any) => ({
      ...p,
      praticien_nom: p.facture?.praticien
        ? `${p.facture.praticien.first_name ?? ''} ${p.facture.praticien.last_name ?? ''}`.trim()
        : undefined,
    })))
    setLoadingP(false)
  }, [profile?.id])

  const fetchCards = useCallback(async () => {
    if (!profile?.id) return
    setLoadingC(true)
    const { data } = await supabase.functions.invoke('list-payment-methods', {
      body: { patientId: profile.id },
    })
    setSavedCards(data?.cards ?? [])
    setLoadingC(false)
  }, [profile?.id])

  async function deleteCard(pmId: string) {
    await supabase.functions.invoke('detach-payment-method', { body: { paymentMethodId: pmId } })
    fetchCards()
  }

  useEffect(() => { fetchFactures() }, [fetchFactures])
  useEffect(() => { if (tab === 'historique') fetchPaiements() }, [tab, fetchPaiements])
  useEffect(() => { if (tab === 'cartes') fetchCards() }, [tab, fetchCards])

  const overdueFactures = factures.filter(f =>
    f.statut === 'a_payer' && f.echeance && isPast(new Date(f.echeance))
  )
  const aPayerFactures  = factures.filter(f => f.statut !== 'reglee')
  const reglesFactures  = factures.filter(f => f.statut === 'reglee')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'factures',   label: 'Factures' },
    { key: 'historique', label: 'Historique' },
    { key: 'cartes',     label: 'Mes cartes' },
    { key: 'feuilles',   label: 'Feuilles de soins' },
  ]

  return (
    <div className="flex flex-col gap-s-5 pb-s-8">

      {/* Header */}
      <h1 className="font-display text-h1 font-semibold text-ink">Paiements</h1>

      {/* Bilan annuel */}
      {loadingF ? (
        <div className="grid grid-cols-3 gap-s-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}
        </div>
      ) : (
        <BillanCards totalActes={bilan.actes} totalRembourse={bilan.rembourse} resteACharge={bilan.reste} />
      )}

      {/* Bannière factures en retard */}
      {overdueFactures.length > 0 && (
        <Banner kind="warning" className="rounded-md">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {overdueFactures.length} facture{overdueFactures.length > 1 ? 's' : ''} en retard de paiement — réglez-les dès que possible.
        </Banner>
      )}

      {/* Onglets */}
      <div className="flex gap-s-1 border-b border-line overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'whitespace-nowrap pb-s-2 px-s-3 text-small font-medium transition-colors shrink-0',
              tab === t.key ? 'border-b-2 border-primary text-primary' : 'text-ink-2 hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Factures */}
      {tab === 'factures' && (
        <>
          {loadingF ? (
            <div className="flex flex-col gap-s-3">{[1, 2].map(i => <Skeleton key={i} className="h-40 rounded-md" />)}</div>
          ) : aPayerFactures.length === 0 && reglesFactures.length === 0 ? (
            <EmptyState icon={<FileText className="h-10 w-10" />} title="Aucune facture" description="Vos factures apparaîtront ici après vos consultations." />
          ) : (
            <div className="flex flex-col gap-s-4">
              {aPayerFactures.length > 0 && (
                <>
                  <h3 className="font-semibold text-ink text-small">À régler ({aPayerFactures.length})</h3>
                  {aPayerFactures.map(f => (
                    <FactureCard
                      key={f.id}
                      facture={f}
                      savedCards={savedCards}
                      onPay={() => { setPayTarget(f); setPayOpen(true) }}
                      onInstallment={() => { setInstallTarget(f); setInstallOpen(true) }}
                    />
                  ))}
                </>
              )}
              {reglesFactures.length > 0 && (
                <>
                  <h3 className="mt-s-2 font-semibold text-ink text-small">Réglées ({reglesFactures.length})</h3>
                  {reglesFactures.map(f => (
                    <FactureCard
                      key={f.id}
                      facture={f}
                      savedCards={savedCards}
                      onPay={() => {}}
                      onInstallment={() => {}}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'historique' && (
        <HistoriqueTab paiements={paiements} loading={loadingP} patientId={profile?.id ?? ''} />
      )}

      {tab === 'cartes' && (
        <CartesTab
          cards={savedCards}
          loading={loadingC}
          onAdd={() => setAddCardOpen(true)}
          onDelete={deleteCard}
        />
      )}

      {tab === 'feuilles' && (
        <FeuillesSoinsTab patientId={profile?.id ?? ''} />
      )}

      {/* Modals */}
      <PaymentModal
        facture={payTarget}
        open={payOpen}
        savedCards={savedCards}
        onClose={() => setPayOpen(false)}
        onSuccess={fetchFactures}
      />
      <InstallmentModal
        facture={installTarget}
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        onSuccess={fetchFactures}
      />
      <AddCardModal
        open={addCardOpen}
        onClose={() => setAddCardOpen(false)}
        onSaved={fetchCards}
      />
    </div>
  )
}
