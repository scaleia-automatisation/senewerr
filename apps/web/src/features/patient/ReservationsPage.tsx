import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, differenceInHours } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Building2, MapPin, Phone, Mail, ChevronDown, ChevronUp, Download,
  AlertTriangle, CheckSquare, Square, X, Upload, Paperclip, Plus,
  FileText, ExternalLink, Calendar,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Banner } from '@/components/ui/Banner'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────
interface DocRequis {
  nom: string
  prepare: boolean
}

interface Etablissement {
  id: string
  nom: string
  adresse: string
  telephone: string | null
  email: string | null
  logo_url: string | null
  type: string
}

interface Reservation {
  id: string
  patient_id: string
  praticien_referent_id: string | null
  etablissement_id: string
  type_soin: TypeSoin
  date_debut: string
  date_fin: string | null
  statut: 'confirmee' | 'en_attente' | 'annulee' | 'passee'
  documents_requis: DocRequis[]
  notes: string | null
  bon_prise_en_charge_url: string | null
  compte_rendu_id: string | null
  etablissement: Etablissement | null
  praticien_nom: string | null
  praticien_specialite: string | null
}

type TypeSoin = 'hospitalisation' | 'examen_bio' | 'imagerie' | 'soin_paramedical'
type TabResa = 'avenir' | 'passees' | 'annulees'

// ─── Constantes ──────────────────────────────────────────────────────────────
const TYPE_SOIN_LABEL: Record<TypeSoin, string> = {
  hospitalisation:   'Hospitalisation',
  examen_bio:        'Examen biologique',
  imagerie:          'Imagerie médicale',
  soin_paramedical:  'Soin paramédical',
}

const TYPE_SOIN_COLOR: Record<TypeSoin, string> = {
  hospitalisation:  'bg-status-danger/10 text-status-danger',
  examen_bio:       'bg-primary-soft text-primary',
  imagerie:         'bg-status-progress/10 text-status-progress',
  soin_paramedical: 'bg-status-pending/10 text-status-pending',
}

const STATUT_CFG: Record<string, { label: string; cls: string }> = {
  confirmee:  { label: 'Confirmée',   cls: 'bg-status-success/10 text-status-success' },
  en_attente: { label: 'En attente',  cls: 'bg-status-pending/10 text-status-pending' },
  annulee:    { label: 'Annulée',     cls: 'bg-status-danger/10 text-status-danger'   },
  passee:     { label: 'Passée',      cls: 'bg-surface-2 text-ink-3'                 },
}

const UPCOMING_STATUTS = ['confirmee', 'en_attente']
const PAGE_SIZE = 10

// ─── Helpers ─────────────────────────────────────────────────────────────────
function canCancel(r: Reservation): boolean {
  if (r.statut === 'annulee' || r.statut === 'passee') return false
  return differenceInHours(new Date(r.date_debut), new Date()) >= 48
}

async function getSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  if (path.startsWith('http')) return path
  const { data } = await supabase.storage.from('reservations').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

// ─── ReservationCard ─────────────────────────────────────────────────────────
function ReservationCard({
  resa, onCancel, onNavigate,
}: {
  resa: Reservation
  onCancel: () => void
  onNavigate: (path: string) => void
}) {
  const db = supabase as any
  const [expanded, setExpanded] = useState(false)
  const [docs, setDocs] = useState<DocRequis[]>(resa.documents_requis ?? [])
  const [saving, setSaving] = useState(false)

  const statut = STATUT_CFG[resa.statut] ?? { label: resa.statut, cls: 'bg-surface-2 text-ink-2' }

  async function toggleDoc(idx: number) {
    const updated = docs.map((d, i) => i === idx ? { ...d, prepare: !d.prepare } : d)
    setDocs(updated)
    setSaving(true)
    await db.from('reservations').update({ documents_requis: updated }).eq('id', resa.id)
    setSaving(false)
  }

  async function downloadBon() {
    const url = await getSignedUrl(resa.bon_prise_en_charge_url)
    if (url) window.open(url, '_blank')
  }

  const et = resa.etablissement

  return (
    <div className="rounded-md border border-line bg-surface overflow-hidden">
      {/* En-tête de carte */}
      <div className="px-s-4 py-s-3">
        <div className="flex items-start gap-s-3">
          {/* Logo établissement */}
          {et?.logo_url ? (
            <img src={et.logo_url} alt={et?.nom} className="h-10 w-10 rounded-md object-cover shrink-0" />
          ) : (
            <div className="h-10 w-10 rounded-md bg-primary-soft flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-s-2">
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">{et?.nom ?? 'Établissement'}</p>
                {et?.adresse && <p className="text-small text-ink-2 truncate">{et.adresse}</p>}
              </div>
              <span className={cn('shrink-0 rounded-pill px-s-2 py-0.5 text-micro font-medium', statut.cls)}>
                {statut.label}
              </span>
            </div>

            <div className="mt-s-2 flex flex-wrap items-center gap-s-2">
              <span className={cn('rounded-pill px-s-2 py-0.5 text-micro font-semibold', TYPE_SOIN_COLOR[resa.type_soin])}>
                {TYPE_SOIN_LABEL[resa.type_soin]}
              </span>
              <span className="flex items-center gap-s-1 text-micro text-ink-3">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(resa.date_debut), 'd MMM yyyy', { locale: fr })}
                {resa.date_fin && resa.date_fin !== resa.date_debut
                  ? ` → ${format(new Date(resa.date_fin), 'd MMM yyyy', { locale: fr })}`
                  : ''}
              </span>
            </div>

            {resa.praticien_nom && (
              <p className="mt-s-1 text-micro text-ink-3">
                Praticien réf. : {resa.praticien_nom}
                {resa.praticien_specialite ? ` — ${resa.praticien_specialite}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Bouton expand */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-s-3 flex w-full items-center justify-center gap-s-1 rounded-md bg-surface-2 py-s-1.5 text-small text-ink-2 hover:bg-line transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {expanded ? 'Masquer les détails' : 'Voir les détails'}
        </button>
      </div>

      {/* Détails expandables */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-line"
          >
            <div className="px-s-4 py-s-4 flex flex-col gap-s-4">

              {/* Contact établissement */}
              {et && (
                <div className="flex flex-col gap-s-2">
                  <p className="text-small font-semibold text-ink">Établissement</p>
                  {et.adresse && (
                    <div className="flex items-start gap-s-2">
                      <MapPin className="h-4 w-4 text-ink-3 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-small text-ink">{et.adresse}</p>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(et.adresse)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-micro text-primary hover:underline"
                        >
                          Itinéraire <ExternalLink className="inline h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                  {et.telephone && (
                    <a href={`tel:${et.telephone}`} className="flex items-center gap-s-2 text-small text-ink hover:text-primary transition-colors">
                      <Phone className="h-4 w-4 text-ink-3 shrink-0" />
                      {et.telephone}
                    </a>
                  )}
                  {et.email && (
                    <a href={`mailto:${et.email}`} className="flex items-center gap-s-2 text-small text-ink hover:text-primary transition-colors">
                      <Mail className="h-4 w-4 text-ink-3 shrink-0" />
                      {et.email}
                    </a>
                  )}
                </div>
              )}

              {/* Notes / consignes */}
              {resa.notes && (
                <div className="rounded-md bg-status-pending/5 border border-status-pending/20 px-s-3 py-s-3">
                  <p className="text-small font-semibold text-status-pending mb-s-1">Consignes pré-examen</p>
                  <p className="text-small text-ink-2">{resa.notes}</p>
                </div>
              )}

              {/* Documents à apporter */}
              {docs.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-s-2">
                    <p className="text-small font-semibold text-ink">Documents à apporter</p>
                    {saving && <span className="text-micro text-ink-3">Enregistrement…</span>}
                  </div>
                  <div className="flex flex-col gap-s-2">
                    {docs.map((doc, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleDoc(idx)}
                        className="flex items-center gap-s-3 rounded-md px-s-3 py-s-2 bg-surface-2 hover:bg-line transition-colors text-left"
                      >
                        {doc.prepare
                          ? <CheckSquare className="h-4 w-4 text-status-success shrink-0" />
                          : <Square className="h-4 w-4 text-ink-3 shrink-0" />}
                        <span className={cn('text-small', doc.prepare ? 'line-through text-ink-3' : 'text-ink')}>
                          {doc.nom}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-s-1 text-micro text-ink-3">
                    {docs.filter(d => d.prepare).length}/{docs.length} préparé(s)
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-s-2 pt-s-1 border-t border-line">
                {resa.bon_prise_en_charge_url && (
                  <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={downloadBon}>
                    Bon de prise en charge
                  </Button>
                )}
                {resa.compte_rendu_id && (
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<FileText className="h-4 w-4" />}
                    onClick={() => onNavigate(`/patient/documents?doc_id=${resa.compte_rendu_id}`)}
                  >
                    Compte-rendu
                  </Button>
                )}
                {resa.statut !== 'annulee' && resa.statut !== 'passee' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!canCancel(resa)}
                    onClick={onCancel}
                    className="text-status-danger hover:bg-status-danger/5 disabled:text-ink-3"
                  >
                    Annuler
                  </Button>
                )}
              </div>
              {!canCancel(resa) && resa.statut !== 'annulee' && resa.statut !== 'passee' && (
                <p className="text-micro text-ink-3">
                  L'annulation n'est plus possible à moins de 48h du rendez-vous.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── CancelModal ─────────────────────────────────────────────────────────────
function CancelModal({ resa, loading, onClose, onConfirm }: {
  resa: Reservation; loading: boolean; onClose: () => void; onConfirm: () => void
}) {
  return (
    <Modal open onOpenChange={v => !v && onClose()} title="Annuler la réservation" size="sm">
      <div className="flex flex-col gap-s-4">
        <div className="flex items-start gap-s-3 rounded-md bg-surface-2 p-s-3">
          <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-small font-medium text-ink">{resa.etablissement?.nom ?? 'Établissement'}</p>
            <p className="text-small text-ink-2 capitalize">
              {TYPE_SOIN_LABEL[resa.type_soin]} · {format(new Date(resa.date_debut), 'd MMM yyyy', { locale: fr })}
            </p>
          </div>
        </div>
        <p className="text-small text-ink-2">L'établissement sera notifié. Cette action est irréversible.</p>
        <div className="flex gap-s-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>Garder</Button>
          <Button variant="danger" className="flex-1" onClick={onConfirm} loading={loading}>
            Confirmer l'annulation
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── DrawerNouvelle ───────────────────────────────────────────────────────────
const TYPES_SOIN: TypeSoin[] = ['hospitalisation', 'examen_bio', 'imagerie', 'soin_paramedical']

function DrawerNouvelle({
  open, onClose, patientId, onSuccess,
}: {
  open: boolean; onClose: () => void; patientId: string | null; onSuccess: () => void
}) {
  const db = supabase as any
  const { profile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)
  const [typeSoin, setTypeSoin] = useState<TypeSoin | null>(null)
  const [etablissements, setEtablissements] = useState<Etablissement[]>([])
  const [loadingEtabs, setLoadingEtabs] = useState(false)
  const [selectedEtab, setSelectedEtab] = useState<Etablissement | null>(null)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep(1); setTypeSoin(null); setSelectedEtab(null)
      setDateDebut(''); setDateFin(''); setNotes(''); setFiles([])
      setDone(false)
    }
  }, [open])

  useEffect(() => {
    if (!typeSoin) return
    setLoadingEtabs(true)
    db.from('etablissements').select('id, nom, adresse, telephone, email, logo_url, type')
      .eq('type', typeSoin)
      .limit(20)
      .then(({ data }: any) => {
        setEtablissements(data ?? [])
        setLoadingEtabs(false)
      })
  }, [typeSoin])

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return
    setFiles(prev => [...prev, ...Array.from(newFiles)].slice(0, 5))
  }

  async function uploadFiles(resaId: string): Promise<string[]> {
    const urls: string[] = []
    for (const file of files) {
      const path = `${profile?.id}/${resaId}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('reservations').upload(path, file, { upsert: false })
      if (!error) urls.push(path)
    }
    return urls
  }

  async function submit() {
    if (!patientId || !selectedEtab || !dateDebut) return
    setSubmitting(true)

    // INSERT réservation
    const { data: resa } = await db.from('reservations').insert({
      patient_id: patientId,
      etablissement_id: selectedEtab.id,
      type_soin: typeSoin,
      date_debut: dateDebut,
      date_fin: dateFin || null,
      statut: 'en_attente',
      notes: notes || null,
    }).select('id').single()

    if (!resa?.id) { setSubmitting(false); return }

    // Upload fichiers
    if (files.length) {
      setUploading(true)
      await uploadFiles(resa.id)
      setUploading(false)
    }

    // Notification admin/établissement (best-effort)
    try {
      await db.from('notifications').insert({
        event_type: 'nouvelle_demande_reservation',
        title: 'Nouvelle demande de réservation',
        message: `Demande de ${TYPE_SOIN_LABEL[typeSoin!]} pour le ${format(new Date(dateDebut), 'd MMM yyyy', { locale: fr })} — ${selectedEtab.nom}`,
        badge_category: 'reservation',
        priority: 'high',
        data: { reservation_id: resa.id, type_soin: typeSoin, etablissement_id: selectedEtab.id },
        // user_id null → pour admin; ou envoyer à l'établissement si on a son user_id
      })
    } catch { /* silent */ }

    setSubmitting(false)
    setDone(true)
    setTimeout(() => { onClose(); onSuccess() }, 1800)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]" onClick={onClose} />
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface shadow-2"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-s-5 py-s-4">
          <div>
            <h2 className="font-display font-semibold text-ink">Nouvelle réservation</h2>
            <div className="mt-s-2 flex items-center gap-s-1">
              {[1, 2, 3].map(n => (
                <div key={n} className={cn('h-1.5 w-8 rounded-pill transition-colors', n <= step ? 'bg-primary' : 'bg-line')} />
              ))}
              <span className="ml-s-2 text-micro text-ink-3">Étape {step}/3</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2 transition-colors">
            <X className="h-5 w-5 text-ink-2" />
          </button>
        </div>

        <div className="px-s-5 py-s-5">
          {done ? (
            <div className="flex flex-col items-center gap-s-4 py-s-8 text-center">
              <div className="h-16 w-16 rounded-pill bg-status-success/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-status-success" />
              </div>
              <div>
                <p className="font-semibold text-ink">Demande envoyée !</p>
                <p className="text-small text-ink-2 mt-s-1">
                  En attente de confirmation de l'établissement.
                </p>
              </div>
            </div>
          ) : step === 1 ? (
            /* Étape 1 — Type de soin */
            <div className="flex flex-col gap-s-4">
              <h3 className="font-semibold text-ink">Type de soin</h3>
              <div className="grid grid-cols-2 gap-s-3">
                {TYPES_SOIN.map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeSoin(t)}
                    className={cn(
                      'flex flex-col items-center gap-s-2 rounded-md border p-s-4 text-center transition-colors',
                      typeSoin === t ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-2',
                    )}
                  >
                    <span className={cn('rounded-pill px-s-2 py-0.5 text-micro font-semibold', TYPE_SOIN_COLOR[t])}>
                      {TYPE_SOIN_LABEL[t]}
                    </span>
                  </button>
                ))}
              </div>
              {typeSoin && (
                <>
                  <h3 className="font-semibold text-ink">Établissement</h3>
                  {loadingEtabs ? (
                    <div className="flex flex-col gap-s-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
                  ) : etablissements.length === 0 ? (
                    <p className="text-small text-ink-3 text-center py-s-4">Aucun établissement disponible pour ce type de soin.</p>
                  ) : (
                    <div className="flex flex-col gap-s-2">
                      {etablissements.map(et => (
                        <button
                          key={et.id}
                          onClick={() => setSelectedEtab(et)}
                          className={cn(
                            'flex items-center gap-s-3 rounded-md border p-s-3 text-left transition-colors',
                            selectedEtab?.id === et.id ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-2',
                          )}
                        >
                          {et.logo_url ? (
                            <img src={et.logo_url} alt={et.nom} className="h-10 w-10 rounded-md object-cover shrink-0" />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-surface-2 flex items-center justify-center shrink-0">
                              <Building2 className="h-5 w-5 text-ink-3" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-small font-medium text-ink truncate">{et.nom}</p>
                            {et.adresse && <p className="text-micro text-ink-2 truncate">{et.adresse}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <Button disabled={!typeSoin || !selectedEtab} onClick={() => setStep(2)} fullWidth>
                Continuer
              </Button>
            </div>
          ) : step === 2 ? (
            /* Étape 2 — Date + notes */
            <div className="flex flex-col gap-s-4">
              <button onClick={() => setStep(1)} className="text-primary text-small hover:underline">← Retour</button>
              <h3 className="font-semibold text-ink">Date et consignes</h3>

              <div>
                <label className="mb-s-1 block text-small font-medium text-ink">Date souhaitée <span className="text-status-danger">*</span></label>
                <input
                  type="date"
                  value={dateDebut}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setDateDebut(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:shadow-focus"
                />
              </div>

              {typeSoin === 'hospitalisation' && (
                <div>
                  <label className="mb-s-1 block text-small font-medium text-ink">Date de sortie prévue</label>
                  <input
                    type="date"
                    value={dateFin}
                    min={dateDebut || new Date().toISOString().split('T')[0]}
                    onChange={e => setDateFin(e.target.value)}
                    className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:shadow-focus"
                  />
                </div>
              )}

              <div>
                <label className="mb-s-1 block text-small font-medium text-ink">Notes / motif</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Ex : bilan sanguin de routine, douleurs abdominales…"
                  className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 resize-none focus:outline-none focus:shadow-focus"
                />
                <p className="mt-s-1 text-micro text-ink-3 text-right">{notes.length}/500</p>
              </div>

              <Button disabled={!dateDebut} onClick={() => setStep(3)} fullWidth>
                Continuer
              </Button>
            </div>
          ) : (
            /* Étape 3 — Pièces jointes + récap */
            <div className="flex flex-col gap-s-4">
              <button onClick={() => setStep(2)} className="text-primary text-small hover:underline">← Retour</button>
              <h3 className="font-semibold text-ink">Pièces jointes</h3>
              <p className="text-small text-ink-2">Joignez le bon de prise en charge, la prescription ou tout autre document utile (max 5 fichiers).</p>

              {/* Zone upload */}
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-s-2 rounded-md border-2 border-dashed border-line py-s-6 hover:bg-surface-2 transition-colors"
              >
                <Upload className="h-6 w-6 text-ink-3" />
                <span className="text-small text-ink-2">Cliquez pour ajouter des fichiers</span>
                <span className="text-micro text-ink-3">PDF, JPG, PNG — max 5 Mo par fichier</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => addFiles(e.target.files)}
              />

              {files.length > 0 && (
                <div className="flex flex-col gap-s-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-surface-2 px-s-3 py-s-2">
                      <span className="flex items-center gap-s-2 text-small text-ink truncate">
                        <Paperclip className="h-4 w-4 text-ink-3 shrink-0" />
                        {f.name}
                      </span>
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="ml-s-2 text-ink-3 hover:text-status-danger">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Récap */}
              <div className="rounded-md border border-line divide-y divide-line">
                <div className="flex items-center justify-between p-s-3">
                  <span className="text-small text-ink-2">Type de soin</span>
                  <span className="text-small font-medium text-ink">{TYPE_SOIN_LABEL[typeSoin!]}</span>
                </div>
                <div className="flex items-center justify-between p-s-3">
                  <span className="text-small text-ink-2">Établissement</span>
                  <span className="text-small font-medium text-ink truncate max-w-[160px]">{selectedEtab?.nom}</span>
                </div>
                <div className="flex items-center justify-between p-s-3">
                  <span className="text-small text-ink-2">Date</span>
                  <span className="text-small font-medium text-ink">
                    {format(new Date(dateDebut), 'd MMM yyyy', { locale: fr })}
                    {dateFin ? ` → ${format(new Date(dateFin), 'd MMM', { locale: fr })}` : ''}
                  </span>
                </div>
              </div>

              <Button
                onClick={submit}
                loading={submitting || uploading}
                fullWidth
              >
                {uploading ? 'Upload des fichiers…' : 'Envoyer la demande'}
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── ReservationsPage ─────────────────────────────────────────────────────────
export default function ReservationsPage() {
  const db = supabase as any
  const { profile } = useAuth()

  const [tab, setTab]             = useState<TabResa>('avenir')
  const [reservations, setResa]   = useState<Reservation[]>([])
  const [loading, setLoading]     = useState(false)
  const [page, setPage]           = useState(0)
  const [hasMore, setHasMore]     = useState(false)
  const [cancelResa, setCancelResa] = useState<Reservation | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const mapResa = (r: any): Reservation => ({
    id: r.id,
    patient_id: r.patient_id,
    praticien_referent_id: r.praticien_referent_id ?? null,
    etablissement_id: r.etablissement_id,
    type_soin: r.type_soin,
    date_debut: r.date_debut,
    date_fin: r.date_fin ?? null,
    statut: r.statut,
    documents_requis: Array.isArray(r.documents_requis) ? r.documents_requis : [],
    notes: r.notes ?? null,
    bon_prise_en_charge_url: r.bon_prise_en_charge_url ?? null,
    compte_rendu_id: r.compte_rendu_id ?? null,
    etablissement: r.etab ? {
      id: r.etab.id,
      nom: r.etab.nom,
      adresse: r.etab.adresse ?? '',
      telephone: r.etab.telephone ?? null,
      email: r.etab.email ?? null,
      logo_url: r.etab.logo_url ?? null,
      type: r.etab.type ?? '',
    } : null,
    praticien_nom: r.praticien
      ? `${r.praticien.first_name ?? ''} ${r.praticien.last_name ?? ''}`.trim() || null
      : null,
    praticien_specialite: r.praticien?.specialty ?? null,
  })

  const fetchResa = useCallback(async (reset = false) => {
    if (!profile?.id) return
    setLoading(true)
    const p = reset ? 0 : page
    if (reset) setPage(0)

    let q = db.from('reservations')
      .select(`id, patient_id, praticien_referent_id, etablissement_id, type_soin, date_debut, date_fin,
        statut, documents_requis, notes, bon_prise_en_charge_url, compte_rendu_id,
        etab:etablissements(id, nom, adresse, telephone, email, logo_url, type),
        praticien:profiles!praticien_referent_id(first_name, last_name, specialty)`)
      .eq('patient_id', profile.id)
      .order('date_debut', { ascending: tab === 'avenir' })
      .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE)

    if (tab === 'avenir')   q = q.in('statut', UPCOMING_STATUTS)
    if (tab === 'passees')  q = q.eq('statut', 'passee')
    if (tab === 'annulees') q = q.eq('statut', 'annulee')

    const { data } = await q
    const mapped = (data ?? []).map(mapResa)
    setResa(reset ? mapped : prev => [...prev, ...mapped])
    setHasMore(mapped.length > PAGE_SIZE)
    setLoading(false)
  }, [profile?.id, tab, page])

  useEffect(() => { fetchResa(true) }, [profile?.id, tab])

  async function handleCancel() {
    if (!cancelResa) return
    setCancelLoading(true)
    await db.from('reservations').update({ statut: 'annulee' }).eq('id', cancelResa.id)
    // Notifier l'établissement (on n'a pas son user_id, on insère sans user_id pour admin)
    try {
      await db.from('notifications').insert({
        event_type: 'reservation_annulee_patient',
        title: 'Réservation annulée par le patient',
        message: `Annulation de la réservation du ${format(new Date(cancelResa.date_debut), 'd MMM yyyy', { locale: fr })} — ${cancelResa.etablissement?.nom ?? ''}`,
        badge_category: 'reservation',
        priority: 'high',
        data: { reservation_id: cancelResa.id },
      })
    } catch { /* silent */ }
    setCancelResa(null)
    setCancelLoading(false)
    fetchResa(true)
  }

  const TABS: { key: TabResa; label: string }[] = [
    { key: 'avenir',   label: 'À venir' },
    { key: 'passees',  label: 'Passées' },
    { key: 'annulees', label: 'Annulées' },
  ]

  return (
    <div className="flex flex-col gap-s-4 pb-s-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-s-3">
        <h1 className="font-display text-h1 font-semibold text-ink">Réservations médicales</h1>
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setDrawerOpen(true)}>
          <span className="hidden sm:inline">Nouvelle réservation</span>
          <span className="sm:hidden">Nouvelle</span>
        </Button>
      </div>

      {/* Sous-onglets */}
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

      {/* Contenu */}
      {loading && reservations.length === 0 ? (
        <div className="flex flex-col gap-s-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-md" />)}
        </div>
      ) : reservations.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title={
            tab === 'avenir'   ? 'Aucune réservation à venir' :
            tab === 'passees'  ? 'Aucune réservation passée' :
                                 'Aucune réservation annulée'
          }
          description={tab === 'avenir' ? 'Vos hospitalisations et examens apparaîtront ici.' : undefined}
          action={tab === 'avenir' ? <Button size="sm" onClick={() => setDrawerOpen(true)}>Faire une réservation</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-s-4">
          {reservations.map(r => (
            <ReservationCard
              key={r.id}
              resa={r}
              onCancel={() => setCancelResa(r)}
              onNavigate={path => { window.location.href = path }}
            />
          ))}
          {hasMore && (
            <Button variant="secondary" size="sm" loading={loading} onClick={() => { setPage(p => p + 1); fetchResa() }}>
              Voir plus
            </Button>
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {cancelResa && (
          <CancelModal
            resa={cancelResa}
            loading={cancelLoading}
            onClose={() => setCancelResa(null)}
            onConfirm={handleCancel}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {drawerOpen && (
          <DrawerNouvelle
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            patientId={profile?.id ?? null}
            onSuccess={() => fetchResa(true)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
