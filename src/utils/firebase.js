import { initializeApp, getApps } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAnalytics, isSupported } from 'firebase/analytics'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

const app = getApps().length ? getApps()[0] : initializeApp(config)
export const db = getDatabase(app)

// Initialize Analytics only in browser and when measurementId is provided
export let analytics = null
if (typeof window !== 'undefined' && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
  // guard for environments where analytics isn't supported (e.g., some browsers)
  isSupported().then((ok) => {
    if (ok) {
      try { analytics = getAnalytics(app) } catch {}
    }
  }).catch(() => {})
}

export default { db, analytics }
