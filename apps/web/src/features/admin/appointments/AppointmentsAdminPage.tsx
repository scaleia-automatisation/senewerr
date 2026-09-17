import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { Banner } from '@/components/ui/Banner'

const PAGE_SIZE = 20
const fmt = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

type ApptStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | string

function statusBadge(status: ApptStatus) {
  const map: Record<string, 'success' | 'pending' | 'neutral' | 'danger' | 'primary'> = {
    scheduled: 'pending',
    confirmed: 'primary',
    completed: 'success',
    cancelled: 'neutral',
    no_show: 'danger',
  }
  return map[status] ?? 'neutral'
}

interface Appt {
  id: string
  appointment_number?: string
  starts_at: string
  duration_minutes?: number
  status: ApptStatus
  patient_profile?: { full_name?: string; phone?: string }
  professional?: {
    profile?: { full_name?: string }
    specialty?: string
  }
  organization?: { name?: string }
}

interface DetailModalProps {
  appt: Appt | null
  open: boolean
  onClose: () => void
}

function DetailModal({ appt, open, onClose }: DetailModalProps) {
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelMotif, setCancelMotif] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelSuccess, setCancelSuccess] = useState(false)

  const handleCancel = useCallback(async () => {
    if (!cancelMotif.trim()) { setCancelError('Motif obligatoire'); return }
    setCancelLoading(true)
    setCancelError('')
    try {
      const { error } = await (supabase as any).functions.invoke('admin-action', {
        body: { action: 'cancel_appointment', appointment_id: appt?.id, motif: cancelMotif },
      })
      if (error) throw error
      setCancelSuccess(true)
      setCancelMotif('')
      setCancelOpen(false)
    } catch (e: any) {
      setCancelError(e.message ?? 'Erreur')
    } finally {
      setCancelLoading(false)
    }
  }, [cancelMotif, appt?.id])

  if (!appt) return null

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) onClose() }} title={`RDV ${appt.appointment_number ?? appt.id.slice(0, 8)}`} size="lg">
      <div className="flex flex-col gap-s-4">
        {cancelSuccess && <Banner kind="info">Annulation effectuée.</Banner>}
        <div className="grid grid-cols-2 gap-s-3 text-sm">
          <div>
            <p className="text-ink-3 text-xs mb-s-1">Patient</p>
            <p className="font-medium text-ink">{appt.patient_profile?.full_name ?? '—'}</p>
            <p className="text-ink-2">{appt.patient_profile?.phone ?? ''}</p>
          </div>
          <div>
            <p className="text-ink-3 text-xs mb-s-1">Professionnel</p>
            <p className="font-medium text-ink">{appt.professional?.profile?.full_name ?? '—'}</p>
            <p className="text-ink-2">{appt.professional?.specialty ?? ''}</p>
          </div>
          <div>
            <p className="text-ink-3 text-xs mb-s-1">Établissement</p>
            <p className="font-medium text-ink">{appt.organization?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-ink-3 text-xs mb-s-1">Statut</p>
            <Badge variant={statusBadge(appt.status)}>{appt.status}</Badge>
          </div>
          <div>
            <p className="text-ink-3 text-xs mb-s-1">Date</p>
            <p className="text-ink">{fmt(appt.starts_at)}</p>
          </div>
          <div>
            <p className="text-ink-3 text-xs mb-s-1">Durée</p>
            <p className="text-ink">{appt.duration_minutes ? `${appt.duration_minutes} min` : '—'}</p>
          </div>
        </div>

        {cancelOpen && (
          <div className="border border-line rounded-md p-s-3 flex flex-col gap-s-3">
            <p className="text-sm font-medium text-ink">Annuler ce rendez-vous</p>
            <p className="text-xs text-ink-3">Le support sera notifié. Un motif est obligatoire.</p>
            <Textarea
              label="Motif d'annulation"
              value={cancelMotif}
              onChange={(e) => setCancelMotif(e.target.value)}
              rows={3}
            />
            {cancelError && <p className="text-xs text-status-danger">{cancelError}</p>}
            <div className="flex gap-s-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => { setCancelOpen(false); setCancelError('') }}>
                Retour
              </Button>
              <Button variant="danger" size="sm" loading={cancelLoading} onClick={handleCancel}>
                Confirmer l'annulation
              </Button>
            </div>
          </div>
        )}

        {!cancelOpen && !cancelSuccess && (
          <div className="flex gap-s-2 pt-s-2 border-t border-line">
            <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)} disabled={appt.status === 'cancelled'}>
              Annuler
            </Button>
            <Button variant="secondary" size="sm">
              Ouvrir litige
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function AppointmentsAdminPage() {
  useAdminAudit('rendez-vous')

  const [appts, setAppts] = useState<Appt[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [proSearch, setProSearch] = useState('')
  const [estSearch, setEstSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Appt | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    let q = (supabase as any)
      .from('appointments')
      .select(
        `id, appointment_number, starts_at, duration_minutes, status,
         patient_profile:profiles!appointments_patient_id_fkey(full_name, phone),
         professional:professionals(specialty, profile:profiles(full_name)),
         organization:organizations(name)`,
        { count: 'exact' },
      )
      .order('starts_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (dateFrom) q = q.gte('starts_at', dateFrom)
    if (dateTo) q = q.lte('starts_at', dateTo + 'T23:59:59')
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)

    const { data, count, error } = await q
    if (!error) {
      setAppts(data ?? [])
      setTotal(count ?? 0)
    }
    setLoading(false)
  }, [page, dateFrom, dateTo, statusFilter])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const filtered = proSearch || estSearch
    ? appts.filter((a) => {
        const proName = a.professional?.profile?.full_name ?? ''
        const estName = a.organization?.name ?? ''
        return (
          (!proSearch || proName.toLowerCase().includes(proSearch.toLowerCase())) &&
          (!estSearch || estName.toLowerCase().includes(estSearch.toLowerCase()))
        )
      })
    : appts

  return (
    <div className="flex flex-col gap-s-5 p-s-4">
      <div>
        <h1 className="text-h2 font-display text-ink">Rendez-vous</h1>
        <p className="text-sm text-ink-3">{total} résultat{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <Card className="p-s-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-s-3">
          <Input label="Date de" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0) }} />
          <Input label="Date à" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0) }} />
          <Input label="Professionnel" placeholder="Recherche…" value={proSearch} onChange={(e) => setProSearch(e.target.value)} />
          <Input label="Établissement" placeholder="Recherche…" value={estSearch} onChange={(e) => setEstSearch(e.target.value)} />
          <Select
            label="Statut"
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v); setPage(0) }}
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'scheduled', label: 'Planifié' },
              { value: 'confirmed', label: 'Confirmé' },
              { value: 'completed', label: 'Terminé' },
              { value: 'cancelled', label: 'Annulé' },
              { value: 'no_show', label: 'Absent' },
            ]}
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {['N° RDV', 'Patient', 'Professionnel', 'Établissement', 'Statut', 'Date', ''].map((h) => (
                <th key={h} className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(7).fill(0).map((__, j) => (
                    <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
              : filtered.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="px-s-3 py-s-6 text-center text-ink-3">Aucun résultat</td>
                  </tr>
                )
                : filtered.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-3 font-mono text-xs text-ink-3">{a.appointment_number ?? a.id.slice(0, 8)}</td>
                    <td className="px-s-3 py-s-3">{a.patient_profile?.full_name ?? '—'}</td>
                    <td className="px-s-3 py-s-3">{a.professional?.profile?.full_name ?? '—'}</td>
                    <td className="px-s-3 py-s-3">{a.organization?.name ?? '—'}</td>
                    <td className="px-s-3 py-s-3"><Badge variant={statusBadge(a.status)}>{a.status}</Badge></td>
                    <td className="px-s-3 py-s-3 whitespace-nowrap text-ink-2">{fmt(a.starts_at)}</td>
                    <td className="px-s-3 py-s-3">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(a)}>Voir</Button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-3">Page {page + 1} / {totalPages}</p>
          <div className="flex gap-s-2">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="secondary" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <DetailModal appt={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}
