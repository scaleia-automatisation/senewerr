import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

declare let self: ServiceWorkerGlobalScope

// ── Workbox — précache des assets ──────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  ({ url }) => url.hostname.includes('.supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-cache',
    networkTimeoutSeconds: 10,
    plugins: [{ cacheWillUpdate: async ({ response }) => (response?.status === 200 ? response : null) }],
  }),
)

// ── Firebase Cloud Messaging — notifications en arrière-plan ───────────────
const firebaseApp = initializeApp({
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
})

const messaging = getMessaging(firebaseApp)

onBackgroundMessage(messaging, payload => {
  const { title = 'Séne Wérr', body = '', icon = '/icons/icon-192.png' } =
    payload.notification ?? {}
  const url = payload.data?.url ?? '/'
  self.registration.showNotification(title, {
    body,
    icon,
    badge: '/icons/icon-192.png',
    data: { url },
  })
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url: string = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        const existing = list.find(c => 'focus' in c)
        if (existing) return (existing as WindowClient).focus()
        return clients.openWindow(url)
      }),
  )
})
