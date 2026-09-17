import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'

const MAX_PER_CATEGORY = 5

interface SearchResult {
  id: string
  label: string
  sublabel?: string
  category: string
  href: string
}

function highlight(text: string, q: string): string {
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return text
  return text.slice(0, idx) + '<mark class="bg-primary/20">' + text.slice(idx, idx + q.length) + '</mark>' + text.slice(idx + q.length)
}

const CATEGORY_LABELS: Record<string, string> = {
  patients: 'Patients',
  professionals: 'Professionnels',
  organizations: 'Établissements',
  orders: 'Commandes',
  appointments: 'Rendez-vous',
  payments: 'Paiements',
  prescriptions: 'Ordonnances',
  disputes: 'Litiges',
}

export default function GlobalSearchPage() {
  useAdminAudit('recherche')
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Record<string, SearchResult[]>>({})
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults({}); setLoading(false); return }
    setLoading(true)

    const ilike = `%${q}%`
    const qUp = q.toUpperCase()

    const [
      patientsRes,
      prosRes,
      orgsRes,
      ordersRes,
      apptsRes,
      paymentsRes,
      prescRes,
      disputesRes,
    ] = await Promise.allSettled([
      // Patients
      (supabase as any).from('profiles').select('id, full_name, email, phone').eq('role', 'patient')
        .or(`full_name.ilike.${ilike},email.ilike.${ilike},phone.ilike.${ilike}`)
        .limit(MAX_PER_CATEGORY),

      // Professionals
      (supabase as any).from('professionals').select('id, specialty, profile:profiles(id, full_name)')
        .ilike('profile.full_name', ilike)
        .limit(MAX_PER_CATEGORY),

      // Organizations
      (supabase as any).from('organizations').select('id, name, type')
        .ilike('name', ilike)
        .limit(MAX_PER_CATEGORY),

      // Orders (pharmacy_reservations)
      (supabase as any).from('pharmacy_reservations').select('id, reservation_code, status')
        .or(`reservation_code.ilike.${ilike},id.ilike.${ilike}`)
        .limit(MAX_PER_CATEGORY),

      // Appointments
      (supabase as any).from('appointments').select('id, appointment_number, starts_at, status')
        .or(`appointment_number.ilike.${ilike},id.ilike.${ilike}`)
        .limit(MAX_PER_CATEGORY),

      // Payments
      (supabase as any).from('payments').select('id, payment_number, amount, status')
        .or(`payment_number.ilike.${ilike},id.ilike.${ilike}`)
        .limit(MAX_PER_CATEGORY),

      // Prescriptions
      (supabase as any).from('prescriptions').select('id, prescription_number, status')
        .or(`prescription_number.ilike.${ilike},id.ilike.${ilike}`)
        .limit(MAX_PER_CATEGORY),

      // Disputes
      (supabase as any).from('disputes').select('id, category, status')
        .ilike('id', ilike)
        .limit(MAX_PER_CATEGORY),
    ])

    const out: Record<string, SearchResult[]> = {}

    if (patientsRes.status === 'fulfilled' && patientsRes.value.data?.length) {
      out.patients = patientsRes.value.data.map((p: any) => ({
        id: p.id, label: p.full_name ?? p.id, sublabel: p.email ?? p.phone,
        category: 'patients', href: `/admin/acteurs/${p.id}`,
      }))
    }

    if (prosRes.status === 'fulfilled' && prosRes.value.data?.length) {
      out.professionals = prosRes.value.data
        .filter((p: any) => p.profile?.full_name?.toLowerCase().includes(q.toLowerCase()))
        .map((p: any) => ({
          id: p.id, label: p.profile?.full_name ?? p.id, sublabel: p.specialty,
          category: 'professionals', href: `/admin/acteurs/${p.profile?.id ?? p.id}`,
        }))
    }

    if (orgsRes.status === 'fulfilled' && orgsRes.value.data?.length) {
      out.organizations = orgsRes.value.data.map((o: any) => ({
        id: o.id, label: o.name, sublabel: o.type, category: 'organizations', href: `/admin/etablissements/${o.id}`,
      }))
    }

    if (ordersRes.status === 'fulfilled' && ordersRes.value.data?.length) {
      out.orders = ordersRes.value.data.map((o: any) => ({
        id: o.id, label: o.reservation_code ?? o.id, sublabel: o.status,
        category: 'orders', href: `/admin/commandes/${o.id}`,
      }))
    }

    if (apptsRes.status === 'fulfilled' && apptsRes.value.data?.length) {
      out.appointments = apptsRes.value.data.map((a: any) => ({
        id: a.id, label: a.appointment_number ?? a.id, sublabel: a.status,
        category: 'appointments', href: `/admin/rendez-vous`,
      }))
    }

    if (paymentsRes.status === 'fulfilled' && paymentsRes.value.data?.length) {
      out.payments = paymentsRes.value.data.map((p: any) => ({
        id: p.id, label: p.payment_number ?? p.id, sublabel: `${p.amount?.toLocaleString('fr-FR')} FCFA — ${p.status}`,
        category: 'payments', href: `/admin/paiements`,
      }))
    }

    if (prescRes.status === 'fulfilled' && prescRes.value.data?.length) {
      out.prescriptions = prescRes.value.data.map((p: any) => ({
        id: p.id, label: p.prescription_number ? `ORD-${p.prescription_number}` : p.id, sublabel: p.status,
        category: 'prescriptions', href: `/admin/ordonnances-signalees`,
      }))
    }

    if (disputesRes.status === 'fulfilled' && disputesRes.value.data?.length) {
      out.disputes = disputesRes.value.data.map((d: any) => ({
        id: d.id, label: `LIT-${d.id.slice(0, 8).toUpperCase()}`, sublabel: d.category ?? d.status,
        category: 'disputes', href: `/admin/litiges`,
      }))
    }

    setResults(out)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults({}); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(() => { runSearch(query) }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, runSearch])

  const hasResults = Object.values(results).some((r) => r.length > 0)
  const categories = Object.keys(CATEGORY_LABELS)

  return (
    <div className="flex flex-col gap-s-5 p-s-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-h2 font-display text-ink">Recherche globale</h1>
        <p className="text-sm text-ink-3">Recherche simultanée dans tous les modules</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-s-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-3 pointer-events-none" />
        <input
          className="w-full h-12 pl-10 pr-s-4 rounded-md border border-line bg-surface text-body text-ink placeholder:text-ink-3 focus:outline-none focus:border-primary focus:shadow-focus transition-colors"
          placeholder="Nom, numéro de commande, email, téléphone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-s-3">
          {Array(3).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {/* No results */}
      {!loading && query.trim().length >= 2 && !hasResults && (
        <Card className="p-s-6 text-center">
          <p className="text-ink-3">Aucun résultat pour « {query} »</p>
        </Card>
      )}

      {/* Results grouped by category */}
      {!loading && hasResults && (
        <div className="flex flex-col gap-s-5">
          {categories.map((cat) => {
            const items = results[cat]
            if (!items?.length) return null
            return (
              <section key={cat}>
                <h2 className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-s-2">
                  {CATEGORY_LABELS[cat]} ({items.length})
                </h2>
                <div className="flex flex-col gap-s-1">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      className="w-full text-left flex items-center justify-between gap-s-3 rounded-md px-s-4 py-s-3 bg-surface border border-line hover:bg-surface-2 hover:border-primary transition-colors"
                      onClick={() => navigate(item.href)}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-medium text-ink text-sm"
                          dangerouslySetInnerHTML={{ __html: highlight(item.label, query) }}
                        />
                        {item.sublabel && (
                          <p className="text-xs text-ink-3 mt-0.5 truncate">{item.sublabel}</p>
                        )}
                      </div>
                      <Badge variant="neutral">{CATEGORY_LABELS[cat]}</Badge>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Hint */}
      {!query && (
        <p className="text-sm text-ink-3 text-center">
          Tapez au moins 2 caractères pour lancer la recherche
        </p>
      )}
    </div>
  )
}
