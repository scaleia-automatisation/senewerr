import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

export type PraticienStatus = 'DISPONIBLE' | 'EN_CONSULTATION' | 'PAUSE' | 'HORS_LIGNE'

interface PraticienProfile {
  id: string
  full_name: string
  specialite: string | null
  rpps: string | null
  avatar_url: string | null
  statut_professionnel: string | null
  is_verified: boolean
  cabinet_nom: string | null
  telephone_cabinet: string | null
}

interface PraticienState {
  praticien: PraticienProfile | null
  status: PraticienStatus
  loading: boolean
  setStatus: (s: PraticienStatus) => Promise<void>
  refresh: () => void
}

const PraticienCtx = createContext<PraticienState>({
  praticien: null,
  status: 'DISPONIBLE',
  loading: true,
  setStatus: async () => {},
  refresh: () => {},
})

export function PraticienProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const db = supabase as any

  const [praticien, setPraticien] = useState<PraticienProfile | null>(null)
  const [status, setStatusState] = useState<PraticienStatus>('DISPONIBLE')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await db
      .from('profiles')
      .select('id, full_name, specialite, rpps, avatar_url, statut_professionnel, is_verified, cabinet_nom, telephone_cabinet')
      .eq('id', profile.id)
      .single()

    if (data) {
      setPraticien(data)
      // Restore saved status from localStorage
      const saved = localStorage.getItem(`praticien_status_${profile.id}`) as PraticienStatus | null
      if (saved) setStatusState(saved)
    }
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  const setStatus = useCallback(async (s: PraticienStatus) => {
    setStatusState(s)
    if (profile?.id) localStorage.setItem(`praticien_status_${profile.id}`, s)
    // Notify via Edge Function if EN_CONSULTATION (non-blocking)
    if (s === 'EN_CONSULTATION') {
      supabase.functions.invoke('update-praticien-status', { body: { status: s } }).catch(() => {})
    }
  }, [profile?.id])

  return (
    <PraticienCtx.Provider value={{ praticien, status, loading, setStatus, refresh: load }}>
      {children}
    </PraticienCtx.Provider>
  )
}

export function usePraticien() {
  return useContext(PraticienCtx)
}
