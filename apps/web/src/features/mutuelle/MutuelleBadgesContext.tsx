import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { useMutuelle } from './MutuelleContext'

interface MutuelleBadges {
  notifications: number
  demandes: number
  tiersPayant: number
  refreshAll: () => void
}

const MutuelleBadgesCtx = createContext<MutuelleBadges>({
  notifications: 0,
  demandes: 0,
  tiersPayant: 0,
  refreshAll: () => {},
})

export function MutuelleBadgesProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const { mutuelle } = useMutuelle()
  const db = supabase as any

  const [notifications, setNotifications] = useState(0)
  const [demandes, setDemandes] = useState(0)
  const [tiersPayant, setTiersPayant] = useState(0)

  const fetchAll = useCallback(async () => {
    if (!profile?.id || !mutuelle?.id) return
    const mutuelleId = mutuelle.id

    const [notifRes, demandesRes, tiersRes] = await Promise.all([
      db.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .is('read_at', null)
        .is('deleted_at', null),
      db.from('remboursement_demandes')
        .select('*', { count: 'exact', head: true })
        .eq('mutuelle_id', mutuelleId)
        .eq('statut', 'en_attente'),
      db.from('tiers_payant_demandes')
        .select('*', { count: 'exact', head: true })
        .eq('mutuelle_id', mutuelleId)
        .eq('statut', 'pending'),
    ])

    setNotifications(notifRes.count ?? 0)
    setDemandes(demandesRes.count ?? 0)
    setTiersPayant(tiersRes.count ?? 0)
  }, [profile?.id, mutuelle?.id])

  useEffect(() => {
    fetchAll()
    if (!profile?.id || !mutuelle?.id) return
    const mutuelleId = mutuelle.id

    const channel = supabase
      .channel(`mutuelle-badges-${mutuelleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'remboursement_demandes', filter: `mutuelle_id=eq.${mutuelleId}` },
        () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiers_payant_demandes', filter: `mutuelle_id=eq.${mutuelleId}` },
        () => fetchAll())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, mutuelle?.id, fetchAll])

  return (
    <MutuelleBadgesCtx.Provider value={{ notifications, demandes, tiersPayant, refreshAll: fetchAll }}>
      {children}
    </MutuelleBadgesCtx.Provider>
  )
}

export function useMutuelleBadges() {
  return useContext(MutuelleBadgesCtx)
}
