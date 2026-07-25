/*
  Firebase Messaging Service Worker for Web Push (PWA).
  IMPORTANT: Replace the placeholders below with your Firebase Web App config values.
  These are safe to expose (client-side). Get them from Firebase Console → Project Settings → General.
*/

importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js')

// REPLACE with your project's web config
firebase.initializeApp({
  apiKey: 'AIzaSyChkXVb5l77lX0EeASB88itja7tWAT8rYk',
  authDomain: 'ctrax-0518.firebaseapp.com',
  projectId: 'ctrax-0518',
  // NOTE: Firebase Storage bucket should use appspot.com
  storageBucket: 'ctrax-0518.appspot.com',
  messagingSenderId: '897335032821',
  appId: '1:897335032821:web:ba8b3d381b1a17c71dbebc',
})

const messaging = firebase.messaging()

// Force new service worker to take control as soon as possible and help debugging
self.skipWaiting()
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
  console.log('[firebase-messaging-sw] activated and claimed clients')
})

// Log raw push events for deeper debugging
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw] push event received', event)
  // Fallback handler: many Android PWAs and some Chrome versions do not
  // reliably surface notifications for data-only FCM messages when the
  // Firebase helper doesn't trigger. Parse raw event.data and show a
  // notification explicitly so the user sees it.
  event.waitUntil((async () => {
    try {
      console.log('[firebase-messaging-sw] Notification.permission:', Notification.permission)
      let payload = null
      if (event.data) {
        try {
          const text = event.data.text()
          console.log('[firebase-messaging-sw] push event data text:', text)
          payload = JSON.parse(text)
        } catch (err) {
          console.warn('[firebase-messaging-sw] push.data parse failed, using text as body', err)
          payload = { data: { body: event.data ? event.data.text() : '' } }
        }
      }

      // payload may come in different shapes depending on how FCM was called
      const notif = (payload && (payload.notification || payload)) || {}
      const data = (payload && (payload.data || {})) || {}

      const title = (notif && (notif.title || notif.body && 'CTraX')) || data.title || 'CTraX'
      const body = (notif && (notif.body)) || data.body || ''

      const options = {
        body,
        data: { ...data, _fromPushFallback: true },
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: data.vibrate || [200, 100, 200],
        requireInteraction: data.requireInteraction !== undefined ? !!data.requireInteraction : true,
        tag: data.tag || 'ctrax-notification',
        renotify: data.renotify !== undefined ? !!data.renotify : true,
      }

      console.log('[firebase-messaging-sw] Showing notification', { title, options })
      await self.registration.showNotification(title, options)

      const current = await self.registration.getNotifications()
      console.log('[firebase-messaging-sw] current open notifications count:', current && current.length)

      // optionally focus clients for diagnostics (not forcing focus)
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      console.log('[firebase-messaging-sw] matched clients count:', allClients.length)
    } catch (e) {
      console.error('[firebase-messaging-sw] push fallback handler failed', e)
    }
  })())
})

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  try {
    console.log('[firebase-messaging-sw] onBackgroundMessage payload:', payload)
    const title = payload?.notification?.title || 'CTraX'
    const body = payload?.notification?.body || ''
    const options = {
      body,
      data: payload?.data || {},
      // icon: '/icons/icon-192.png', // optional app icon
      // actions: [ { action: 'open', title: 'Open' } ],
    }
    return self.registration.showNotification(title, options)
  } catch (e) {
    console.error('[firebase-messaging-sw] failed to show notification', e)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Focus an open client or open a new one
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    const url = '/' // customize if deep-linking
    for (const client of allClients){
      if (client.url.includes(self.location.origin)) { client.focus(); return }
    }
    await clients.openWindow(url)
  })())
})

// Provide an easy log for when the SW receives notifications (background)
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw] notification closed', event.notification && event.notification.data)
})
