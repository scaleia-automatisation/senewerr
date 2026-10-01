'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Share2, MapPin, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react'

type Pharmacy = { id: string; name: string; address_commune: string | null; address_region: string | null }

type InsertFn = {
  insert: (v: unknown) => { select: (q: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
}
type UpdateFn = {
  update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
}

export function ShareOrdonnanceModal({ prescriptionId, patientId }: { prescriptionId: string; patientId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [selectedPharmacy, setSelectedPharmacy] = useState<string | null>(null)
  const [loadingPharm, setLoadingPharm] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState('')
  const [shared, setShared] = useState(false)

  useEffect(() => {
    if (open && pharmacies.length === 0) loadPharmacies()
  }, [open])

  async function loadPharmacies() {
    setLoadingPharm(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('pharmacies')
      .select('id, name, address_commune, address_region')
      .eq('status', 'active')
      .order('name')
      .limit(30)
    setPharmacies((data ?? []) as unknown as Pharmacy[])
    setLoadingPharm(false)
  }

  async function handleShare() {
    if (!selectedPharmacy) return
    setSharing(true); setError('')
    const supabase = createClient()

    // Créer une réservation pharmacie liée à l'ordonnance
    const { data: resaData, error: resaErr } = await (supabase.from('reservations_pharmacie') as unknown as InsertFn)
      .insert({
        patient_id: patientId,
        pharmacy_id: selectedPharmacy,
        prescription_id: prescriptionId,
        status: 'new',
        has_coverage: false,
      })
      .select('id')
      .single()

    if (resaErr) { setError(resaErr.message); setSharing(false); return }

    // Mettre à jour le statut de l'ordonnance → 'shared'
    await (supabase.from('ordonnances') as unknown as UpdateFn)
      .update({ status: 'shared' })
      .eq('id', prescriptionId)

    setShared(true); setSharing(false)
    setTimeout(() => {
      setOpen(false)
      router.push('/patient/dossier/pharmacie')
    }, 1500)
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-full py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90">
        <Share2 className="w-4 h-4" /> Partager à une pharmacie
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-[var(--sw-surface)] rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[var(--sw-ink)]">Choisir une pharmacie</p>
              <button onClick={() => setOpen(false)} className="text-[var(--sw-ink-3)] hover:text-[var(--sw-ink)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--sw-ink-2)]">
              L'ordonnance sera partagée uniquement avec la pharmacie sélectionnée pour la durée du traitement de votre demande.
            </p>

            {shared ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-[var(--sw-success)] mx-auto" />
                <p className="text-sm font-medium text-[var(--sw-ink)]">Ordonnance partagée !</p>
                <p className="text-xs text-[var(--sw-ink-2)]">Redirection vers l'espace pharmacie…</p>
              </div>
            ) : (
              <>
                {loadingPharm ? (
                  <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin text-[var(--sw-ink-3)] mx-auto" /></div>
                ) : pharmacies.length === 0 ? (
                  <div className="py-4 text-center"><p className="text-sm text-[var(--sw-ink-2)]">Aucune pharmacie disponible.</p></div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1.5">
                    {pharmacies.map(ph => (
                      <button key={ph.id} onClick={() => setSelectedPharmacy(ph.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors
                          ${selectedPharmacy === ph.id ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]' : 'border-[var(--sw-line)] text-[var(--sw-ink)]'}`}>
                        <p className="font-medium">{ph.name}</p>
                        {(ph.address_commune || ph.address_region) && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 opacity-60" />
                            <p className="text-xs opacity-70">{[ph.address_commune, ph.address_region].filter(Boolean).join(', ')}</p>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-xs text-[var(--sw-danger)] bg-red-50 px-3 py-2 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl bg-[var(--sw-surface-2)] text-sm font-medium text-[var(--sw-ink-2)]">
                    Annuler
                  </button>
                  <button onClick={handleShare} disabled={!selectedPharmacy || sharing}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                    Partager
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
