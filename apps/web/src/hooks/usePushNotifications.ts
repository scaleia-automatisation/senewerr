import { useState, useEffect } from 'react'
import { getToken, onMessage } from 'firebase/messaging'
import { getFirebaseMessaging } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/features/auth/AuthContext'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

export function usePushNotifications() {
  const { session } = useAuthContext()

  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    !!VAPID_KEY

  const [permission, setPermission] = useState<NotificationPermission>(
    isSupported ? Notification.permission : 'default',
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Vérifie si un token FCM est déjà enregistré pour cet utilisateur
  useEffect(() => {
    if (!session) return
    supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1)
      .then(({ data }) => setSubscribed((data?.length ?? 0) > 0))
  }, [session])

  // Écoute les messages FCM en premier plan (app ouverte)
  useEffect(() => {
    if (!isSupported || !session) return
    let unsub: (() => void) | undefined
    getFirebaseMessaging().then(messaging => {
      if (!messaging) return
      unsub = onMessage(messaging, payload => {
        const { title = 'Séne Wérr', body = '' } = payload.notification ?? {}
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/icons/icon-192.png' })
        }
      })
    })
    return () => unsub?.()
  }, [isSupported, session])

  async function subscribe() {
    if (!isSupported || !session || !VAPID_KEY) return
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const messaging = await getFirebaseMessaging()
      if (!messaging) return

      // Utilise notre service worker Workbox (évite firebase-messaging-sw.js séparé)
      const registration = await navigator.serviceWorker.ready

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      })

      if (!token) return

      await supabase.from('push_subscriptions').upsert(
        {
          user_id:   session.user.id,
          fcm_token: token,
          user_agent: navigator.userAgent.slice(0, 200),
        },
        { onConflict: 'user_id,fcm_token' },
      )
      setSubscribed(true)
    } catch (err) {
      console.error('[push] subscribe error', err)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    if (!session) return
    setLoading(true)
    try {
      const messaging = await getFirebaseMessaging()
      if (messaging) {
        const registration = await navigator.serviceWorker.ready
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
        if (token) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', session.user.id)
            .eq('fcm_token', token)
        }
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
