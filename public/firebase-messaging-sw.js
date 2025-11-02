/*
  Firebase Messaging Service Worker for Web Push (PWA).
  IMPORTANT: Replace the placeholders below with your Firebase Web App config values.
  These are safe to expose (client-side). Get them from Firebase Console → Project Settings → General.
*/

importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js')

// REPLACE with your project's web config
firebase.initializeApp({
  apiKey: 'REPLACE_WITH_API_KEY',
  authDomain: 'REPLACE_WITH_AUTH_DOMAIN',
  projectId: 'REPLACE_WITH_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_STORAGE_BUCKET',
  messagingSenderId: 'REPLACE_WITH_MESSAGING_SENDER_ID',
  appId: 'REPLACE_WITH_APP_ID',
})

const messaging = firebase.messaging()

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'CTraX'
  const body = payload?.notification?.body || ''
  const options = {
    body,
    data: payload?.data || {},
    // icon: '/icons/icon-192.png', // optional app icon
    // actions: [ { action: 'open', title: 'Open' } ],
  }
  self.registration.showNotification(title, options)
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
