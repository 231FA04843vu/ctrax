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

    // Event-driven sends: query DB for affected students/parents and send to their topics
    if (action === 'event') {
      // eventType: 'bus_started' | 'arriving' | 'arrived' | 'delay'
      const { eventType, busNo, stop, routeId, extra } = body || {}
      if (!eventType) return json(400, { error: 'Provide eventType for action=event' })
      // load admin SDK to query Realtime Database
      const mod = await import('firebase-admin')
      const admin = (mod?.default || mod)
      const db = admin.database()

      // Find students matching busNo or stop or routeId
      const snap = await db.ref('users/student').once('value')
      const students = Object.values(snap.val() || {})

      // Filter logic depending on event type
      let targets = []
      if (eventType === 'bus_started') {
        // notify all students assigned to this bus (busNo)
        targets = students.filter(s => s.busNo && String(s.busNo) === String(busNo))
      } else if (eventType === 'arriving') {
        // notify students whose stop matches
        targets = students.filter(s => s.stop && String(s.stop) === String(stop))
      } else if (eventType === 'arrived') {
        // notify parents of students on this bus (arrival at destination)
        targets = students.filter(s => s.busNo && String(s.busNo) === String(busNo))
      } else if (eventType === 'delay') {
        // notify students and parents on this bus
        targets = students.filter(s => s.busNo && String(s.busNo) === String(busNo))
      } else {
        return json(400, { error: 'Unknown eventType' })
      }

      // craft messages for student and parent topics
      const sendResults = []
      for (const s of targets) {
        const studentTopic = `student-${s.id}`
        const parentTopic = `parent-${s.id}`
        let studentMsg = null
        let parentMsg = null
        if (eventType === 'bus_started') {
          studentMsg = { topic: studentTopic, notification: { title: 'Bus started', body: `Bus ${busNo} has started` } }
          parentMsg = { topic: parentTopic, notification: { title: 'Bus started', body: `Bus ${busNo} has started for ${s.name}` } }
        } else if (eventType === 'arriving') {
          studentMsg = { topic: studentTopic, notification: { title: 'Bus arriving', body: `Bus ${busNo} arriving at your stop in 5 minutes` } }
        } else if (eventType === 'arrived') {
          parentMsg = { topic: parentTopic, notification: { title: 'Bus arrived', body: `Bus ${busNo} has reached the destination` } }
        } else if (eventType === 'delay') {
          const reason = extra?.reason || 'Delayed'
          studentMsg = { topic: studentTopic, notification: { title: 'Bus delayed', body: `Bus ${busNo} delayed: ${reason}` } }
          parentMsg = { topic: parentTopic, notification: { title: 'Bus delayed', body: `Bus ${busNo} delayed: ${reason}` } }
        }
        try {
          if (studentMsg) sendResults.push(await msgSvc.send(studentMsg))
        } catch (e) {
          sendResults.push({ error: e?.message || String(e), target: studentTopic })
        }
        try {
          if (parentMsg) sendResults.push(await msgSvc.send(parentMsg))
        } catch (e) {
          sendResults.push({ error: e?.message || String(e), target: parentTopic })
        }
      }
      return json(200, { sent: sendResults.length, results: sendResults })
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
