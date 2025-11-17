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
