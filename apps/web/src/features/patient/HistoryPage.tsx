import { useState, useEffect } from 'react'
import { Calendar, Pill, FileText, Building2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs } from '@/components/ui/Tabs'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

interface HistoryItem {
  id: string
  type: 'appointment' | 'prescription' | 'reservation'
  date: string
  title: string
  subtitle: string
  status: string
  link?: string
}

export default function HistoryPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => { if (profile?.id) fetchHistory() }, [profile?.id])

  async function fetchHistory() {
    const [appts, prescriptions, reservations] = await Promise.all([
      supabase.from('appointments')
        .select('id, starts_at, status, reason, professionals(profiles(first_name, last_name))')
        .eq('patient_id', profile!.id)
        .in('status', ['completed', 'no_show', 'cancelled_patient', 'cancelled_professional'])
        .order('starts_at', { ascending: false })
        .limit(30),
      supabase.from('prescriptions')
        .select('id, prescription_number, issued_at, status, professionals(profiles(first_name, last_name))')
        .eq('patient_id', profile!.id)
        .order('issued_at', { ascending: false })
        .limit(20),
      supabase.from('pharmacy_reservations')
        .select('id, reservation_number, created_at, pharmacy_status, total_amount')
        .eq('patient_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const history: HistoryItem[] = []

    for (const a of (appts.data ?? [])) {
      const pro = (a.professionals as { profiles: { first_name: string; last_name: string } } | null)
      history.push({
        id: a.id, type: 'appointment',
        date: a.starts_at,
        title: `Dr ${pro?.profiles.last_name ?? ''}`,
        subtitle: a.reason ?? 'Consultation',
        status: a.status,
        link: undefined,
      })
    }

    for (const p of (prescriptions.data ?? [])) {
      const pro = (p.professionals as { profiles: { first_name: string; last_name: string } } | null)
      history.push({
        id: p.id, type: 'prescription',
        date: p.issued_at ?? p.id,
        title: p.prescription_number ?? 'Ordonnance',
        subtitle: `Dr ${pro?.profiles.last_name ?? ''}`,
        status: p.status,
        link: `/patient/ordonnances/${p.id}`,
      })
    }

    for (const r of (reservations.data ?? [])) {
      history.push({
        id: r.id, type: 'reservation',
        date: r.created_at,
        title: r.reservation_number ?? 'Réservation',
        subtitle: `${(r.total_amount ?? 0).toLocaleString('fr-FR')} FCFA`,
        status: r.pharmacy_status,
      })
    }

    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setItems(history)
    setLoading(false)
  }

  const tabs = [
    { id: 'all', label: 'Tout' },
    { id: 'appointment', label: 'Rendez-vous' },
    { id: 'prescription', label: 'Ordonnances' },
    { id: 'reservation', label: 'Réservations' },
  ]

  const filtered = activeTab === 'all' ? items : items.filter(i => i.type === activeTab)

  function icon(type: string) {
    if (type === 'appointment') return <Calendar className="w-4 h-4 text-primary" />
    if (type === 'prescription') return <Pill className="w-4 h-4 text-accent" />
    return <Building2 className="w-4 h-4 text-ink-3" />
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="flex flex-col gap-s-4 p-s-4">
      <h1 className="text-h2 font-display text-ink">Historique</h1>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {loading && (
        <div className="flex flex-col gap-s-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState title="Aucun historique" description="Vos activités passées apparaîtront ici." />
      )}

      <div className="flex flex-col gap-s-2">
        {filtered.map(item => {
          const content = (
            <Card key={item.id} className="p-s-3 flex items-center gap-s-3 hover:bg-surface-2 transition-colors">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-2 shrink-0">
                {icon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-small font-medium text-ink truncate">{item.title}</p>
                <p className="text-small text-ink-3 truncate">{item.subtitle}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-small text-ink-3">{formatDate(item.date)}</p>
                <Badge variant="default" className="text-small">{item.status}</Badge>
              </div>
            </Card>
          )
          return item.link ? <Link key={item.id} to={item.link}>{content}</Link> : content
        })}
      </div>
    </div>
  )
}
