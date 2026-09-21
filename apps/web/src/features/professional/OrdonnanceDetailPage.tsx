import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pill, QrCode, AlertTriangle, RefreshCw, X, Printer, ShieldAlert } from 'lucide-react'
import { format, parseISO, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface Medicament {
  id: string
  nom_medicament: string
  dosage?: string | null
  posologie?: string | null
  duree?: string | null
  quantite?: string | null
  instructions_speciales?: string | null
  ordre: number
}

interface OrdonnanceDetail {
  id: string
  patient_id: string
  patient_name: string
  patient_avatar?: string | null
  praticien_id: string
  statut: 'active' | 'dispensee' | 'annulee' | 'expiree'
  date_prescription: string
  date_expiration: string
  notes?: string | null
  qr_data_url?: string | null
  qr_token?: string | null
  qr_invalidated_at?: string | null
  consultation_id?: string | null
  medicaments: Medicament[]
}

const STATUT_VARIANT: Record<string, 'success' | 'accent' | 'danger' | 'neutral'> = {
  active:    'success',
  dispensee: 'accent',
  annulee:   'danger',
  expiree:   'neutral',
}

const STATUT_LABEL: Record<string, string> = {
  active:    'Active',
  dispensee: 'Dispensée',
  annulee:   'Annulée',
  expiree:   'Expirée',
}

export default function OrdonnanceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const db = supabase as any

  const [ord, setOrd] = useState<OrdonnanceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [motifAnnulation, setMotifAnnulation] = useState('')

  useEffect(() => {
    if (!id || !profile?.id) return
    load()
  }, [id, profile?.id])

  async function load() {
    setLoading(true)
    const { data, error } = await db.from('ordonnances')
      .select(`
        id, patient_id, praticien_id, statut,
        date_prescription, date_expiration, notes,
        qr_data_url, qr_token, qr_invalidated_at, consultation_id,
        patient:patient_id ( full_name, avatar_url ),
        ordonnance_medicaments ( id, nom_medicament, dosage, posologie, duree, quantite, instructions_speciales, ordre )
      `)
      .eq('id', id)
      .maybeSingle()

    if (!data || error) {
      setForbidden(true)
      setLoading(false)
      return
    }

    // Only the prescribing praticien can view
    if (data.praticien_id !== profile?.id) {
      setForbidden(true)
      setLoading(false)
      return
    }

    const meds: Medicament[] = (data.ordonnance_medicaments ?? [])
      .sort((a: any, b: any) => a.ordre - b.ordre)

    // Compute effective statut
    let statut = data.statut
    if (statut === 'active' && isPast(new Date(data.date_expiration))) {
      statut = 'expiree'
    }

    setOrd({
      id:                data.id,
      patient_id:        data.patient_id,
      patient_name:      data.patient?.full_name ?? '—',
      patient_avatar:    data.patient?.avatar_url,
      praticien_id:      data.praticien_id,
      statut,
      date_prescription: data.date_prescription,
      date_expiration:   data.date_expiration,
      notes:             data.notes,
      qr_data_url:       data.qr_data_url,
      qr_token:          data.qr_token,
      qr_invalidated_at: data.qr_invalidated_at,
      consultation_id:   data.consultation_id,
      medicaments:       meds,
    })
    setLoading(false)
  }

  async function handleAnnuler() {
    if (!id) return
    setCancelling(true)
    try {
      const { error } = await supabase.functions.invoke('annuler-ordonnance', {
        body: { ordonnance_id: id, motif: motifAnnulation.trim() || null },
      })
      if (error) throw error
      toast.success('Ordonnance annulée')
      setConfirmCancel(false)
      await load()
    } catch {
      toast.error('Erreur lors de l\'annulation')
    } finally {
      setCancelling(false)
    }
  }

  function handleRenouveler() {
    if (!ord) return
    navigate(`/pro/ordonnances/nouvelle?patient=${ord.patient_id}&renew=${ord.id}`)
  }

  function printPdf() {
    if (!ord) return
    const meds = ord.medicaments
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Ordonnance</title>
<style>
  @media print { @page { size: A4; margin: 2cm; } }
  body { font-family: Arial, sans-serif; font-size: 12pt; color: #111; }
  .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .dr { font-size: 16pt; font-weight: bold; color: #1A7A4C; }
  .titre { font-size: 18pt; font-weight: bold; text-align: center; margin: 16px 0; border-bottom: 2px solid #1A7A4C; padding-bottom: 8px; }
  .patient { background: #f5f5f5; padding: 8px; border-radius: 4px; margin-bottom: 16px; }
  .med { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #ccc; }
  .med-nom { font-weight: bold; font-size: 13pt; }
  .med-info { color: #444; margin-top: 2px; }
  .footer { margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
  .qr-section { text-align: center; }
  .qr-section img { width: 110px; height: 110px; }
  .expire { color: #666; font-size: 10pt; margin-top: 4px; }
  .statut-annulee { color: red; font-weight: bold; text-align:center; border: 2px solid red; padding: 4px; margin-bottom: 8px; }
</style>
</head>
<body>
<div class="header">
  <div><div class="dr">Dr. ${profile?.full_name ?? ''}</div><div>Médecin — Sénégal</div></div>
  <div style="text-align:right">Date : ${format(parseISO(ord.date_prescription), 'dd/MM/yyyy', { locale: fr })}</div>
</div>

${ord.statut === 'annulee' ? '<div class="statut-annulee">ANNULÉE</div>' : ''}

<div class="titre">ORDONNANCE MÉDICALE</div>

<div class="patient"><strong>Patient :</strong> ${ord.patient_name}</div>

${meds.map((m, i) => `
<div class="med">
  <div class="med-nom">${i + 1}. ${m.nom_medicament}</div>
  ${m.dosage ? `<div class="med-info">Dosage : ${m.dosage}</div>` : ''}
  ${m.posologie ? `<div class="med-info">Posologie : ${m.posologie}</div>` : ''}
  ${m.duree ? `<div class="med-info">Durée : ${m.duree}</div>` : ''}
  ${m.quantite ? `<div class="med-info">Quantité : ${m.quantite}</div>` : ''}
  ${m.instructions_speciales ? `<div class="med-info"><em>${m.instructions_speciales}</em></div>` : ''}
</div>
`).join('')}

${ord.notes ? `<div style="margin-top:16px;padding:8px;border-left:3px solid #1A7A4C"><strong>Notes :</strong> ${ord.notes}</div>` : ''}

<div class="footer">
  <div class="qr-section">
    ${ord.qr_data_url ? `<img src="${ord.qr_data_url}" alt="QR code" />` : ''}
    <div class="expire">Valide jusqu'au ${format(parseISO(ord.date_expiration), 'dd/MM/yyyy', { locale: fr })}</div>
  </div>
  <div style="text-align:right">
    <br/><br/>
    <div style="border-top:1px solid #111;padding-top:4px;min-width:150px">Signature et cachet</div>
  </div>
</div>
</body>
</html>`

    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.print()
    }
  }

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center gap-s-4 p-s-10 text-center">
        <ShieldAlert className="h-12 w-12 text-danger" />
        <p className="text-h4 font-semibold text-ink">Accès refusé</p>
        <p className="text-small text-ink-3">Vous n'êtes pas autorisé à accéder à cette ordonnance.</p>
        <Button variant="ghost" onClick={() => navigate('/pro/ordonnances')}>Retour</Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-s-4 p-s-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!ord) return null

  return (
    <div className="flex flex-col gap-s-4 p-s-4 md:p-s-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-s-3">
        <button onClick={() => navigate('/pro/ordonnances')}
          className="rounded-lg p-s-2 text-ink-3 hover:bg-surface-2 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-h4 font-semibold text-ink">Ordonnance</h1>
          <p className="text-micro text-ink-3">{ord.patient_name}</p>
        </div>
        <Badge variant={STATUT_VARIANT[ord.statut] ?? 'neutral'}>
          {STATUT_LABEL[ord.statut] ?? ord.statut}
        </Badge>
      </div>

      {/* Infos */}
      <Card className="p-s-4">
        <div className="grid grid-cols-2 gap-s-3 text-small">
          <div>
            <p className="text-micro text-ink-3">Patient</p>
            <p className="font-medium text-ink">{ord.patient_name}</p>
          </div>
          <div>
            <p className="text-micro text-ink-3">Prescription</p>
            <p className="font-medium text-ink">
              {format(parseISO(ord.date_prescription), 'dd MMMM yyyy', { locale: fr })}
            </p>
          </div>
          <div>
            <p className="text-micro text-ink-3">Expiration</p>
            <p className={`font-medium ${ord.statut === 'expiree' ? 'text-danger' : 'text-ink'}`}>
              {format(parseISO(ord.date_expiration), 'dd MMMM yyyy', { locale: fr })}
            </p>
          </div>
          {ord.qr_invalidated_at && (
            <div>
              <p className="text-micro text-ink-3">QR invalidé le</p>
              <p className="font-medium text-danger">
                {format(parseISO(ord.qr_invalidated_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
              </p>
            </div>
          )}
        </div>
        {ord.notes && (
          <div className="mt-s-3 rounded-lg bg-surface-2 p-s-3">
            <p className="text-micro text-ink-3 mb-s-1">Notes</p>
            <p className="text-small text-ink">{ord.notes}</p>
          </div>
        )}
      </Card>

      {/* Médicaments */}
      <Card className="p-s-4">
        <h2 className="mb-s-3 text-small font-semibold text-ink">
          Médicaments ({ord.medicaments.length})
        </h2>
        <div className="flex flex-col gap-s-3">
          {ord.medicaments.map((m, i) => (
            <div key={m.id} className="rounded-lg border border-line p-s-3">
              <p className="font-medium text-ink">{i + 1}. {m.nom_medicament}</p>
              <div className="mt-s-1 flex flex-wrap gap-x-s-4 gap-y-s-1">
                {m.dosage && <span className="text-micro text-ink-3">Dosage : {m.dosage}</span>}
                {m.posologie && <span className="text-micro text-ink-3">Posologie : {m.posologie}</span>}
                {m.duree && <span className="text-micro text-ink-3">Durée : {m.duree}</span>}
                {m.quantite && <span className="text-micro text-ink-3">Qté : {m.quantite}</span>}
              </div>
              {m.instructions_speciales && (
                <p className="mt-s-1 text-micro text-ink-3 italic">{m.instructions_speciales}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-s-2">
        {ord.statut === 'active' && (
          <Button
            variant="primary"
            leftIcon={<QrCode className="h-4 w-4" />}
            onClick={() => setShowQr(true)}
          >
            QR Code
          </Button>
        )}
        <Button
          variant="secondary"
          leftIcon={<Printer className="h-4 w-4" />}
          onClick={printPdf}
        >
          Imprimer PDF
        </Button>
        <Button
          variant="ghost"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={handleRenouveler}
        >
          Renouveler
        </Button>
        {ord.statut === 'active' && (
          <Button
            variant="danger"
            leftIcon={<X className="h-4 w-4" />}
            onClick={() => setConfirmCancel(true)}
          >
            Annuler
          </Button>
        )}
      </div>

      {/* QR Modal */}
      <Modal open={showQr} onOpenChange={setShowQr} title="QR Code — Ordonnance">
        <div className="flex flex-col items-center gap-s-4 p-s-4">
          {ord.qr_data_url ? (
            <img src={ord.qr_data_url} alt="QR code ordonnance" className="h-64 w-64 rounded-lg border border-line" />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-line bg-surface-2">
              <QrCode className="h-12 w-12 text-ink-3 opacity-40" />
            </div>
          )}
          <p className="text-micro text-ink-3 text-center max-w-xs">
            Valide jusqu'au {format(parseISO(ord.date_expiration), 'dd/MM/yyyy', { locale: fr })}.
            Signé et sécurisé côté serveur.
          </p>
        </div>
      </Modal>

      {/* Confirm annulation */}
      <Modal
        open={confirmCancel}
        onOpenChange={open => { if (!open) setConfirmCancel(false) }}
        title="Annuler l'ordonnance"
      >
        <div className="flex flex-col gap-s-4 p-s-4">
          <div className="flex items-start gap-s-2">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-danger" />
            <p className="text-small text-ink">
              Cette action invalidera le QR code et le patient ne pourra plus utiliser cette ordonnance.
            </p>
          </div>
          <textarea
            value={motifAnnulation}
            onChange={e => setMotifAnnulation(e.target.value)}
            placeholder="Motif d'annulation (optionnel)"
            rows={3}
            className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none resize-none"
          />
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Retour</Button>
            <Button variant="danger" onClick={handleAnnuler} disabled={cancelling}>
              {cancelling ? 'Annulation…' : 'Confirmer l\'annulation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
