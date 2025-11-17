// Netlify Function: /api/notify
// Sends FCM notifications using Firebase Admin. Configure env in Netlify:
// - FIREBASE_SERVICE_ACCOUNT (base64 JSON) or FIREBASE_SERVICE_ACCOUNT_PATH (not recommended on Netlify)
// - NOTIFY_API_KEY (optional but recommended)

let messaging = null

async function initAdmin() {
  if (messaging) return messaging
  try {
    const mod = await import('firebase-admin')
    const admin = mod?.default || mod
    const hasApp = Array.isArray(admin.apps) && admin.apps.length > 0
    if (!hasApp) {
      const svcBase64 = process.env.FIREBASE_SERVICE_ACCOUNT
      const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      if (svcBase64) {
        const json = JSON.parse(Buffer.from(svcBase64, 'base64').toString('utf-8'))
        admin.initializeApp({ credential: admin.credential.cert(json) })
      } else if (svcPath) {
        // On Netlify this is usually not present; prefer base64 env
        const fs = await import('fs')
        const path = await import('path')
        const p = path.resolve(svcPath)
        const raw = fs.readFileSync(p, 'utf-8')
        const json = JSON.parse(raw)
        admin.initializeApp({ credential: admin.credential.cert(json) })
      } else {
        admin.initializeApp()
      }
    }
    messaging = (mod?.default || mod).messaging()
    return messaging
  } catch (e) {
    console.warn('Firebase Admin init failed:', e?.message || e)
    messaging = null
    return null
  }
}

function json(statusCode, body, extraHeaders = {}){
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  }
}

export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {})
  }

  // Health check
  if (event.httpMethod === 'GET') {
    return json(200, { ok: true })
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const apiKey = process.env.NOTIFY_API_KEY || ''
  if (apiKey) {
    const provided = event.headers?.['x-api-key'] || event.headers?.['X-Api-Key'] || ''
    if (provided !== apiKey) return json(401, { error: 'Unauthorized' })
  }

  const msgSvc = await initAdmin()
  if (!msgSvc) return json(503, { error: 'Notifications not configured on server' })

  let body
  try {
    body = event.body ? JSON.parse(event.body) : {}
  } catch (e) {
    return json(400, { error: 'Invalid JSON' })
  }

  const { token, topic, title, body: text, data } = body || {}
  // Support actions: send (default), subscribe, unsubscribe
  const action = body.action || 'send'
  if (action === 'send' && !token && !topic) return json(400, { error: 'Provide token or topic' })
  if ((action === 'subscribe' || action === 'unsubscribe') && (!token || !topic)) return json(400, { error: 'Provide token and topic for subscribe/unsubscribe' })

  try {
    if (action === 'send') {
      const msg = {
        notification: title || text ? { title: title || 'CTraX', body: text || '' } : undefined,
        data: data || undefined,
      }
      if (token) msg.token = token
      if (topic) msg.topic = topic
      const id = await msgSvc.send(msg)
      return json(200, { id })
    }

    if (action === 'subscribe') {
      // admin.messaging().subscribeToTopic accepts (tokens, topic)
      const resp = await msgSvc.subscribeToTopic(Array.isArray(token) ? token : [token], topic)
      return json(200, { result: resp })
    }

    if (action === 'unsubscribe') {
      const resp = await msgSvc.unsubscribeFromTopic(Array.isArray(token) ? token : [token], topic)
      return json(200, { result: resp })
    }

    return json(400, { error: 'Unknown action' })
  } catch (e) {
    const payload = {
      error: e?.message || String(e),
      code: e?.code || e?.errorInfo?.code,
      details: e?.errorInfo || undefined,
    }
    return json(500, payload)
  }
}
