import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

interface PatientBadges {
  notifications: number
  invoices: number
  refreshAll: () => void
}

const PatientBadgesCtx = createContext<PatientBadges>({
  notifications: 0,
  invoices: 0,
  refreshAll: () => {},
})

export function PatientBadgesProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState(0)
  const [invoices, setInvoices] = useState(0)

  const fetchAll = useCallback(async () => {
    if (!profile?.id) return

    const [notifRes, invRes] = await Promise.all([
      (supabase as any)
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .is('read_at', null)
        .is('deleted_at', null),
      (supabase as any)
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', profile.id)
        .eq('status', 'pending'),
    ])

    setNotifications(notifRes.count ?? 0)
    setInvoices(invRes.count ?? 0)
  }, [profile?.id])

  useEffect(() => {
    fetchAll()
    if (!profile?.id) return

    const channel = supabase
      .channel(`patient-badges-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => setNotifications(n => n + 1),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => fetchAll(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'invoices', filter: `patient_id=eq.${profile.id}` },
        () => fetchAll(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invoices', filter: `patient_id=eq.${profile.id}` },
        () => fetchAll(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, fetchAll])

  return (
    <PatientBadgesCtx.Provider value={{ notifications, invoices, refreshAll: fetchAll }}>
      {children}
    </PatientBadgesCtx.Provider>
  )
}

export function usePatientBadges() {
  return useContext(PatientBadgesCtx)
}
