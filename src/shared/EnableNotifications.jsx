import React, { useEffect, useState } from 'react'
import { isSupported, getMessaging, getToken, onMessage } from 'firebase/messaging'
import { initializeApp, getApps } from 'firebase/app'
import { getInstallations, getId as getInstallationsId, getToken as getInstallationsToken } from 'firebase/installations'

// We reuse the existing app initialized in src/utils/firebase.js via getApps
// This component registers the service worker and retrieves a Web Push token via VAPID

export default function EnableNotifications(){
  const STORAGE_KEY = 'ctrax_notifications_enabled'
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default')
  const [token, setToken] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    let mounted = true
    isSupported().then(ok => { if (mounted) setSupported(ok) }).catch(()=> setSupported(false))
    try {
      const flag = window?.localStorage?.getItem(STORAGE_KEY)
      if (flag === '1') setEnabled(true)
    } catch(e){}
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

      // Validate VAPID key by converting it to a Uint8Array and doing a short
      // test subscribe/unsubscribe on the PushManager. This surfaces clearer
      // errors (e.g. "applicationServerKey is not valid").
      function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
        const rawData = atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
      }

      try {
        // If the key contains accidental whitespace or quotes, trim them
        const normalized = String(vapidKey).trim()
        const appServerKey = urlBase64ToUint8Array(normalized)
        // If a subscription already exists, skip test subscribe; otherwise create a short-lived test and remove it.
        const existing = await reg.pushManager.getSubscription()
        if (!existing) {
          try {
            const testSub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey })
            // Immediately unsubscribe the test subscription to avoid duplicates.
            try { await testSub.unsubscribe() } catch (uerr) { console.warn('Failed to unsubscribe test push subscription', uerr) }
          } catch (subErr) {
            console.error('PushManager.subscribe test failed', subErr)
            // Re-throw to surface a helpful message in the UI
            throw new Error(`Invalid VAPID key or subscription error: ${subErr?.message || subErr}`)
          }
        }
      } catch (convErr) {
        throw new Error(`VAPID key validation failed: ${convErr?.message || convErr}`)
      }

      // Ensure we have a properly initialized Firebase app with config
      const app = getApps()[0] || initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      })
      const messaging = getMessaging(app)

      // Debug: log Firebase Installations ID and Installations token used by the SDK
      try {
        const installations = getInstallations(app)
        const instId = await getInstallationsId(installations)
        // forceRefresh true to ensure we get a fresh token for debugging
        const instToken = await getInstallationsToken(installations, { forceRefresh: true })
        console.info('FCM debug - Installations ID:', instId)
        console.info('FCM debug - Installations Auth Token (x-goog-firebase-installations-auth):', instToken)
      } catch (instErr) {
        console.warn('FCM debug - failed to read installations ID/token', instErr)
      }

      let t
      try {
        t = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg })
      } catch (err) {
        // Surface Firebase error codes for easier diagnosis (e.g., 401 Unauthorized)
        const code = err?.code ? ` (${err.code})` : ''
        console.error('FCM getToken error', err)
        throw new Error(`Failed to get token${code}: ${err?.message || err}`)
      }
      if (!t) throw new Error('Failed to get token (empty)')
      setToken(t)
      try { await navigator.clipboard.writeText(t) } catch {}

      // Persist one-time enabled flag so we don't show enable UI again
      try {
        window.localStorage.setItem(STORAGE_KEY, '1')
      } catch (e) {}
      setEnabled(true)
      // Show a brief confirmation message then hide the UI
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2500)

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
  // If notifications already enabled for this user, don't show the enable UI again.
  if (enabled && !showSuccess) return null

  return (
    <div className="p-4 bg-white rounded border shadow-sm">
      {showSuccess ? (
        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded p-3">Notifications enabled</div>
      ) : (
        <>
          <div className="font-semibold mb-2">Enable notifications (Web Push)</div>
          <p className="text-sm text-gray-600 mb-3">Allow notifications to receive alerts when buses are arriving or delayed. Works when you add the site to Home screen.</p>
          <div className="flex items-center gap-2">
            <button onClick={enable} disabled={loading} className="px-3 py-2 bg-indigo-600 text-white rounded disabled:opacity-60">
              {loading ? 'Enabling…' : 'Enable notifications'}
            </button>
            <span className="text-xs text-gray-600">Permission: {permission}</span>
          </div>
          {error && (
            <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}
        </>
      )}
    </div>
  )
}
