import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pill, Stethoscope, ChevronRight, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

interface ConsultItem {
  id: string
  appointment_id?: string | null
  patient_id: string
  patient_name: string
  patient_avatar?: string | null
  created_at: string
  motif?: string | null
  type_consultation?: string | null
  duration_minutes?: number | null
  diagnostic_principal?: string | null
  has_ordonnance: boolean
  has_tp: boolean
  statut: 'en_cours' | 'terminee' | 'facturee'
}

const TYPE_LABELS: Record<string, string> = {
  premiere_visite:  'Première visite',
  consultation:     'Consultation',
  suivi:            'Suivi',
  urgence:          'Urgence',
  teleconsultation: 'Téléconsultation',
}

const STATUT_VARIANT: Record<string, 'accent'|'success'|'primary'> = {
  en_cours:  'accent',
  terminee:  'success',
  facturee:  'primary',
}

const TYPE_OPTS = [
  { value: '', label: 'Tous les types' },
  { value: 'premiere_visite',  label: 'Première visite' },
  { value: 'consultation',     label: 'Consultation' },
  { value: 'suivi',            label: 'Suivi' },
  { value: 'urgence',          label: 'Urgence' },
  { value: 'teleconsultation', label: 'Téléconsultation' },
]

const ORD_OPTS = [
  { value: '',  label: 'Avec ou sans ordonnance' },
  { value: '1', label: 'Avec ordonnance' },
  { value: '0', label: 'Sans ordonnance' },
]

export default function ConsultationsListPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const db = supabase as any

  const [items, setItems]       = useState<ConsultItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [typeFilter, setType]   = useState('')
  const [ordFilter, setOrd]     = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [page, setPage]         = useState(0)
  const PAGE = 20

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    let q = db.from('consultations')
      .select(`
        id, appointment_id, patient_id, created_at, motif,
        type_consultation, diagnostic_principal,
        patient:patient_id ( full_name, avatar_url ),
        appointment:appointment_id ( duration_minutes ),
        ordonnances ( id ),
        tiers_payants ( id )
      `)
      .eq('praticien_id', profile.id)
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)

    if (typeFilter) q = q.eq('type_consultation', typeFilter)
    if (dateFrom)   q = q.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo)     q = q.lte('created_at', `${dateTo}T23:59:59`)

    const { data } = await q
    let flat: ConsultItem[] = (data ?? []).map((r: any) => ({
      id:                  r.id,
      appointment_id:      r.appointment_id,
      patient_id:          r.patient_id,
      patient_name:        r.patient?.full_name ?? '—',
      patient_avatar:      r.patient?.avatar_url,
      created_at:          r.created_at,
      motif:               r.motif,
      type_consultation:   r.type_consultation,
      duration_minutes:    r.appointment?.duration_minutes,
      diagnostic_principal:r.diagnostic_principal,
      has_ordonnance:      (r.ordonnances?.length ?? 0) > 0,
      has_tp:              (r.tiers_payants?.length ?? 0) > 0,
      statut:              r.appointment_id ? 'terminee' : 'terminee',
    }))

    if (search.trim()) {
      const s = search.toLowerCase()
      flat = flat.filter(c => c.patient_name.toLowerCase().includes(s) || (c.motif ?? '').toLowerCase().includes(s))
    }
    if (ordFilter === '1') flat = flat.filter(c => c.has_ordonnance)
    if (ordFilter === '0') flat = flat.filter(c => !c.has_ordonnance)

    setItems(flat)
    setLoading(false)
  }, [profile?.id, page, typeFilter, dateFrom, dateTo, search, ordFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, typeFilter, ordFilter, dateFrom, dateTo])

  return (
    <div className="flex flex-col gap-s-4 p-s-4 md:p-s-6">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-s-2">
        <div className="relative min-w-[200px] flex-1">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher patient, motif…"
            className="w-full rounded-lg border border-line bg-surface py-s-2 pl-s-3 pr-s-3 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none" />
        </div>
        <Select options={TYPE_OPTS} value={typeFilter} onValueChange={setType} />
        <Select options={ORD_OPTS} value={ordFilter} onValueChange={setOrd} />
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="Du" />
        <Input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   placeholder="Au" />
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => navigate('/pro/consultations/nouvelle')}>
          Nouvelle consultation
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-small">
          <thead className="border-b border-line bg-surface-2">
            <tr>
              {['Patient','Date','Type','Motif','Durée','Ord.','TP','Statut',''].map(h => (
                <th key={h} className="px-s-3 py-s-2 text-left font-semibold text-ink-3 text-micro">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-line">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-s-3 py-s-2"><Skeleton className="h-4" /></td>
                    ))}
                  </tr>
                ))
              : items.length === 0
                ? (
                  <tr>
                    <td colSpan={9} className="px-s-3 py-s-10 text-center text-ink-3">
                      <Stethoscope className="mx-auto mb-s-2 h-8 w-8 opacity-30" />
                      Aucune consultation trouvée
                    </td>
                  </tr>
                )
                : items.map(c => (
                  <tr key={c.id}
                    onClick={() => navigate(
                      c.appointment_id
                        ? `/pro/consultation/${c.appointment_id}`
                        : `/pro/consultations/${c.id}`
                    )}
                    className="cursor-pointer border-b border-line transition-colors hover:bg-surface-2 last:border-0">
                    <td className="px-s-3 py-s-2">
                      <div className="flex items-center gap-s-2">
                        <Avatar src={c.patient_avatar} fallback={c.patient_name} size="sm" />
                        <span className="font-medium text-ink truncate max-w-[120px]">{c.patient_name}</span>
                      </div>
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                      {format(parseISO(c.created_at), 'dd/MM HH:mm')}
                    </td>
                    <td className="px-s-3 py-s-2">
                      {c.type_consultation && (
                        <span className="text-micro text-ink-3">{TYPE_LABELS[c.type_consultation] ?? c.type_consultation}</span>
                      )}
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-3 max-w-[140px] truncate">{c.motif ?? '—'}</td>
                    <td className="px-s-3 py-s-2 text-ink-3">
                      {c.duration_minutes ? `${c.duration_minutes} min` : '—'}
                    </td>
                    <td className="px-s-3 py-s-2 text-center">
                      {c.has_ordonnance && <Pill className="h-4 w-4 text-primary mx-auto" />}
                    </td>
                    <td className="px-s-3 py-s-2 text-center">
                      {c.has_tp && <RefreshCw className="h-4 w-4 text-secondary mx-auto" />}
                    </td>
                    <td className="px-s-3 py-s-2">
                      <Badge variant={STATUT_VARIANT[c.statut] ?? 'neutral'}>
                        {c.statut === 'en_cours' ? 'En cours' : c.statut === 'terminee' ? 'Terminée' : 'Facturée'}
                      </Badge>
                    </td>
                    <td className="px-s-3 py-s-2">
                      <ChevronRight className="h-4 w-4 text-ink-3" />
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
    </div>
  )
}
