import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { format } from 'date-fns'

interface PraticienBadges {
  notifications: number
  agenda: number
  tiersPayant: number
  refreshAll: () => void
}

const PraticienBadgesCtx = createContext<PraticienBadges>({
  notifications: 0,
  agenda: 0,
  tiersPayant: 0,
  refreshAll: () => {},
})

export function PraticienBadgesProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const db = supabase as any

  const [notifications, setNotifications] = useState(0)
  const [agenda, setAgenda] = useState(0)
  const [tiersPayant, setTiersPayant] = useState(0)

  const fetchAll = useCallback(async () => {
    if (!profile?.id) return
    const today = format(new Date(), 'yyyy-MM-dd')

    const [notifRes, agendaRes, tiersRes] = await Promise.all([
      db.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .is('read_at', null)
        .is('deleted_at', null),
      db.from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('professional_id', profile.id)
        .gte('start_time', `${today}T00:00:00`)
        .lt('start_time', `${today}T23:59:59`)
        .not('status', 'in', '("cancelled_patient","cancelled_professional","no_show")'),
      db.from('tiers_payant_demandes')
        .select('*', { count: 'exact', head: true })
        .eq('professional_id', profile.id)
        .eq('statut', 'pending'),
    ])

    setNotifications(notifRes.count ?? 0)
    setAgenda(agendaRes.count ?? 0)
    setTiersPayant(tiersRes.count ?? 0)
  }, [profile?.id])

  useEffect(() => {
    fetchAll()
    if (!profile?.id) return

    const channel = supabase
      .channel(`praticien-badges-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => fetchAll())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'appointments',
        filter: `professional_id=eq.${profile.id}`,
      }, () => fetchAll())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tiers_payant_demandes',
        filter: `professional_id=eq.${profile.id}`,
      }, () => fetchAll())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, fetchAll])

  return (
    <PraticienBadgesCtx.Provider value={{ notifications, agenda, tiersPayant, refreshAll: fetchAll }}>
      {children}
    </PraticienBadgesCtx.Provider>
  )
}

export function usePraticienBadges() {
  return useContext(PraticienBadgesCtx)
}
