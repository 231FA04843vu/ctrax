import React, { useState } from 'react'
import { isRole } from '../utils/auth'
import SwDebug from '../shared/SwDebug'

export default function AdminNotifications(){
  if (!isRole('admin')) return <div className="p-4">Unauthorized</div>
  const [token, setToken] = useState(localStorage.getItem('ctrax_notifications_token') || '')
  const [topic, setTopic] = useState('')
  const [apiKey, setApiKey] = useState(sessionStorage.getItem('notifyApiKey') || '')
  const [endpoint, setEndpoint] = useState(sessionStorage.getItem('notifyEndpoint') || '/api/notify')
  const [resp, setResp] = useState(null)
  const [busy, setBusy] = useState(false)

  async function callNotify(payload){
    setBusy(true)
    setResp(null)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (apiKey) headers['x-api-key'] = apiKey
      sessionStorage.setItem('notifyApiKey', apiKey)
      sessionStorage.setItem('notifyEndpoint', endpoint)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })
      // handle empty or non-JSON responses safely
      let parsed = null
      try {
        const text = await res.text()
        parsed = text ? JSON.parse(text) : null
      } catch (e) {
        // not JSON, keep raw text
        try {
          const textAgain = await res.text()
          parsed = textAgain || null
        } catch { parsed = null }
      }
      setResp({ ok: res.ok, status: res.status, data: parsed })
    } catch (e) {
      setResp({ ok: false, error: e.message })
    } finally { setBusy(false) }
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <h2 className="text-xl font-semibold">Notifications Test (Admin)</h2>
      <div className="bg-white p-4 rounded shadow space-y-3">
        <label className="block text-sm text-gray-600">FCM Token</label>
        <textarea value={token} onChange={e => setToken(e.target.value)} rows={3} className="w-full border rounded p-2 text-sm" />
        <label className="block text-sm text-gray-600">Or Topic (e.g. student-123)</label>
        <input value={topic} onChange={e => setTopic(e.target.value)} className="w-full border rounded p-2 text-sm" />

        <label className="block text-sm text-gray-600">Endpoint (use deployed URL or local Netlify dev)</label>
        <input value={endpoint} onChange={e => { setEndpoint(e.target.value); sessionStorage.setItem('notifyEndpoint', e.target.value) }} className="w-full border rounded p-2 text-sm" placeholder="/api/notify or http://localhost:8888/.netlify/functions/notify" />

        <label className="block text-sm text-gray-600">Test API key (optional)</label>
        <input value={apiKey} onChange={e => { setApiKey(e.target.value); sessionStorage.setItem('notifyApiKey', e.target.value) }} className="w-full border rounded p-2 text-sm" placeholder="x-api-key value for server (dev only)" />

        <div className="flex gap-2">
          <button disabled={busy} onClick={() => callNotify({ action: 'send', token: token || undefined, topic: topic || undefined, notification: { title: 'Admin Test', body: 'Notification-style payload from admin UI' } })} className="px-3 py-2 bg-indigo-600 text-white rounded">Send notification payload</button>
          <button disabled={busy} onClick={() => callNotify({ action: 'send', token: token || undefined, topic: topic || undefined, data: { title: 'Admin Fallback', body: 'Data-only payload from admin UI', tag: 'admin-test', requireInteraction: true } })} className="px-3 py-2 bg-emerald-600 text-white rounded">Send data-only payload</button>
          <button disabled={busy} onClick={() => callNotify({ action: 'subscribe', token: token, topic: topic })} className="px-3 py-2 bg-yellow-600 text-white rounded">Subscribe token to topic</button>
        </div>

        <div className="pt-2">
          <div className="text-sm text-gray-600">Response:</div>
          <pre className="text-xs bg-gray-100 p-2 rounded max-h-48 overflow-auto">{resp ? JSON.stringify(resp, null, 2) : 'No response yet'}</pre>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <SwDebug />
      </div>
    </div>
  )
}
