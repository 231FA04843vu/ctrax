import React, { useEffect, useState } from 'react'

export default function SwDebug(){
  const [permission, setPermission] = useState(Notification.permission)
  const [regInfo, setRegInfo] = useState(null)
  const [logs, setLogs] = useState([])

  function log(msg){ setLogs(l => [msg, ...l].slice(0,50)) }

  useEffect(() => {
    setPermission(Notification.permission)
    async function load(){
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (!reg) { setRegInfo(null); log('no registration found'); return }
        setRegInfo({ scope: reg.scope, active: reg.active?.scriptURL, installing: !!reg.installing, waiting: !!reg.waiting })
        log('registration loaded')
      } catch (e){ log('reg error: '+e.message) }
    }
    load()
  }, [])

  async function updateSw(){
    try{
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) return log('no reg')
      if (reg.waiting) { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); log('posted skip waiting') }
      await reg.update()
      log('sw update called')
      const r2 = await navigator.serviceWorker.getRegistration()
      setRegInfo({ scope: r2?.scope, active: r2?.active?.scriptURL, installing: !!r2?.installing, waiting: !!r2?.waiting })
    } catch (e){ log('update err: '+e.message) }
  }

  async function unregister(){
    try{
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) return log('no reg')
      await reg.unregister()
      log('unregistered')
      setRegInfo(null)
    } catch(e){ log('unreg err: '+e.message) }
  }

  async function registerSw(){
    try{
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      log('registered: '+(reg.scope||'no-scope'))
      setRegInfo({ scope: reg.scope, active: reg.active?.scriptURL, installing: !!reg.installing, waiting: !!reg.waiting })
    } catch(e){ log('register err: '+e.message) }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-700">Notification permission: <strong>{permission}</strong></div>
      <div className="text-sm text-gray-700">Service Worker: {regInfo ? (<span>scope: <code>{regInfo.scope}</code> active: <code style={{display:'inline-block',maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{regInfo.active}</code></span>) : <span className="text-gray-500">none</span>}</div>
      <div className="flex gap-2">
        <button onClick={() => Notification.requestPermission().then(p => { setPermission(p); log('permission:'+p) })} className="px-2 py-1 bg-blue-600 text-white rounded text-sm">Request permission</button>
        <button onClick={registerSw} className="px-2 py-1 bg-indigo-600 text-white rounded text-sm">Register SW</button>
        <button onClick={updateSw} className="px-2 py-1 bg-green-600 text-white rounded text-sm">Update SW</button>
        <button onClick={unregister} className="px-2 py-1 bg-red-600 text-white rounded text-sm">Unregister SW</button>
      </div>

      <div>
        <div className="text-xs text-gray-600">Recent debug:</div>
        <div className="bg-gray-100 p-2 rounded max-h-40 overflow-auto text-xs"><pre>{logs.join('\n') || 'no logs yet'}</pre></div>
      </div>
    </div>
  )
}
