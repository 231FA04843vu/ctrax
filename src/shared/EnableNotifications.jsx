import React, { useEffect, useState } from 'react'
import { isSupported, getMessaging, getToken, onMessage } from 'firebase/messaging'
import { initializeApp, getApps } from 'firebase/app'

// We reuse the existing app initialized in src/utils/firebase.js via getApps
// This component registers the service worker and retrieves a Web Push token via VAPID

export default function EnableNotifications(){
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    isSupported().then(ok => { if (mounted) setSupported(ok) }).catch(()=> setSupported(false))
    return () => { mounted = false }
  }, [])

  async function enable(){
    setError('')
    setLoading(true)
    try {
      if (!supported) throw new Error('Notifications not supported on this browser')
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) throw new Error('Service Worker not available')

      // Register the messaging SW at the root scope
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

      // Request permission
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') throw new Error('Permission denied')

      // Get token using VAPID key
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
      if (!vapidKey) throw new Error('Missing VAPID key (VITE_FIREBASE_VAPID_KEY)')

      // Use existing app
      const app = getApps()[0] || initializeApp({})
      const messaging = getMessaging(app)
      const t = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg })
      if (!t) throw new Error('Failed to get token')
      setToken(t)
      try { await navigator.clipboard.writeText(t) } catch {}

      // Foreground message listener
      onMessage(messaging, (payload) => {
        // Optionally handle an in-app banner here
        // console.log('Foreground message', payload)
      })
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  if (!supported) return (
    <div className="p-4 bg-gray-50 rounded border text-sm text-gray-600">
      Notifications are not supported in this browser. Try Chrome on Android.
    </div>
  )

  return (
    <div className="p-4 bg-white rounded border shadow-sm">
      <div className="font-semibold mb-2">Enable notifications (Web Push)</div>
      <p className="text-sm text-gray-600 mb-3">Allow notifications to receive alerts when buses are arriving or delayed. Works when you add the site to Home screen.</p>
      <div className="flex items-center gap-2">
        <button onClick={enable} disabled={loading} className="px-3 py-2 bg-indigo-600 text-white rounded disabled:opacity-60">
          {loading ? 'Enabling…' : 'Enable notifications'}
        </button>
        <span className="text-xs text-gray-600">Permission: {permission}</span>
      </div>
      {token && (
        <div className="mt-3 text-xs break-all">
          <div className="text-gray-600">Token (copied to clipboard):</div>
          <div className="font-mono bg-gray-50 p-2 rounded border">{token}</div>
        </div>
      )}
      {error && (
        <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
      )}
    </div>
  )
}
