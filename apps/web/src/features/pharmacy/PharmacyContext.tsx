import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

export interface PharmacieData {
  id: string
  nom: string
  en_service: boolean
  logo_url: string | null
  adresse: string | null
  telephone: string | null
}

interface PharmacyCtx {
  pharmacie: PharmacieData | null
  loading: boolean
  toggleEnService: () => Promise<void>
}

const Ctx = createContext<PharmacyCtx>({
  pharmacie: null,
  loading: true,
  toggleEnService: async () => {},
})

export function PharmacyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const db = supabase as any
  const [pharmacie, setpharmacie] = useState<PharmacieData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile?.id) return
    const { data: p } = await db.from('profiles').select('pharmacy_id').eq('id', profile.id).single()
    if (!p?.pharmacy_id) { setLoading(false); return }

    const { data } = await db
      .from('pharmacies')
      .select('id, nom, en_service, logo_url, adresse, telephone')
      .eq('id', p.pharmacy_id)
      .single()

    setpharmacie(data ?? null)
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  async function toggleEnService() {
    if (!pharmacie) return
    const next = !pharmacie.en_service
    const { error } = await db.from('pharmacies').update({ en_service: next }).eq('id', pharmacie.id)
    if (error) { toast.error('Impossible de modifier le statut.'); return }

    setpharmacie(prev => prev ? { ...prev, en_service: next } : null)

    try {
      await db.from('notifications').insert({
        event_type: 'systeme',
        title: next ? 'Pharmacie en service' : 'Pharmacie hors service',
        message: `La pharmacie "${pharmacie.nom}" est passée ${next ? 'en service' : 'hors service'}.`,
        badge_category: 'admin',
        priority: 'normal',
        data: { pharmacie_id: pharmacie.id },
      })
    } catch { /* non-bloquant */ }

    toast.success(next ? 'Pharmacie en service' : 'Pharmacie hors service')
  }

  return (
    <Ctx.Provider value={{ pharmacie, loading, toggleEnService }}>
      {children}
    </Ctx.Provider>
  )
}

export function usePharmacy() {
  return useContext(Ctx)
}
