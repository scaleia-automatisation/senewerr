import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useJustification } from '@/features/admin/JustificationSheet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Banner } from '@/components/ui/Banner'

const fmt = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

interface PrescriptionReview {
  id: string
  decision?: string
  problem_reported?: boolean
  problem_description?: string
  reviewed_at?: string
  created_at: string
  prescription?: {
    id?: string
    prescription_number?: string
    prescriber?: { full_name?: string; phone?: string }
    patient?: { full_name?: string }
  }
  pharmacy?: { name?: string; phone?: string }
}

interface PrescriptionItem {
  id: string
  medication_name?: string
  dosage?: string
  quantity?: number
}

interface DetailProps {
  review: PrescriptionReview
  onClose: () => void
  onClosed: () => void
}

function ReviewDetail({ review, onClose, onClosed }: DetailProps) {
  const { requestJustification, JustificationSheetNode } = useJustification({
    entityType: 'prescription_items',
    entityId: review.prescription?.id ?? review.id,
    action: 'admin.view.prescription_items',
  })
  const [items, setItems] = useState<PrescriptionItem[] | null>(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closed, setClosed] = useState(false)
  const [error, setError] = useState('')

  const loadItems = useCallback(async () => {
    if (!review.prescription?.id) return
    const cause = await requestJustification()
    if (!cause) return
    setItemsLoading(true)
    const { data } = await (supabase as any)
      .from('prescription_items')
      .select('id, medication_name, dosage, quantity')
      .eq('prescription_id', review.prescription.id)
    setItems(data ?? [])
    setItemsLoading(false)
  }, [review, requestJustification])

  const closeReview = useCallback(async () => {
    setClosing(true)
    setError('')
    try {
      const { error: err } = await (supabase as any).functions.invoke('admin-action', {
        body: { action: 'close_prescription_review', review_id: review.id },
      })
      if (err) throw err
      setClosed(true)
      onClosed()
    } catch (e: any) {
      setError(e.message ?? 'Erreur')
    } finally {
      setClosing(false)
    }
  }, [review.id, onClosed])

  return (
    <>
      {JustificationSheetNode}
      <div className="flex flex-col gap-s-4">
        {closed && <Banner kind="info">Ordonnance marquée comme examinée.</Banner>}
        {error && <Banner kind="warning">{error}</Banner>}

        <div className="grid grid-cols-2 gap-s-3 text-sm">
          <div>
            <p className="text-ink-3 text-xs mb-s-1">N° Ordonnance</p>
            <p className="font-mono text-ink">
              {review.prescription?.prescription_number
                ? `ORD-${review.prescription.prescription_number}`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-ink-3 text-xs mb-s-1">Décision</p>
            <Badge variant={review.decision === 'rejected' ? 'danger' : 'neutral'}>{review.decision ?? '—'}</Badge>
          </div>
          <div>
            <p className="text-ink-3 text-xs mb-s-1">Prescripteur</p>
            <p className="text-ink">{(review.prescription?.prescriber as any)?.full_name ?? '—'}</p>
            <p className="text-ink-2 text-xs">{(review.prescription?.prescriber as any)?.phone ?? ''}</p>
          </div>
          <div>
            <p className="text-ink-3 text-xs mb-s-1">Patient</p>
            <p className="text-ink">{review.prescription?.patient?.full_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-ink-3 text-xs mb-s-1">Pharmacie</p>
            <p className="text-ink">{review.pharmacy?.name ?? '—'}</p>
            <p className="text-ink-2 text-xs">{review.pharmacy?.phone ?? ''}</p>
          </div>
          <div>
            <p className="text-ink-3 text-xs mb-s-1">Date</p>
            <p className="text-ink">{fmt(review.created_at)}</p>
          </div>
          {review.problem_description && (
            <div className="col-span-2">
              <p className="text-ink-3 text-xs mb-s-1">Problème signalé</p>
              <p className="text-ink bg-surface-2 rounded p-s-2">{review.problem_description}</p>
            </div>
          )}
        </div>

        {/* Items section — requires justification */}
        {items === null ? (
          <Button variant="secondary" size="sm" onClick={loadItems} disabled={itemsLoading}>
            {itemsLoading ? 'Chargement…' : 'Voir items ordonnance'}
          </Button>
        ) : (
          <div>
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-s-2">Items ordonnance</p>
            {items.length === 0
              ? <p className="text-sm text-ink-3">Aucun item</p>
              : (
                <div className="flex flex-col gap-s-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-surface-2 rounded px-s-3 py-s-2 text-sm"
                    >
                      <span className="font-medium text-ink">{item.medication_name ?? '—'}</span>
                      <span className="text-ink-3">{item.dosage ?? ''} × {item.quantity ?? 1}</span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {!closed && (
          <div className="flex justify-end pt-s-2 border-t border-line">
            <Button variant="primary" size="sm" loading={closing} onClick={closeReview}>
              Clore l'examen
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

export default function FlaggedPrescriptionsPage() {
  useAdminAudit('ordonnances-signalees')

  const [reviews, setReviews] = useState<PrescriptionReview[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PrescriptionReview | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('prescription_reviews')
      .select(`id, decision, problem_reported, problem_description, reviewed_at, created_at,
               prescription:prescriptions(id, prescription_number,
                 prescriber:professionals(profile:profiles(full_name, phone)),
                 patient:profiles(full_name)),
               pharmacy:organizations(name, phone)`)
      .or('decision.eq.rejected,problem_reported.eq.true')
      .order('created_at', { ascending: false })
      .limit(200)
    setReviews(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col gap-s-5 p-s-4">
      <div>
        <h1 className="text-h2 font-display text-ink">Ordonnances signalées</h1>
        <p className="text-sm text-ink-3">{reviews.length} résultat{reviews.length !== 1 ? 's' : ''}</p>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {['N° ORD', 'Prescripteur', 'Pharmacie', 'Problème signalé', 'Date', ''].map((h) => (
                <th
                  key={h}
                  className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(6).fill(0).map((__, j) => (
                    <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
              : reviews.length === 0
                ? <tr><td colSpan={6} className="px-s-3 py-s-6 text-center text-ink-3">Aucune ordonnance signalée</td></tr>
                : reviews.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-3 font-mono text-xs text-ink-3">
                      {r.prescription?.prescription_number
                        ? `ORD-${r.prescription.prescription_number}`
                        : r.id.slice(0, 8)}
                    </td>
                    <td className="px-s-3 py-s-3">
                      {(r.prescription?.prescriber as any)?.profile?.full_name ?? '—'}
                    </td>
                    <td className="px-s-3 py-s-3">{r.pharmacy?.name ?? '—'}</td>
                    <td className="px-s-3 py-s-3">
                      {r.problem_reported
                        ? <Badge variant="danger">Oui</Badge>
                        : r.decision === 'rejected'
                          ? <Badge variant="neutral">Refusé</Badge>
                          : <Badge variant="neutral">—</Badge>
                      }
                    </td>
                    <td className="px-s-3 py-s-3 whitespace-nowrap text-ink-2">{fmt(r.created_at)}</td>
                    <td className="px-s-3 py-s-3">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(r)}>Voir</Button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </Card>

      <Modal
        open={!!selected}
        onOpenChange={(v) => { if (!v) setSelected(null) }}
        title="Détail ordonnance signalée"
        size="xl"
      >
        {selected && (
          <ReviewDetail
            review={selected}
            onClose={() => setSelected(null)}
            onClosed={() => { load(); setSelected(null) }}
          />
        )}
      </Modal>
    </div>
  )
}
