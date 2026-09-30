'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingBag, Search, CheckCircle2, Loader2, Package } from 'lucide-react'

type FoundRes = {
  id: string
  pickup_code: string
  status: string
  total_amount_fcfa: number | null
  patientName: string
  items: Array<{ medication_name: string; quantity: number }>
  pharmacyId: string
}

type UpdateFn = {
  update: (v: unknown) => {
    eq: (c: string, v: string) => {
      eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>
    }
  }
}

function fmtCFA(n: number) { return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA' }

export default function RetraitsPage() {
  const [code, setCode]     = useState('')
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError]   = useState('')
  const [res, setRes]       = useState<FoundRes | null>(null)
  const [done, setDone]     = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed.length !== 4 || !/^\d{4}$/.test(trimmed)) {
      setError('Le code doit contenir exactement 4 chiffres.')
      return
    }
    setLoading(true); setError(''); setRes(null); setDone(false)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Non authentifié.'); setLoading(false); return }

    const { data: phData } = await supabase.from('pharmacies').select('id').eq('profile_id', user.id).maybeSingle()
    const pharmacy = phData as unknown as { id: string } | null
    if (!pharmacy) { setError('Pharmacie introuvable.'); setLoading(false); return }

    const { data: resData } = await supabase
      .from('pharmacy_reservations')
      .select('id, pickup_code, status, total_amount_fcfa, pharmacy_id, patients!inner(profiles!inner(first_name, last_name)), pharmacy_reservation_items(medication_name, quantity)')
      .eq('pickup_code', trimmed)
      .eq('pharmacy_id', pharmacy.id)
      .maybeSingle()

    const r = resData as unknown as {
      id: string; pickup_code: string; status: string; total_amount_fcfa: number | null; pharmacy_id: string
      patients: { profiles: { first_name: string | null; last_name: string | null } | null } | null
      pharmacy_reservation_items: Array<{ medication_name: string; quantity: number }>
    } | null

    if (!r) { setError('Aucune réservation trouvée avec ce code pour votre pharmacie.'); setLoading(false); return }

    // Vérifications spec 10.7
    if (r.status === 'collected') {
      setError('Cette réservation a déjà été retirée.')
      setLoading(false); return
    }
    if (['refused', 'cancelled', 'expired'].includes(r.status)) {
      setError(`Réservation non active (statut : ${r.status}).`)
      setLoading(false); return
    }
    if (r.status !== 'ready') {
      setError('La réservation n\'est pas encore prête au retrait.')
      setLoading(false); return
    }

    const pat = r.patients?.profiles
    setRes({
      id: r.id,
      pickup_code: r.pickup_code,
      status: r.status,
      total_amount_fcfa: r.total_amount_fcfa,
      patientName: pat ? `${pat.first_name ?? ''} ${pat.last_name ?? ''}`.trim() : 'Patient',
      items: r.pharmacy_reservation_items,
      pharmacyId: r.pharmacy_id,
    })
    setLoading(false)
  }

  async function handleConfirm() {
    if (!res) return
    setConfirming(true); setError('')
    const supabase = createClient()
    const { error: err } = await (supabase.from('pharmacy_reservations') as unknown as UpdateFn)
      .update({ status: 'collected', collected_at: new Date().toISOString() })
      .eq('id', res.id)
      .eq('pharmacy_id', res.pharmacyId)
    if (err) { setError(err.message); setConfirming(false); return }
    setDone(true); setConfirming(false); setRes(null); setCode('')
  }

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
          <ShoppingBag className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Retraits</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Saisir le code de retrait du patient</p>
        </div>
      </div>

      {/* Succès */}
      {done && (
        <div className="sw-card p-6 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="w-12 h-12 text-[var(--sw-success)]" />
          <div>
            <p className="font-bold text-[var(--sw-ink)]">Retrait confirmé !</p>
            <p className="text-sm text-[var(--sw-ink-2)] mt-1">La remise a été enregistrée avec succès.</p>
          </div>
          <button onClick={() => setDone(false)} className="text-sm text-[var(--sw-primary)] font-medium">
            Nouveau retrait
          </button>
        </div>
      )}

      {/* Formulaire */}
      {!done && (
        <>
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--sw-ink)] mb-2">
                Code de retrait (4 chiffres)
              </label>
              <div className="flex gap-2">
                <input
                  className="sw-input flex-1 text-center text-2xl font-mono tracking-[0.5em] font-bold"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="\d{4}"
                />
                <button
                  type="submit"
                  disabled={loading || code.length !== 4}
                  className="px-4 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium disabled:opacity-60 flex items-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Vérifier
                </button>
              </div>
            </div>
          </form>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-[var(--sw-danger)]">{error}</p>
            </div>
          )}

          {/* Résultat */}
          {res && (
            <div className="sw-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[var(--sw-ink)]">{res.patientName}</p>
                  <p className="text-xs text-[var(--sw-ink-2)] mt-0.5">Code : <span className="font-mono font-bold">{res.pickup_code}</span></p>
                </div>
                {res.total_amount_fcfa != null && (
                  <p className="text-lg font-bold text-[var(--sw-ink)]">{fmtCFA(res.total_amount_fcfa)}</p>
                )}
              </div>

              <div className="border-t border-[var(--sw-line)] pt-3 space-y-1.5">
                <p className="text-xs font-semibold text-[var(--sw-ink-2)] flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Médicaments
                </p>
                {res.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-[var(--sw-ink)]">{item.medication_name}</span>
                    <span className="text-[var(--sw-ink-2)]">× {item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-[var(--sw-success-bg)]">
                <p className="text-sm font-medium text-[var(--sw-success)]">Réservation prête — confirmez la remise</p>
                <p className="text-xs text-[var(--sw-ink-2)] mt-0.5">
                  Vérifiez l&apos;identité du patient avant de confirmer.
                </p>
              </div>

              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full py-3 rounded-xl bg-[var(--sw-success)] text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmer le retrait
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
