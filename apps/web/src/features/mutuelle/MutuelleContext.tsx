import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

export interface MutuelleData {
  id: string
  nom: string
  statut: 'active' | 'suspendue' | 'en_attente'
  logo_url: string | null
  suspension_raison: string | null
  adresse: string | null
  telephone: string | null
  email: string | null
}

interface MutuelleCtx {
  mutuelle: MutuelleData | null
  loading: boolean
  reload: () => void
}

const Ctx = createContext<MutuelleCtx>({ mutuelle: null, loading: true, reload: () => {} })

export function MutuelleProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const db = supabase as any
  const [mutuelle, setMutuelle] = useState<MutuelleData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile?.id) return
    // Find mutuelle linked to this gestionnaire via mutuelles_gestionnaires or profile.mutuelle_id
    const { data: prof } = await db.from('profiles').select('mutuelle_id').eq('id', profile.id).single()
    const mutuelleId = prof?.mutuelle_id
    if (!mutuelleId) {
      // Fallback: look up via mutuelles_gestionnaires table
      const { data: mg } = await db.from('mutuelles_gestionnaires')
        .select('mutuelle_id').eq('gestionnaire_id', profile.id).eq('actif', true).limit(1).single()
      if (!mg?.mutuelle_id) { setLoading(false); return }
      const { data } = await db.from('mutuelles')
        .select('id, nom, statut, logo_url, suspension_raison, adresse, telephone, email')
        .eq('id', mg.mutuelle_id).single()
      setMutuelle(data ?? null)
    } else {
      const { data } = await db.from('mutuelles')
        .select('id, nom, statut, logo_url, suspension_raison, adresse, telephone, email')
        .eq('id', mutuelleId).single()
      setMutuelle(data ?? null)
    }
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  return (
    <Ctx.Provider value={{ mutuelle, loading, reload: load }}>
      {children}
    </Ctx.Provider>
  )
}

export function useMutuelle() {
  return useContext(Ctx)
}
