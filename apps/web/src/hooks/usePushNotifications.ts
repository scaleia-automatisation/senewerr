import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/features/auth/AuthContext'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const { session } = useAuthContext()

  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_PUBLIC_KEY

  const [permission, setPermission] = useState<NotificationPermission>(
    isSupported ? Notification.permission : 'default',
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Détecte si l'appareil est déjà souscrit au chargement
  useEffect(() => {
    if (!isSupported || !session) return
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub)),
    )
  }, [isSupported, session])

  async function subscribe() {
    if (!isSupported || !session || !VAPID_PUBLIC_KEY) return
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }))

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      await supabase.from('push_subscriptions').upsert(
        {
          user_id: session.user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent.slice(0, 200),
        },
        { onConflict: 'user_id,endpoint' },
      )
      setSubscribed(true)
    } catch (err) {
      console.error('[push] subscribe error', err)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    if (!isSupported || !session) return
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', session.user.id)
          .eq('endpoint', endpoint)
      }
      setSubscribed(false)
    } catch (err) {
      console.error('[push] unsubscribe error', err)
    } finally {
      setLoading(false)
    }
  }

  return { isSupported, permission, subscribed, loading, subscribe, unsubscribe }
}
