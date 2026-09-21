import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { usePharmacy } from './PharmacyContext'

interface PharmacyBadges {
  ordonnances: number
  notifications: number
  stockAlertes: number
  commandes: number
  refreshAll: () => void
}

const PharmacyBadgesCtx = createContext<PharmacyBadges>({
  ordonnances: 0,
  notifications: 0,
  stockAlertes: 0,
  commandes: 0,
  refreshAll: () => {},
})

export function PharmacyBadgesProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const { pharmacie } = usePharmacy()
  const db = supabase as any

  const [ordonnances, setOrdonnances] = useState(0)
  const [notifications, setNotifications] = useState(0)
  const [stockAlertes, setStockAlertes] = useState(0)
  const [commandes, setCommandes] = useState(0)

  const fetchAll = useCallback(async () => {
    if (!profile?.id || !pharmacie?.id) return
    const pharmId = pharmacie.id

    const [ordRes, notifRes, cmdRes, stockItems] = await Promise.all([
      db.from('ordonnances_soumises')
        .select('*', { count: 'exact', head: true })
        .eq('pharmacie_id', pharmId)
        .eq('statut', 'en_attente'),
      db.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .is('read_at', null)
        .is('deleted_at', null),
      db.from('commandes_fournisseurs')
        .select('*', { count: 'exact', head: true })
        .eq('pharmacie_id', pharmId)
        .eq('statut', 'a_traiter'),
      // column-to-column compare (quantite <= seuil_alerte) → done client-side
      db.from('stock_medicaments')
        .select('quantite, seuil_alerte')
        .eq('pharmacie_id', pharmId)
        .is('deleted_at', null),
    ])

    setOrdonnances(ordRes.count ?? 0)
    setNotifications(notifRes.count ?? 0)
    setCommandes(cmdRes.count ?? 0)
    setStockAlertes(
      ((stockItems.data ?? []) as any[]).filter(
        (item) => typeof item.seuil_alerte === 'number' && item.quantite <= item.seuil_alerte,
      ).length,
    )
  }, [profile?.id, pharmacie?.id])

  useEffect(() => {
    fetchAll()
    if (!profile?.id || !pharmacie?.id) return
    const pharmId = pharmacie.id

    const channel = supabase
      .channel(`pharmacy-badges-${pharmId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordonnances_soumises', filter: `pharmacie_id=eq.${pharmId}` },
        () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes_fournisseurs', filter: `pharmacie_id=eq.${pharmId}` },
        () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_medicaments', filter: `pharmacie_id=eq.${pharmId}` },
        () => fetchAll())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, pharmacie?.id, fetchAll])

  return (
    <PharmacyBadgesCtx.Provider value={{ ordonnances, notifications, stockAlertes, commandes, refreshAll: fetchAll }}>
      {children}
    </PharmacyBadgesCtx.Provider>
  )
}

export function usePharmacyBadges() {
  return useContext(PharmacyBadgesCtx)
}
