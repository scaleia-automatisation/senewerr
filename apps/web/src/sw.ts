import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

// Précache des assets générés par vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST)

// Supabase → NetworkFirst (fallback cache si hors-ligne)
registerRoute(
  ({ url }) => url.hostname.includes('.supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-cache',
    networkTimeoutSeconds: 10,
    plugins: [{ cacheWillUpdate: async ({ response }) => (response?.status === 200 ? response : null) }],
  }),
)

// ── Push notifications ───────────────────────────────────────────────────────

self.addEventListener('push', event => {
  if (!event.data) return
  const { title = 'Séne Wérr', body = '', icon = '/icons/icon-192.png', url = '/' } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icons/icon-192.png',
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url: string = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        const existing = list.find(c => c.url.startsWith(self.location.origin) && 'focus' in c)
        if (existing) return (existing as WindowClient).focus()
        return clients.openWindow(url)
      }),
  )
})
