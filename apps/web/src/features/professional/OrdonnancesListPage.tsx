import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Pill, QrCode, Copy, Printer, CheckSquare, Square } from 'lucide-react'
import { format, parseISO, startOfWeek, startOfMonth, subMonths } from 'date-fns'
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
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrdItem {
  id: string
  patient_id: string
  patient_name: string
  patient_avatar?: string | null
  date_prescription: string
  date_expiration: string
  statut: string
  nb_medicaments: number
  qr_data_url?: string | null
}

// ── Constantes ────────────────────────────────────────────────────────────────

type TabStatut = '' | 'brouillon' | 'active' | 'dispensee' | 'annulee' | 'expiree'

const TABS: { value: TabStatut; label: string }[] = [
  { value: '',         label: 'Toutes' },
  { value: 'brouillon',label: 'Brouillons' },
  { value: 'active',   label: 'Actives / Signées' },
  { value: 'dispensee',label: 'Dispensées' },
  { value: 'annulee',  label: 'Annulées' },
  { value: 'expiree',  label: 'Expirées' },
]

const STATUT_VARIANT: Record<string, 'success' | 'accent' | 'danger' | 'neutral' | 'pending'> = {
  brouillon: 'pending',
  active:    'success',
  dispensee: 'accent',
  annulee:   'danger',
  expiree:   'neutral',
}

const STATUT_LABEL: Record<string, string> = {
  brouillon: 'Brouillon',
  active:    'Active',
  dispensee: 'Dispensée',
  annulee:   'Annulée',
  expiree:   'Expirée',
}

type PeriodeFilter = 'tous' | 'semaine' | 'mois' | '3mois'

const PERIODE_OPTS = [
  { value: 'tous',    label: 'Toutes périodes' },
  { value: 'semaine', label: 'Cette semaine' },
  { value: 'mois',    label: 'Ce mois' },
  { value: '3mois',   label: '3 derniers mois' },
]

const SORT_OPTS = [
  { value: 'recent',  label: 'Plus récentes' },
  { value: 'patient', label: 'Par patient' },
]

const PAGE = 20

function ordNumero(id: string): string {
  return `ORD-${id.slice(-8).toUpperCase()}`
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function OrdonnancesListPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const db = supabase as any

  const [items, setItems]     = useState<OrdItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [activeTab, setActiveTab] = useState<TabStatut>((searchParams.get('statut') as TabStatut) ?? '')
  const [periode, setPeriode] = useState<PeriodeFilter>('tous')
  const [sortBy, setSortBy]   = useState<'recent' | 'patient'>('recent')
  const [page, setPage]       = useState(0)

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggleSelect = (id: string) => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const toggleAll = () => setSelected(s => s.size === items.length ? new Set() : new Set(items.map(i => i.id)))

  // QR modal
  const [qrModal, setQrModal] = useState<OrdItem | null>(null)
  const [qrUrl, setQrUrl]     = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    setSelected(new Set())

    const now = new Date()
    let dateMin: string | null = null
    if (periode === 'semaine') dateMin = startOfWeek(now, { weekStartsOn: 1 }).toISOString()
    if (periode === 'mois')    dateMin = startOfMonth(now).toISOString()
    if (periode === '3mois')   dateMin = subMonths(now, 3).toISOString()

    let q = db.from('ordonnances')
      .select(`
        id, patient_id, date_prescription, date_expiration, statut,
        patient:patient_id ( full_name, avatar_url ),
        ordonnance_medicaments ( id )
      `)
      .eq('praticien_id', profile.id)
      .range(page * PAGE, page * PAGE + PAGE - 1)

    if (activeTab) q = q.eq('statut', activeTab)
    if (dateMin)   q = q.gte('date_prescription', dateMin)
    if (sortBy === 'recent')  q = q.order('date_prescription', { ascending: false })
    if (sortBy === 'patient') q = q.order('patient_id')

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
    }))

    if (search.trim()) {
      const s = search.toLowerCase()
      flat = flat.filter(o =>
        o.patient_name.toLowerCase().includes(s) ||
        ordNumero(o.id).toLowerCase().includes(s)
      )
    }

    setItems(flat)
    setLoading(false)
  }, [profile?.id, page, activeTab, periode, sortBy, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, activeTab, periode, sortBy])

  // Sync tab → URL param
  useEffect(() => {
    if (activeTab) setSearchParams({ statut: activeTab }, { replace: true })
    else setSearchParams({}, { replace: true })
  }, [activeTab])

  async function openQr(item: OrdItem) {
    setQrModal(item); setQrUrl(null); setQrLoading(true)
    const { data } = await db.from('ordonnances').select('qr_data_url').eq('id', item.id).single()
    setQrUrl(data?.qr_data_url ?? null)
    setQrLoading(false)
  }

  function printSelected() {
    const ids = [...selected]
    ids.forEach(id => {
      const o = items.find(x => x.id === id)
      if (o) window.open(`/pro/ordonnances/${id}`, '_blank')
    })
  }

  const tabCounts = TABS.reduce((acc, t) => ({ ...acc, [t.value]: 0 }), {} as Record<string, number>)
  items.forEach(i => { tabCounts[i.statut] = (tabCounts[i.statut] ?? 0) + 1 })

  return (
    <div className="flex flex-col gap-s-4 p-s-4 md:p-s-6">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-s-2">
        <div className="relative flex-1 min-w-[180px]">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher patient ou N° ordonnance…"
            className="w-full rounded-lg border border-line bg-surface py-s-2 pl-s-3 pr-s-3 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
          />
        </div>
        <Select options={PERIODE_OPTS} value={periode} onValueChange={v => setPeriode(v as PeriodeFilter)} />
        <Select options={SORT_OPTS}    value={sortBy}   onValueChange={v => setSortBy(v as 'recent' | 'patient')} />
        {selected.size > 0 && (
          <Button variant="secondary" size="sm" leftIcon={<Printer className="h-4 w-4" />} onClick={printSelected}>
            Imprimer ({selected.size})
          </Button>
        )}
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/pro/ordonnances/nouvelle')}>
          Nouvelle ordonnance
        </Button>
      </div>

      {/* ── Tabs statut ─────────────────────────────────────────────────────── */}
      <div className="flex overflow-x-auto gap-s-0 rounded-lg border border-line bg-surface-2 p-0.5">
        {TABS.map(t => (
          <button key={t.value} onClick={() => setActiveTab(t.value)}
            className={cn(
              'flex-shrink-0 rounded-md px-s-3 py-s-1.5 text-small font-medium transition-colors',
              activeTab === t.value ? 'bg-surface text-ink shadow-1' : 'text-ink-3 hover:text-ink',
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-small">
          <thead className="border-b border-line bg-surface-2">
            <tr>
              <th className="px-s-3 py-s-2 w-8">
                <button onClick={toggleAll} className="text-ink-3 hover:text-ink">
                  {selected.size === items.length && items.length > 0
                    ? <CheckSquare className="h-4 w-4" />
                    : <Square className="h-4 w-4" />
                  }
                </button>
              </th>
              {['N° Ordonnance', 'Patient', 'Date', 'Items', 'Statut', 'Actions'].map(h => (
                <th key={h} className="px-s-3 py-s-2 text-left font-semibold text-ink-3 text-micro whitespace-nowrap">{h}</th>
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
                    <td colSpan={7} className="px-s-3 py-s-12 text-center text-ink-3">
                      <Pill className="mx-auto mb-s-2 h-8 w-8 opacity-30" />
                      Aucune ordonnance
                    </td>
                  </tr>
                )
                : items.map(o => (
                  <tr key={o.id} className={cn(
                    'border-b border-line last:border-0 transition-colors hover:bg-surface-2',
                    selected.has(o.id) && 'bg-primary-soft',
                  )}>
                    <td className="px-s-3 py-s-2">
                      <button onClick={() => toggleSelect(o.id)} className="text-ink-3 hover:text-primary">
                        {selected.has(o.id)
                          ? <CheckSquare className="h-4 w-4 text-primary" />
                          : <Square className="h-4 w-4" />
                        }
                      </button>
                    </td>
                    <td className="px-s-3 py-s-2">
                      <span className="font-mono text-micro text-ink-3">{ordNumero(o.id)}</span>
                    </td>
                    <td className="px-s-3 py-s-2">
                      <button
                        onClick={() => navigate(`/pro/patients/${o.patient_id}`)}
                        className="flex items-center gap-s-2 hover:text-primary group"
                      >
                        <Avatar src={o.patient_avatar} fallback={o.patient_name} size="sm" />
                        <span className="font-medium text-ink group-hover:text-primary truncate max-w-[120px]">
                          {o.patient_name}
                        </span>
                      </button>
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                      {format(parseISO(o.date_prescription), 'd MMM HH:mm', { locale: fr })}
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                      {o.nb_medicaments} médicament{o.nb_medicaments !== 1 ? 's' : ''}
                    </td>
                    <td className="px-s-3 py-s-2">
                      <Badge variant={STATUT_VARIANT[o.statut] ?? 'neutral'}>
                        {STATUT_LABEL[o.statut] ?? o.statut}
                      </Badge>
                    </td>
                    <td className="px-s-3 py-s-2">
                      <div className="flex items-center gap-s-1">
                        <button
                          onClick={() => navigate(`/pro/ordonnances/${o.id}`)}
                          className="rounded px-s-2 py-s-1 text-micro text-ink-3 hover:bg-surface-2 hover:text-primary transition-colors"
                        >
                          Voir
                        </button>
                        <button
                          onClick={() => navigate(`/pro/ordonnances/nouvelle?patient=${o.patient_id}&renew=${o.id}`)}
                          className="rounded p-s-1 text-ink-3 hover:bg-surface-2 hover:text-primary transition-colors"
                          title="Dupliquer"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {o.statut === 'active' && (
                          <button
                            onClick={e => { e.stopPropagation(); openQr(o) }}
                            className="rounded p-s-1 text-ink-3 hover:bg-surface-2 hover:text-primary transition-colors"
                            title="QR code"
                          >
                            <QrCode className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-s-2">
        <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Précédent</Button>
        <span className="text-small text-ink-3">Page {page + 1}</span>
        <Button variant="ghost" size="sm" disabled={items.length < PAGE} onClick={() => setPage(p => p + 1)}>Suivant</Button>
      </div>

      {/* ── QR Modal ────────────────────────────────────────────────────────── */}
      <Modal open={!!qrModal} onOpenChange={open => { if (!open) setQrModal(null) }} title="QR Code — Ordonnance">
        {qrModal && (
          <div className="flex flex-col items-center gap-s-4 p-s-4">
            <p className="text-micro text-ink-3 font-mono">{ordNumero(qrModal.id)}</p>
            <p className="text-small text-ink-3 text-center">
              Patient : <strong className="text-ink">{qrModal.patient_name}</strong><br />
              Expire : <strong className="text-ink">
                {format(parseISO(qrModal.date_expiration), 'dd/MM/yyyy', { locale: fr })}
              </strong>
            </p>
            {qrLoading && <Skeleton className="h-64 w-64 rounded-lg" />}
            {!qrLoading && qrUrl && (
              <img src={qrUrl} alt="QR code ordonnance" className="h-64 w-64 rounded-lg border border-line" />
            )}
            {!qrLoading && !qrUrl && (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-line bg-surface-2">
                <QrCode className="h-10 w-10 text-ink-3 opacity-40" />
              </div>
            )}
            <div className="flex gap-s-2">
              <Button variant="primary" disabled={!qrUrl}
                onClick={() => {
                  if (qrUrl) {
                    const w = window.open('', '_blank')
                    if (w) {
                      w.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh"><img src="${qrUrl}" style="max-width:400px" /></body></html>`)
                      w.document.close(); w.print()
                    }
                  }
                }}>
                Imprimer
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/pro/ordonnances/${qrModal.id}`)}>
                Détail
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
