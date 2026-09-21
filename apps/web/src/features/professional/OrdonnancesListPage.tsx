import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pill, FileText, ChevronRight, QrCode, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'

interface OrdItem {
  id: string
  patient_id: string
  patient_name: string
  patient_avatar?: string | null
  date_prescription: string
  date_expiration: string
  statut: 'active' | 'dispensee' | 'annulee' | 'expiree'
  nb_medicaments: number
  consultation_id?: string | null
  qr_data_url?: string | null
}

const STATUT_OPTS = [
  { value: '',          label: 'Tous les statuts' },
  { value: 'active',    label: 'Active' },
  { value: 'dispensee', label: 'Dispensée' },
  { value: 'annulee',   label: 'Annulée' },
  { value: 'expiree',   label: 'Expirée' },
]

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

const PAGE = 20

export default function OrdonnancesListPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const db = supabase as any

  const [items, setItems]         = useState<OrdItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statut, setStatut]       = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [page, setPage]           = useState(0)
  const [qrModal, setQrModal]     = useState<OrdItem | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrUrl, setQrUrl]         = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    let q = db.from('ordonnances')
      .select(`
        id, patient_id, date_prescription, date_expiration, statut, consultation_id,
        patient:patient_id ( full_name, avatar_url ),
        ordonnance_medicaments ( id )
      `)
      .eq('praticien_id', profile.id)
      .order('date_prescription', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)

    if (statut)   q = q.eq('statut', statut)
    if (dateFrom) q = q.gte('date_prescription', `${dateFrom}T00:00:00`)
    if (dateTo)   q = q.lte('date_prescription', `${dateTo}T23:59:59`)

    const { data } = await q
    let flat: OrdItem[] = (data ?? []).map((r: any) => ({
      id:                r.id,
      patient_id:        r.patient_id,
      patient_name:      r.patient?.full_name ?? '—',
      patient_avatar:    r.patient?.avatar_url,
      date_prescription: r.date_prescription,
      date_expiration:   r.date_expiration,
      statut:            r.statut,
      nb_medicaments:    r.ordonnance_medicaments?.length ?? 0,
      consultation_id:   r.consultation_id,
    }))

    if (search.trim()) {
      const s = search.toLowerCase()
      flat = flat.filter(o => o.patient_name.toLowerCase().includes(s))
    }

    setItems(flat)
    setLoading(false)
  }, [profile?.id, page, statut, dateFrom, dateTo, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, statut, dateFrom, dateTo])

  async function openQr(item: OrdItem) {
    setQrModal(item)
    setQrUrl(null)
    setQrLoading(true)

    // Fetch stored qr_data_url from ordonnances
    const { data } = await (supabase as any).from('ordonnances')
      .select('qr_data_url, qr_token')
      .eq('id', item.id)
      .single()

    setQrUrl(data?.qr_data_url ?? null)
    setQrLoading(false)
  }

  return (
    <div className="flex flex-col gap-s-4 p-s-4 md:p-s-6">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-s-2">
        <div className="relative min-w-[200px] flex-1">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher patient…"
            className="w-full rounded-lg border border-line bg-surface py-s-2 pl-s-3 pr-s-3 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
          />
        </div>
        <Select options={STATUT_OPTS} value={statut} onValueChange={setStatut} />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none" />
        <Button
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => navigate('/pro/ordonnances/nouvelle')}
        >
          Nouvelle ordonnance
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-small">
          <thead className="border-b border-line bg-surface-2">
            <tr>
              {['Patient','Date','Expiration','Médicaments','Statut','QR',''].map(h => (
                <th key={h} className="px-s-3 py-s-2 text-left font-semibold text-ink-3 text-micro">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-line">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-s-3 py-s-2"><Skeleton className="h-4" /></td>
                    ))}
                  </tr>
                ))
              : items.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="px-s-3 py-s-10 text-center text-ink-3">
                      <Pill className="mx-auto mb-s-2 h-8 w-8 opacity-30" />
                      Aucune ordonnance trouvée
                    </td>
                  </tr>
                )
                : items.map(o => (
                  <tr key={o.id}
                    className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-2">
                      <div className="flex items-center gap-s-2">
                        <Avatar src={o.patient_avatar} fallback={o.patient_name} size="sm" />
                        <span className="font-medium text-ink truncate max-w-[120px]">{o.patient_name}</span>
                      </div>
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                      {format(parseISO(o.date_prescription), 'dd/MM/yyyy', { locale: fr })}
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                      {format(parseISO(o.date_expiration), 'dd/MM/yyyy', { locale: fr })}
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-3 text-center">
                      {o.nb_medicaments}
                    </td>
                    <td className="px-s-3 py-s-2">
                      <Badge variant={STATUT_VARIANT[o.statut] ?? 'neutral'}>
                        {STATUT_LABEL[o.statut] ?? o.statut}
                      </Badge>
                    </td>
                    <td className="px-s-3 py-s-2">
                      {o.statut === 'active' && (
                        <button
                          onClick={e => { e.stopPropagation(); openQr(o) }}
                          className="rounded p-s-1 text-ink-3 hover:bg-surface-2 hover:text-primary transition-colors"
                          title="Voir le QR code"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                    <td className="px-s-3 py-s-2">
                      <button
                        onClick={() => navigate(`/pro/ordonnances/${o.id}`)}
                        className="flex items-center gap-s-1 text-ink-3 hover:text-primary transition-colors"
                      >
                        <span className="text-micro">Détail</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-s-2">
        <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Précédent</Button>
        <span className="text-small text-ink-3">Page {page + 1}</span>
        <Button variant="ghost" size="sm" disabled={items.length < PAGE} onClick={() => setPage(p => p + 1)}>Suivant</Button>
      </div>

      {/* QR Modal */}
      <Modal
        open={!!qrModal}
        onOpenChange={open => { if (!open) setQrModal(null) }}
        title="QR Code — Ordonnance"
      >
        {qrModal && (
          <div className="flex flex-col items-center gap-s-4 p-s-4">
            <p className="text-small text-ink-3 text-center">
              Patient : <strong className="text-ink">{qrModal.patient_name}</strong><br />
              Expire le : <strong className="text-ink">
                {format(parseISO(qrModal.date_expiration), 'dd/MM/yyyy', { locale: fr })}
              </strong>
            </p>

            {qrLoading && <Skeleton className="h-64 w-64 rounded-lg" />}

            {!qrLoading && qrUrl && (
              <img
                src={qrUrl}
                alt="QR code ordonnance"
                className="h-64 w-64 rounded-lg border border-line"
              />
            )}

            {!qrLoading && !qrUrl && (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-line bg-surface-2">
                <div className="text-center text-ink-3">
                  <QrCode className="mx-auto mb-s-2 h-10 w-10 opacity-40" />
                  <p className="text-micro">QR non disponible</p>
                </div>
              </div>
            )}

            <p className="text-micro text-ink-3 text-center max-w-xs">
              Présentez ce QR code au pharmacien pour la délivrance des médicaments.
              Le code est à usage unique par ordonnance.
            </p>

            <div className="flex gap-s-2">
              <Button
                variant="primary"
                onClick={() => {
                  if (qrUrl) {
                    const w = window.open('', '_blank')
                    if (w) {
                      w.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh"><img src="${qrUrl}" style="max-width:400px" /></body></html>`)
                      w.document.close()
                      w.print()
                    }
                  }
                }}
                disabled={!qrUrl}
              >
                Imprimer
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/pro/ordonnances/${qrModal.id}`)}>
                Voir le détail
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
