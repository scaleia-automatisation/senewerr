import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  FileText, Download, RefreshCw, ShoppingBag, Clock, CheckCircle,
  XCircle, AlertTriangle, ChevronRight, X, Search, Bell, BellOff,
  Pill, User,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Banner } from '@/components/ui/Banner'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Medicament {
  id: string
  nom: string
  posologie: string
  frequence: string
  duree: string
  rappel_actif: boolean
}

interface Dispensation {
  id: string
  date: string
  pharmacie_nom: string
}

interface DemandeRenouvellement {
  id: string
  statut: 'en_attente' | 'acceptee' | 'refusee'
  motif_refus: string | null
  created_at: string
}

interface Ordonnance {
  id: string
  patient_id: string
  praticien_id: string
  date_prescription: string
  date_expiration: string
  statut: 'active' | 'expiree' | 'renouvelee'
  pdf_url: string | null
  signature_numerique: boolean
  praticien_nom: string
  praticien_specialite: string
  medicaments: Medicament[]
  dispensation: Dispensation | null
  demande: DemandeRenouvellement | null
}

interface MedicamentConsolide extends Medicament {
  ordonnance_id: string
  date_fin: string
  praticien_nom: string
  praticien_specialite: string
}

type Tab = 'actives' | 'historique' | 'medicaments'

// ─── Helpers ────────────────────────────────────────────────────────────────
function validitePercent(o: Ordonnance): number {
  const debut = new Date(o.date_prescription).getTime()
  const fin   = new Date(o.date_expiration).getTime()
  const now   = Date.now()
  if (now >= fin) return 0
  if (now <= debut) return 100
  return Math.max(0, Math.round(((fin - now) / (fin - debut)) * 100))
}

function joursRestants(dateExpiration: string): number {
  return differenceInDays(new Date(dateExpiration), new Date())
}

function expiryBadge(jours: number): { label: string; cls: string } {
  if (jours > 7)  return { label: `Valide — ${jours}j`, cls: 'bg-status-success/10 text-status-success' }
  if (jours >= 0) return { label: `Expire dans ${jours}j`, cls: 'bg-status-pending/10 text-status-pending' }
  return { label: 'Expirée', cls: 'bg-status-danger/10 text-status-danger' }
}

async function getPdfUrl(pdfUrl: string | null): Promise<string | null> {
  if (!pdfUrl) return null
  if (pdfUrl.startsWith('http')) return pdfUrl
  const { data } = await supabase.storage.from('ordonnances').createSignedUrl(pdfUrl, 3600)
  return data?.signedUrl ?? null
}

// ─── OrdonnanceCard ──────────────────────────────────────────────────────────
function OrdonnanceCard({
  ord, onRenouveler, onDownload,
}: {
  ord: Ordonnance
  onRenouveler: () => void
  onDownload: () => void
}) {
  const jours  = joursRestants(ord.date_expiration)
  const badge  = expiryBadge(jours)
  const pct    = validitePercent(ord)
  const isHist = ord.statut !== 'active'

  return (
    <div className="rounded-md border border-line bg-surface overflow-hidden">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-s-3 px-s-4 py-s-3 border-b border-line">
        <div className="min-w-0">
          <p className="font-semibold text-ink truncate">{ord.praticien_nom}</p>
          {ord.praticien_specialite && <p className="text-small text-ink-2">{ord.praticien_specialite}</p>}
          <p className="text-micro text-ink-3 mt-0.5">
            Prescrit le {format(new Date(ord.date_prescription), 'd MMM yyyy', { locale: fr })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-s-1 shrink-0">
          {ord.signature_numerique && (
            <span className="flex items-center gap-s-1 rounded-pill bg-status-success/10 px-s-2 py-0.5 text-micro font-medium text-status-success">
              <CheckCircle className="h-3 w-3" />
              Signée
            </span>
          )}
          {!isHist && (
            <span className={cn('rounded-pill px-s-2 py-0.5 text-micro font-medium', badge.cls)}>
              {badge.label}
            </span>
          )}
          {isHist && (
            <span className={cn(
              'rounded-pill px-s-2 py-0.5 text-micro font-medium',
              ord.statut === 'renouvelee' ? 'bg-primary-soft text-primary' : 'bg-status-danger/10 text-status-danger',
            )}>
              {ord.statut === 'renouvelee' ? 'Renouvelée' : 'Expirée'}
            </span>
          )}
        </div>
      </div>

      {/* Médicaments */}
      <div className="divide-y divide-line">
        {ord.medicaments.map(med => (
          <div key={med.id} className="flex items-start gap-s-3 px-s-4 py-s-2">
            <Pill className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-small font-medium text-ink">{med.nom}</p>
              <p className="text-micro text-ink-3">
                {med.posologie} · {med.frequence}{med.duree ? ` · ${med.duree}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Barre de validité */}
      {!isHist && (
        <div className="px-s-4 pt-s-3 pb-s-2">
          <div className="flex items-center justify-between mb-s-1">
            <span className="text-micro text-ink-3">Validité</span>
            <span className="text-micro text-ink-3">
              expire le {format(new Date(ord.date_expiration), 'd MMM yyyy', { locale: fr })}
            </span>
          </div>
          <div className="h-1.5 rounded-pill bg-surface-2 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-pill transition-all',
                jours > 7 ? 'bg-status-success' : jours >= 0 ? 'bg-status-pending' : 'bg-status-danger',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Dispensation */}
      {ord.dispensation && (
        <div className="mx-s-4 mb-s-2 flex items-center gap-s-2 rounded-md bg-primary-soft px-s-3 py-s-2">
          <CheckCircle className="h-4 w-4 text-primary shrink-0" />
          <p className="text-micro text-ink-2">
            Délivrée le {format(new Date(ord.dispensation.date), 'd MMM yyyy', { locale: fr })}
            {ord.dispensation.pharmacie_nom ? ` — ${ord.dispensation.pharmacie_nom}` : ''}
          </p>
        </div>
      )}

      {/* Demande en cours */}
      {ord.demande && (
        <DemandeStatusBanner demande={ord.demande} />
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-s-2 px-s-4 pb-s-4 pt-s-2">
        {!isHist && (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={onRenouveler}
            disabled={!!ord.demande && ord.demande.statut === 'en_attente'}
          >
            {ord.demande?.statut === 'en_attente' ? 'Demande envoyée' : 'Renouveler'}
          </Button>
        )}
        {ord.pdf_url && (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={onDownload}
          >
            PDF
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<ShoppingBag className="h-4 w-4" />}
          disabled
          title="Bientôt disponible"
          className="text-ink-3 cursor-not-allowed"
        >
          Commander en pharmacie
        </Button>
      </div>
    </div>
  )
}

// ─── DemandeStatusBanner ──────────────────────────────────────────────────────
function DemandeStatusBanner({ demande }: { demande: DemandeRenouvellement }) {
  const cfg = {
    en_attente: { icon: <Clock className="h-4 w-4 shrink-0" />, label: 'Demande de renouvellement en attente', kind: 'info' as const },
    acceptee:   { icon: <CheckCircle className="h-4 w-4 shrink-0" />, label: 'Renouvellement accepté', kind: 'info' as const },
    refusee:    { icon: <XCircle className="h-4 w-4 shrink-0" />, label: 'Renouvellement refusé', kind: 'warning' as const },
  }[demande.statut]

  return (
    <div className="mx-s-4 mb-s-2">
      <Banner kind={cfg.kind} className="rounded-md">
        {cfg.icon}
        <span className="flex-1">{cfg.label}</span>
        <span className="text-micro opacity-70">
          {format(new Date(demande.created_at), 'd MMM', { locale: fr })}
        </span>
      </Banner>
      {demande.statut === 'refusee' && demande.motif_refus && (
        <p className="mt-s-1 px-s-1 text-micro text-ink-3">Motif : {demande.motif_refus}</p>
      )}
    </div>
  )
}

// ─── DrawerRenouvellement ─────────────────────────────────────────────────────
function DrawerRenouvellement({
  ord, open, onClose, onSuccess,
}: {
  ord: Ordonnance | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const db = supabase as any
  const { profile } = useAuth()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) { setMessage(''); setDone(false) }
  }, [open])

  async function submit() {
    if (!ord || !profile?.id) return
    setLoading(true)
    await db.from('demandes_renouvellement').insert({
      ordonnance_id: ord.id,
      patient_id: profile.id,
      praticien_id: ord.praticien_id,
      message: message || null,
      statut: 'en_attente',
    })
    // Notification au praticien
    try {
      await db.from('notifications').insert({
        user_id: ord.praticien_id,
        event_type: 'demande_renouvellement',
        title: 'Demande de renouvellement',
        message: `Un patient demande le renouvellement d'une ordonnance.`,
        badge_category: 'prescription',
        priority: 'normal',
        data: { ordonnance_id: ord.id },
      })
    } catch { /* silent */ }
    setDone(true)
    setLoading(false)
    setTimeout(() => { onClose(); onSuccess() }, 1600)
  }

  if (!open || !ord) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]" onClick={onClose} />
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface shadow-2"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-s-5 py-s-4">
          <h2 className="font-display font-semibold text-ink">Demande de renouvellement</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2 transition-colors">
            <X className="h-5 w-5 text-ink-2" />
          </button>
        </div>

        <div className="px-s-5 py-s-5 flex flex-col gap-s-4">
          {done ? (
            <div className="flex flex-col items-center gap-s-4 py-s-8 text-center">
              <CheckCircle className="h-12 w-12 text-status-success" />
              <div>
                <p className="font-semibold text-ink">Demande envoyée !</p>
                <p className="text-small text-ink-2 mt-s-1">Le médecin a été notifié.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Récap ordonnance */}
              <div className="rounded-md border border-line bg-surface-2 px-s-4 py-s-3 space-y-s-1">
                <p className="text-small font-semibold text-ink">{ord.praticien_nom}</p>
                {ord.praticien_specialite && <p className="text-small text-ink-2">{ord.praticien_specialite}</p>}
                <p className="text-micro text-ink-3">
                  Prescrit le {format(new Date(ord.date_prescription), 'd MMM yyyy', { locale: fr })}
                </p>
                {ord.medicaments.slice(0, 3).map(m => (
                  <p key={m.id} className="text-micro text-ink-3">· {m.nom} — {m.posologie}</p>
                ))}
                {ord.medicaments.length > 3 && (
                  <p className="text-micro text-ink-3">+{ord.medicaments.length - 3} autre(s)</p>
                )}
              </div>

              {/* Message */}
              <div>
                <label className="mb-s-1 block text-small font-medium text-ink">
                  Message au médecin <span className="text-ink-3 font-normal">(optionnel)</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, 500))}
                  rows={4}
                  placeholder="Ex : je dois continuer ce traitement pour 3 mois, merci de renouveler…"
                  className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 resize-none focus:outline-none focus:shadow-focus"
                />
                <p className="mt-s-1 text-micro text-ink-3 text-right">{message.length}/500</p>
              </div>

              <Button onClick={submit} loading={loading} fullWidth>
                Envoyer la demande
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── ModalRappel ─────────────────────────────────────────────────────────────
function ModalRappel({
  med, open, onClose, onSaved,
}: {
  med: MedicamentConsolide | null
  open: boolean
  onClose: () => void
  onSaved: (medId: string, heure: string) => void
}) {
  const db = supabase as any
  const { profile } = useAuth()
  const [heure, setHeure] = useState('08:00')
  const [loading, setLoading] = useState(false)

  async function save() {
    if (!med || !profile?.id) return
    setLoading(true)
    // UPDATE rappel_actif
    await db.from('medicaments_ordonnance').update({ rappel_actif: true }).eq('id', med.id)
    // INSERT rappels_push
    try {
      await db.from('rappels_push').insert({
        patient_id: profile.id,
        medicament_id: med.id,
        ordonnance_id: med.ordonnance_id,
        heure_rappel: heure,
        actif: true,
      })
    } catch { /* table may not exist yet */ }
    setLoading(false)
    onSaved(med.id, heure)
    onClose()
  }

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title="Activer un rappel" size="sm">
      <div className="flex flex-col gap-s-4">
        {med && (
          <div className="rounded-md bg-surface-2 px-s-3 py-s-2">
            <p className="text-small font-medium text-ink">{med.nom}</p>
            <p className="text-micro text-ink-2">{med.posologie} · {med.frequence}</p>
          </div>
        )}
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Heure du rappel quotidien</label>
          <input
            type="time"
            value={heure}
            onChange={e => setHeure(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:shadow-focus"
          />
        </div>
        <p className="text-micro text-ink-3">
          Une notification push sera envoyée chaque jour à cette heure pour vous rappeler de prendre ce médicament.
        </p>
        <div className="flex gap-s-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1" onClick={save} loading={loading}>Activer</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── OrdonnancesPage ──────────────────────────────────────────────────────────
const PAGE_SIZE = 10

export default function OrdonnancesPage() {
  const db = supabase as any
  const { profile } = useAuth()

  const [tab, setTab] = useState<Tab>('actives')
  const [actives, setActives]         = useState<Ordonnance[]>([])
  const [historique, setHistorique]   = useState<Ordonnance[]>([])
  const [medicaments, setMedicaments] = useState<MedicamentConsolide[]>([])
  const [loading, setLoading]         = useState(false)
  const [histPage, setHistPage]       = useState(0)
  const [histHasMore, setHistHasMore] = useState(false)
  const [searchMed, setSearchMed]     = useState('')
  const [searchDoc, setSearchDoc]     = useState('')

  const [selectedOrd, setSelectedOrd]     = useState<Ordonnance | null>(null)
  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [rappelMed, setRappelMed]         = useState<MedicamentConsolide | null>(null)
  const [rappelOpen, setRappelOpen]       = useState(false)

  const mapOrd = useCallback((o: any, meds: any[], disp: any | null, demande: any | null): Ordonnance => ({
    id: o.id,
    patient_id: o.patient_id,
    praticien_id: o.praticien_id,
    date_prescription: o.date_prescription,
    date_expiration: o.date_expiration,
    statut: o.statut,
    pdf_url: o.pdf_url ?? null,
    signature_numerique: !!o.signature_numerique,
    praticien_nom: o.praticien
      ? `${o.praticien.first_name ?? ''} ${o.praticien.last_name ?? ''}`.trim() || 'Médecin'
      : 'Médecin',
    praticien_specialite: o.praticien?.specialty ?? '',
    medicaments: (meds ?? []).map((m: any) => ({
      id: m.id,
      nom: m.nom,
      posologie: m.posologie,
      frequence: m.frequence,
      duree: m.duree,
      rappel_actif: !!m.rappel_actif,
    })),
    dispensation: disp ? {
      id: disp.id,
      date: disp.date,
      pharmacie_nom: disp.pharmacie?.nom ?? disp.pharmacie_nom ?? '',
    } : null,
    demande: demande ? {
      id: demande.id,
      statut: demande.statut,
      motif_refus: demande.motif_refus ?? null,
      created_at: demande.created_at,
    } : null,
  }), [])

  const fetchOrdonnances = useCallback(async (statuts: string[], page = 0): Promise<Ordonnance[]> => {
    if (!profile?.id) return []
    const { data: ords } = await db.from('ordonnances')
      .select('id, patient_id, praticien_id, date_prescription, date_expiration, statut, pdf_url, signature_numerique, praticien:profiles!praticien_id(first_name, last_name, specialty)')
      .eq('patient_id', profile.id)
      .in('statut', statuts)
      .order('date_prescription', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

    if (!ords?.length) return []

    const ids = ords.map((o: any) => o.id)

    const [{ data: meds }, { data: disps }, { data: demandes }] = await Promise.all([
      db.from('medicaments_ordonnance').select('*').in('ordonnance_id', ids),
      db.from('dispensations').select('id, ordonnance_id, date, pharmacie_nom').in('ordonnance_id', ids).limit(ids.length),
      db.from('demandes_renouvellement')
        .select('id, ordonnance_id, statut, motif_refus, created_at')
        .in('ordonnance_id', ids)
        .order('created_at', { ascending: false }),
    ])

    return ords.map((o: any) => mapOrd(
      o,
      (meds ?? []).filter((m: any) => m.ordonnance_id === o.id),
      (disps ?? []).find((d: any) => d.ordonnance_id === o.id) ?? null,
      (demandes ?? []).find((d: any) => d.ordonnance_id === o.id) ?? null,
    ))
  }, [profile?.id, mapOrd])

  // Fetch actives
  useEffect(() => {
    if (tab !== 'actives' || !profile?.id) return
    setLoading(true)
    fetchOrdonnances(['active']).then(d => { setActives(d); setLoading(false) })
  }, [tab, profile?.id, fetchOrdonnances])

  // Fetch historique
  useEffect(() => {
    if (tab !== 'historique' || !profile?.id) return
    setLoading(true)
    fetchOrdonnances(['expiree', 'renouvelee'], histPage).then(d => {
      setHistorique(prev => histPage === 0 ? d : [...prev, ...d])
      setHistHasMore(d.length > PAGE_SIZE)
      setLoading(false)
    })
  }, [tab, profile?.id, histPage, fetchOrdonnances])

  // Fetch médicaments consolidés depuis les ordonnances actives
  useEffect(() => {
    if (tab !== 'medicaments' || !profile?.id) return
    setLoading(true)
    fetchOrdonnances(['active']).then(ords => {
      const list: MedicamentConsolide[] = []
      ords.forEach(o => {
        o.medicaments.forEach(m => {
          list.push({
            ...m,
            ordonnance_id: o.id,
            date_fin: o.date_expiration,
            praticien_nom: o.praticien_nom,
            praticien_specialite: o.praticien_specialite,
          })
        })
      })
      setMedicaments(list)
      setLoading(false)
    })
  }, [tab, profile?.id, fetchOrdonnances])

  async function handleDownload(ord: Ordonnance) {
    const url = await getPdfUrl(ord.pdf_url)
    if (url) window.open(url, '_blank')
  }

  function handleRappelToggle(med: MedicamentConsolide, checked: boolean) {
    if (checked) {
      setRappelMed(med)
      setRappelOpen(true)
    } else {
      db.from('medicaments_ordonnance').update({ rappel_actif: false }).eq('id', med.id)
      setMedicaments(prev => prev.map(m => m.id === med.id ? { ...m, rappel_actif: false } : m))
    }
  }

  function onRappelSaved(medId: string) {
    setMedicaments(prev => prev.map(m => m.id === medId ? { ...m, rappel_actif: true } : m))
  }

  function refreshTab() {
    if (tab === 'actives') {
      setLoading(true)
      fetchOrdonnances(['active']).then(d => { setActives(d); setLoading(false) })
    } else if (tab === 'historique') {
      setHistPage(0)
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'actives',     label: 'Actives' },
    { key: 'historique',  label: 'Historique' },
    { key: 'medicaments', label: 'Mes médicaments' },
  ]

  // Filtres historique
  const filteredHistorique = historique.filter(o => {
    const texteLower = searchMed.toLowerCase()
    const docLower   = searchDoc.toLowerCase()
    const matchMed   = !searchMed || o.medicaments.some(m => m.nom.toLowerCase().includes(texteLower))
    const matchDoc   = !searchDoc || o.praticien_nom.toLowerCase().includes(docLower)
    return matchMed && matchDoc
  })

  return (
    <div className="flex flex-col gap-s-4 pb-s-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-s-3">
        <h1 className="font-display text-h1 font-semibold text-ink">Mes ordonnances</h1>
      </div>

      {/* ── Onglets ─────────────────────────────────────────────────────── */}
      <div className="flex gap-s-1 border-b border-line">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'pb-s-2 px-s-3 text-small font-medium transition-colors',
              tab === t.key ? 'border-b-2 border-primary text-primary' : 'text-ink-2 hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Actives ─────────────────────────────────────────────────── */}
      {tab === 'actives' && (
        <>
          {loading ? (
            <div className="flex flex-col gap-s-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-52 rounded-md" />)}
            </div>
          ) : actives.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="Aucune ordonnance active"
              description="Vos ordonnances actives prescrites par vos médecins apparaîtront ici."
            />
          ) : (
            <div className="flex flex-col gap-s-4">
              {actives.map(ord => (
                <OrdonnanceCard
                  key={ord.id}
                  ord={ord}
                  onRenouveler={() => { setSelectedOrd(ord); setDrawerOpen(true) }}
                  onDownload={() => handleDownload(ord)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Tab Historique ──────────────────────────────────────────────── */}
      {tab === 'historique' && (
        <>
          {/* Filtres */}
          <div className="flex flex-wrap gap-s-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-s-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3" />
              <input
                value={searchMed}
                onChange={e => setSearchMed(e.target.value)}
                placeholder="Médicament…"
                className="w-full rounded-md border border-line bg-surface pl-10 pr-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:shadow-focus"
              />
            </div>
            <div className="relative flex-1 min-w-[160px]">
              <User className="absolute left-s-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3" />
              <input
                value={searchDoc}
                onChange={e => setSearchDoc(e.target.value)}
                placeholder="Médecin…"
                className="w-full rounded-md border border-line bg-surface pl-10 pr-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:shadow-focus"
              />
            </div>
          </div>

          {loading && historique.length === 0 ? (
            <div className="flex flex-col gap-s-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-md" />)}
            </div>
          ) : filteredHistorique.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="Aucune ordonnance dans l'historique"
              description={searchMed || searchDoc ? 'Aucun résultat pour ce filtre.' : 'Vos ordonnances passées apparaîtront ici.'}
            />
          ) : (
            <div className="flex flex-col gap-s-4">
              {filteredHistorique.map(ord => (
                <OrdonnanceCard
                  key={ord.id}
                  ord={ord}
                  onRenouveler={() => { setSelectedOrd(ord); setDrawerOpen(true) }}
                  onDownload={() => handleDownload(ord)}
                />
              ))}
              {histHasMore && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={loading}
                  onClick={() => setHistPage(p => p + 1)}
                >
                  Voir plus
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Tab Mes médicaments ─────────────────────────────────────────── */}
      {tab === 'medicaments' && (
        <>
          {loading ? (
            <div className="flex flex-col gap-s-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}
            </div>
          ) : medicaments.length === 0 ? (
            <EmptyState
              icon={<Pill className="h-10 w-10" />}
              title="Aucun médicament actif"
              description="Les médicaments de vos ordonnances actives apparaîtront ici."
            />
          ) : (
            <div className="flex flex-col gap-s-2">
              {medicaments.map(med => (
                <div key={med.id} className="rounded-md border border-line bg-surface px-s-4 py-s-3">
                  <div className="flex items-start justify-between gap-s-3">
                    <div className="flex items-start gap-s-3 min-w-0">
                      <Pill className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-ink truncate">{med.nom}</p>
                        <p className="text-small text-ink-2">{med.posologie} · {med.frequence}</p>
                        <p className="text-micro text-ink-3 mt-s-1">
                          {med.praticien_nom}{med.praticien_specialite ? ` · ${med.praticien_specialite}` : ''}
                        </p>
                        <p className="text-micro text-ink-3">
                          Jusqu'au {format(new Date(med.date_fin), 'd MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-s-2">
                      {med.rappel_actif && (
                        <Bell className="h-4 w-4 text-primary" />
                      )}
                      <Switch
                        checked={med.rappel_actif}
                        onCheckedChange={checked => handleRappelToggle(med, checked)}
                        label=""
                      />
                    </div>
                  </div>
                  {med.rappel_actif && (
                    <p className="mt-s-2 flex items-center gap-s-1 text-micro text-primary">
                      <Bell className="h-3 w-3" />
                      Rappel actif
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Drawer renouvellement ───────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <DrawerRenouvellement
            ord={selectedOrd}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onSuccess={refreshTab}
          />
        )}
      </AnimatePresence>

      {/* ── Modal rappel ────────────────────────────────────────────────── */}
      <ModalRappel
        med={rappelMed}
        open={rappelOpen}
        onClose={() => { setRappelOpen(false); setRappelMed(null) }}
        onSaved={onRappelSaved}
      />
    </div>
  )
}
