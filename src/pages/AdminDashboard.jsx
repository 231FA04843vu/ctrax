import React, { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { isRole, logout, getUsers } from '../utils/auth'
import { useI18n } from '../i18n/i18n.jsx'
import { listBuses, onBusFor, setBusFor } from '../utils/busData'
import { onStopsFor, setStopsFor } from '../utils/routeData'
import { onDriverApplications, approveDriverApplication, rejectDriverApplication, assignDriverToBus } from '../utils/admin'
import { onAppConfig, setAppConfig } from '../utils/appConfig'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { haversineKm } from '../utils/routeLogic'

export default function AdminDashboard(){
  const { t } = useI18n()
  if (!isRole('admin')) return <Navigate to="/login/admin" replace />
  const [tab, setTab] = useState('approvals')

  // Bus state (multi)
  const [busId, setBusId] = useState('')
  const [buses, setBuses] = useState(listBuses())
  const [bus, setBus] = useState(null)
  const [creating, setCreating] = useState(false)
  const [busSaved, setBusSaved] = useState(false)
  const [editingBusId, setEditingBusId] = useState('')
  const [savedBusId, setSavedBusId] = useState('')
  const busSaveTimerRef = useRef(null)
  useEffect(() => {
    // polling-light: update list reactively every 1s from listBuses (since we have a listener inside busData)
    const t = setInterval(() => setBuses(listBuses()), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    // select first bus if none and not creating
    if (!creating && !busId && buses.length){ setBusId(buses[0].id) }
  }, [buses, busId, creating])
  useEffect(() => {
    if (!busId) { setBus(null); return }
    const off = onBusFor(busId, setBus)
    return off
  }, [busId])
  const [busForm, setBusForm] = useState({ id: '', name: '', startTime: '16:30' })
  useEffect(() => {
    if (!bus) return
    setCreating(false)
  setBusForm({ id: bus.id || '', name: bus.name || '', startTime: bus.startTime || '16:30' })
  }, [bus])

  // Stops management per bus
  const [stops, setStopsLocal] = useState([])
  const [stopsSaved, setStopsSaved] = useState(false)
  const stopsSaveTimerRef = useRef(null)
  useEffect(() => {
    // Clear current stops immediately to avoid showing previous bus's stops briefly
    setStopsLocal([])
    if (!busId) return
    const off = onStopsFor(busId, setStopsLocal)
    return off
  }, [busId])
  const addStop = () => setStopsLocal(s => [...s, { name: '', position: [0,0], plannedOffsetMins: 0 }])
  const updateStop = (i, patch) => setStopsLocal(s => s.map((st, idx) => idx === i ? { ...st, ...patch } : st))
  const deleteStop = (i) => setStopsLocal(s => s.filter((_, idx) => idx !== i))
  const saveStops = async () => {
    if (!busId) return
    await setStopsFor(busId, stops)
    setStopsSaved(true)
    if (stopsSaveTimerRef.current) clearTimeout(stopsSaveTimerRef.current)
    stopsSaveTimerRef.current = setTimeout(() => setStopsSaved(false), 2500)
  }

  // Unified place search (Nominatim) for name, PIN code, area, or std code
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null) // { display_name, lat, lon }
  const [mapPos, setMapPos] = useState(null) // [lat, lon] — draggable marker position
  const [stopName, setStopName] = useState('')
  const [offset, setOffset] = useState(0)
  const [avgSpeed, setAvgSpeed] = useState(30) // km/h for offset calc

  // Leaflet default marker icon fix (for Vite)
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString(),
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString(),
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString(),
  })

  // Helper: pick a short place name from Nominatim address
  function shortNameFromAddress(addr, fallback){
    if (!addr) return fallback
    return addr.village || addr.town || addr.city || addr.hamlet || addr.suburb || fallback
  }

  async function reverseGeocodeName(lat, lon){
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error('reverse failed')
      const data = await res.json()
      const dn = data?.display_name || ''
      return shortNameFromAddress(data?.address, dn.split(',')[0].trim()) || dn
    } catch {
      return ''
    }
  }

  async function computeAndSetAutoOffset(lat, lon){
    const ORIGIN = [16.2315471, 80.5526116]
    const speed = Math.max(5, Number(avgSpeed) || 30)
    // Try OSRM distance, fallback to haversine
    try {
      const coordsParam = `${ORIGIN[1]},${ORIGIN[0]};${lon},${lat}`
      const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=false&alternatives=false&steps=false`
      const res = await fetch(url)
      if (res.ok){
        const data = await res.json()
        const meters = data?.routes?.[0]?.distance
        if (typeof meters === 'number'){
          const km = meters / 1000
          setOffset(Math.round((km / speed) * 60))
          return
        }
      }
    } catch {}
    const kmFallback = haversineKm(ORIGIN, [lat, lon])
    setOffset(Math.round((kmFallback / speed) * 60))
  }

  // Debounced search against Nominatim for place/PIN/area/STD terms
  useEffect(() => {
    if (!q || q.trim().length < 3){ setSuggestions([]); return }
    setSearching(true)
    const id = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=10`
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) throw new Error('search failed')
        const data = await res.json()
        setSuggestions(Array.isArray(data) ? data : [])
      } catch (e) {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 450)
    return () => clearTimeout(id)
  }, [q])

  // When a suggestion is picked, initialize preview marker and default name
  useEffect(() => {
    if (!selected) return
    const lat = parseFloat(selected.lat)
    const lon = parseFloat(selected.lon)
    setMapPos([lat, lon])
    const dn = selected.display_name || ''
    const short = shortNameFromAddress(selected.address, dn.split(',')[0].trim()) || dn
    setStopName(short)
    computeAndSetAutoOffset(lat, lon)
  }, [selected])

  const confirmAddFromSelected = () => {
    if (!mapPos) return
    const name = (stopName || selected?.display_name || 'Unnamed').trim()
    setStopsLocal(s => [...s, { name, position: [mapPos[0], mapPos[1]], plannedOffsetMins: parseInt(offset,10)||0 }])
    // reset search UI
    setQ(''); setSuggestions([]); setSelected(null); setMapPos(null); setStopName(''); setOffset(0)
  }

  // Auto-arrange by road route using OSRM polyline projection
  async function autoArrangeByRoad(){
    if (!stops.length) return
    // Vignan University (fixed origin)
    const ORIGIN = [16.2315471, 80.5526116]
    // Destination: farthest stop from origin
    const withDists = stops.map(s => ({ s, d: haversineKm(ORIGIN, s.position) }))
    const far = withDists.reduce((a,b) => (b.d > a.d ? b : a), withDists[0]).s
    const coordsParam = `${ORIGIN[1]},${ORIGIN[0]};${far.position[1]},${far.position[0]}`
    let poly = null
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&steps=false&continue_straight=true`
      const res = await fetch(url)
      if (!res.ok) throw new Error('OSRM failed')
      const data = await res.json()
      const geom = data?.routes?.[0]?.geometry?.coordinates || []
      poly = geom.map(([lng, lat]) => [lat, lng])
    } catch {
      poly = null
    }

    // precompute cumulative distances along polyline
    function cumulative(poly){
      const cum = [0]
      for (let i=1;i<poly.length;i++) cum[i] = cum[i-1] + haversineKm(poly[i-1], poly[i])
      return cum
    }
    function projectPoint(poly, cum, p){
      if (!poly || poly.length < 2) return { along: haversineKm([16.2315471,80.5526116], p), ortho: 0 }
      let best = { along: 0, ortho: Number.POSITIVE_INFINITY }
      for (let i=0;i<poly.length-1;i++){
        const a = poly[i], b = poly[i+1]
        // vector projection t of point p onto segment ab
        const A = [a[0], a[1]], B = [b[0], b[1]], P = [p[0], p[1]]
        // approximate using planar math (small segment assumption)
        const ax = A[1], ay = A[0], bx = B[1], by = B[0], px = P[1], py = P[0]
        const vx = bx - ax, vy = by - ay
        const wx = px - ax, wy = py - ay
        const dv = vx*vx + vy*vy || 1e-9
        let t = (wx*vx + wy*vy) / dv
        if (t < 0) t = 0; if (t > 1) t = 1
        const proj = [ay + vy*t, ax + vx*t]
        const ortho = haversineKm(p, proj)
        if (ortho < best.ortho){
          best.ortho = ortho
          best.along = cum[i] + haversineKm(a, proj)
        }
      }
      return best
    }

    let ordered = stops
    let offsets = {}
    if (poly){
      const cum = cumulative(poly)
      const mapped = stops.map(s => ({ s, proj: projectPoint(poly, cum, s.position) }))
      mapped.sort((x,y) => x.proj.along - y.proj.along)
      ordered = mapped.map(m => m.s)
      const speed = Math.max(5, Number(avgSpeed) || 30)
      offsets = mapped.reduce((acc, m) => {
        acc[m.s.name] = Math.round((m.proj.along / speed) * 60)
        return acc
      }, {})
    } else {
      // Fallback: sort by straight-line distance from origin
      const mapped = stops.map(s => ({ s, d: haversineKm(ORIGIN, s.position) }))
      mapped.sort((a,b) => a.d - b.d)
      ordered = mapped.map(m => m.s)
      const speed = Math.max(5, Number(avgSpeed) || 30)
      offsets = mapped.reduce((acc, m) => {
        acc[m.s.name] = Math.round((m.d / speed) * 60)
        return acc
      }, {})
    }

    setStopsLocal(ordered.map(s => ({ ...s, plannedOffsetMins: offsets[s.name] ?? s.plannedOffsetMins ?? 0 })))
  }

  // Driver applications
  const [apps, setApps] = useState([])
  useEffect(() => onDriverApplications(setApps), [])
  const [actingId, setActingId] = useState('')
  // removed SMS/WhatsApp banner
  const doApprove = async (app) => {
    setActingId(app.id)
    try {
      await approveDriverApplication(app)
    } catch (e) {
      alert(e.message || 'Failed to approve')
    } finally {
      setActingId('')
    }
  }
  const doReject = async (app) => {
    const reason = prompt('Reason for rejection (optional):') || ''
    setActingId(app.id)
    try {
      await rejectDriverApplication(app, reason)
    } catch (e) {
      alert(e.message || 'Failed to reject')
    } finally {
      setActingId('')
    }
  }

  // Active drivers (users/driver) — show as horizontal list at bottom of approvals
  const [drivers, setDrivers] = useState(() => {
    const raw = getUsers('driver') || []
    const seen = new Set()
    const uniq = []
    for (const d of raw){
      const key = (d.email || '').toLowerCase() || d.id
      if (!seen.has(key)){ seen.add(key); uniq.push(d) }
    }
    return uniq
  })
  useEffect(() => {
    const t = setInterval(() => {
      const raw = getUsers('driver') || []
      const seen = new Set()
      const uniq = []
      for (const d of raw){
        const key = (d.email || '').toLowerCase() || d.id
        if (!seen.has(key)){ seen.add(key); uniq.push(d) }
      }
      setDrivers(uniq)
    }, 1000)
    return () => clearInterval(t)
  }, [])
  const [assigning, setAssigning] = useState('') // driverId being saved
  const [assignDraft, setAssignDraft] = useState({}) // driverId -> busId
  // Removed per-driver password reset quick action to avoid accidental resets

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (busSaveTimerRef.current) clearTimeout(busSaveTimerRef.current)
      if (stopsSaveTimerRef.current) clearTimeout(stopsSaveTimerRef.current)
    }
  }, [])

  return (
  <div className="space-y-4 w-full max-w-none mx-0 px-0 sm:px-3 md:px-4">
      <div className="flex items-center justify-between px-3 sm:px-0">
        <h2 className="text-2xl font-semibold">{t('dashboard.admin')}</h2>
        <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={() => { logout(); window.location.href = '/' }}>{t('action.signOut')}</button>
      </div>

      <div className="flex items-center gap-3">
        {['approvals','bus','route','app'].map(k => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 rounded border ${tab===k? 'bg-indigo-600 text-white border-indigo-600' : ''}`}>{k[0].toUpperCase()+k.slice(1)}</button>
        ))}
      </div>

      {tab === 'approvals' && (
        <section className="bg-white p-4 rounded shadow">
          {/* SMS/WhatsApp banner removed as per request */}
          <h3 className="font-semibold mb-3">Driver Applications</h3>
          {!apps.length ? (
            <div className="text-sm text-gray-600">No applications</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Email</th>
                    <th className="text-left px-3 py-2">Phone</th>
                    <th className="text-left px-3 py-2">Bus ID</th>
                    <th className="text-left px-3 py-2">DL No.</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {apps.map(app => (
                    <tr key={app.id} className={app.status!== 'pending' ? 'opacity-70' : ''}>
                      <td className="px-3 py-2 capitalize">{app.name}</td>
                      <td className="px-3 py-2">{app.email}</td>
                      <td className="px-3 py-2">{app.phone}</td>
                      <td className="px-3 py-2">{app.busNo}</td>
                      <td className="px-3 py-2">{app.licenseNo || '—'}</td>
                      <td className="px-3 py-2 capitalize">{app.status}</td>
                      <td className="px-3 py-2">
                        {app.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button disabled={actingId===app.id} onClick={() => doApprove(app)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Approve</button>
                            <button disabled={actingId===app.id} onClick={() => doReject(app)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Reject</button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </section>
      )}

      {/* Active Drivers list at bottom of Approvals tab */}
      {tab === 'approvals' && (
        <section className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Active Drivers</h3>
            <div className="text-sm text-gray-600">Total: <span className="font-medium">{drivers.length}</span></div>
          </div>
          {drivers.length === 0 ? (
            <div className="text-sm text-gray-600">No active drivers yet.</div>
          ) : (
            <div className="space-y-2">
              {drivers.map(d => {
                const phone = d.phone || '—'
                const email = d.email || '—'
                const busNo = d.busNo || '—'
                return (
                  <div key={d.id} className="w-full border rounded p-3 bg-gray-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-6 whitespace-nowrap overflow-x-auto">
                      <span className="font-medium capitalize">{d.name || 'Driver'}</span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-600">Phone: <span className="font-medium">{phone}</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-600 max-w-[220px] truncate">Email: <span className="font-medium">{email}</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-600">Bus: <span className="font-medium">{busNo}</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-600">DL: <span className="font-medium">{d.licenseNo || '—'}</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-xs text-gray-500">ID: {d.id}</span>
                      </div>
                      {/* Assign bus control */}
                      <div className="flex items-center gap-2">
                        <select className="p-1 border rounded text-sm" value={assignDraft[d.id] ?? (d.busNo || '')} onChange={e=>setAssignDraft(s=>({ ...s, [d.id]: e.target.value }))}>
                          <option value="">Unassigned</option>
                          {buses.map(b => (
                            <option key={b.id} value={b.id}>{b.id} — {b.name || 'Unnamed'}</option>
                          ))}
                        </select>
                        <button disabled={assigning===d.id} onClick={async ()=>{
                          const busId = assignDraft[d.id] ?? ''
                          setAssigning(d.id)
                          try { await assignDriverToBus(d.id, busId) } catch (e) { alert(e.message || 'Failed to assign') } finally { setAssigning('') }
                        }} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs">Assign</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'bus' && (
        <section className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Bus Settings</h3>
            <div className="text-sm text-gray-600">Total: <span className="font-medium">{buses.length}</span></div>
          </div>
          <div className="mb-3">
            <button
              className="px-2 py-1 border rounded text-sm"
              onClick={()=>{
                setCreating(true)
                setBusForm({ id: '', name: '', driverName: '', driverPhone: '', startTime: '16:30' })
              }}
            >New Bus</button>
          </div>

          {creating && (
            <div className="mb-4 border rounded p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <label className="flex flex-col">
                  <span className="text-gray-600">Bus ID</span>
                  <input className="mt-1 p-2 border rounded" value={busForm.id} onChange={e=>setBusForm(f=>({...f, id:e.target.value}))} placeholder="Enter a unique ID for new bus" />
                </label>
                <label className="flex flex-col">
                  <span className="text-gray-600">Bus Name</span>
                  <input className="mt-1 p-2 border rounded" value={busForm.name} onChange={e=>setBusForm(f=>({...f, name:e.target.value}))} />
                </label>
                {/* Driver details are read-only and assigned via Active Drivers list */}
                <label className="flex flex-col">
                  <span className="text-gray-600">Start Time (HH:mm)</span>
                  <input className="mt-1 p-2 border rounded" value={busForm.startTime} onChange={e=>setBusForm(f=>({...f, startTime:e.target.value}))} />
                </label>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={async ()=>{
                  const id = (busForm.id||'').trim()
                  if (!id) return
                  if (buses.some(b=>b.id===id)) return
                  await setBusFor(id, { id, name: busForm.name||id, startTime: busForm.startTime||'16:30' })
                  setCreating(false)
                  setBusSaved(true)
                  if (busSaveTimerRef.current) clearTimeout(busSaveTimerRef.current)
                  busSaveTimerRef.current = setTimeout(() => setBusSaved(false), 2500)
                }} className="px-3 py-2 bg-indigo-600 text-white rounded">Save</button>
                <button onClick={()=>{ setCreating(false) }} className="px-3 py-2 border rounded">Cancel</button>
                {busSaved && <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Saved</span>}
                {(!busForm.id || buses.some(b=>b.id===(busForm.id||'').trim())) && (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">{!busForm.id ? 'Bus ID is required' : 'Bus ID already exists'}</span>
                )}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="text-left px-3 py-2">Bus ID</th>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Assigned Driver</th>
                  <th className="text-left px-3 py-2">Start Time</th>
                  <th className="text-left px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {buses.map(b => (
                  <tr key={b.id}>
                    {editingBusId === b.id ? (
                      <>
                        <td className="px-3 py-2"><input className="p-1 border rounded w-40" value={b.id} disabled /></td>
                        <td className="px-3 py-2"><input className="p-1 border rounded w-40" value={busForm.name} onChange={e=>setBusForm(f=>({...f, name:e.target.value}))} /></td>
                        <td className="px-3 py-2 text-gray-600">Assigned via Active Drivers</td>
                        <td className="px-3 py-2"><input className="p-1 border rounded w-28" value={busForm.startTime} onChange={e=>setBusForm(f=>({...f, startTime:e.target.value}))} /></td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button onClick={async ()=>{
                              await setBusFor(b.id, { id: b.id, name: busForm.name, driverName: busForm.driverName, driverPhone: busForm.driverPhone, startTime: busForm.startTime })
                              setEditingBusId('')
                              setSavedBusId(b.id)
                            }} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs">Save</button>
                            <button onClick={()=>{ setEditingBusId('') }} className="px-2 py-1 border rounded text-xs">Cancel</button>
                            {savedBusId === b.id && <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Saved</span>}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 break-all">{b.id}</td>
                        <td className="px-3 py-2 capitalize">{b.name}</td>
                        <td className="px-3 py-2">
                          {(() => {
                            const d = drivers.find(dr => (dr.busNo||'').trim().toLowerCase() === (b.id||'').trim().toLowerCase())
                            if (!d) return <span className="text-gray-500">Unassigned</span>
                            return <span className="capitalize">{d.name}</span>
                          })()}
                        </td>
                        <td className="px-3 py-2">{b.startTime || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button onClick={()=>{ setEditingBusId(b.id); setBusForm({ id: b.id||'', name: b.name||'', startTime: b.startTime||'16:30' }) }} className="px-2 py-1 border rounded text-xs">Edit</button>
                            <button onClick={()=> setBusId(b.id)} className="px-2 py-1 border rounded text-xs">Select for Route</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'route' && (
        <section className="bg-white p-4 rounded shadow">
          <div className="flex items-center gap-3 mb-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-gray-600">Selected Bus</span>
              <select className="p-2 border rounded" value={busId} onChange={e=>{ setBusId(e.target.value); setCreating(false); }}>
                {!buses.length && <option value="">No buses</option>}
                {buses.map(b => (
                  <option key={b.id} value={b.id}>{b.id} — {b.name || 'Unnamed'}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Route Stops</h3>
            <div className="flex items-center gap-2">
              <button onClick={addStop} className="px-2 py-1 border rounded text-sm">Add Stop</button>
              <button onClick={saveStops} className="px-2 py-1 bg-indigo-600 text-white rounded text-sm">Save Stops</button>
              {stopsSaved && <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Saved</span>}
            </div>
          </div>
          {/* Unified place/PIN/area/STD search helper */
          }
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="border rounded p-3">
              <div className="text-sm font-medium mb-2">Add stop by searching place / PIN / area / STD</div>
              <input
                className="w-full p-2 border rounded text-sm"
                value={q}
                onChange={e=>setQ(e.target.value)}
                placeholder="Type a village/city/landmark or PIN/STD code (min 3 chars)"
              />
              <div className="mt-2 text-xs text-gray-600">{searching ? 'Searching…' : (suggestions.length ? 'Select a suggestion to preview on map' : (q.length>=3 ? 'No suggestions' : ''))}</div>
              {suggestions.length > 0 && (
                <ul className="mt-2 max-h-48 overflow-auto border rounded divide-y">
                  {suggestions.map((sug, idx) => (
                    <li key={idx} className="p-2 hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(sug)}>
                      <div className="text-sm">{sug.display_name}</div>
                      <div className="text-xs text-gray-500">{parseFloat(sug.lat).toFixed(5)}, {parseFloat(sug.lon).toFixed(5)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border rounded p-3">
              <div className="text-sm font-medium mb-2">Preview & confirm</div>
              {!selected ? (
                <div className="text-sm text-gray-600">Pick a suggestion to preview here.</div>
              ) : (
                <>
                  <div className="text-sm mb-2 break-words">{selected.display_name}</div>
                  <div className="h-64 w-full rounded overflow-hidden">
                    <MapContainer center={mapPos || [parseFloat(selected.lat), parseFloat(selected.lon)]} zoom={14} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                      {mapPos && (
                        <Marker
                          position={mapPos}
                          draggable
                          eventHandlers={{
                            dragend: async (e) => {
                              const p = e.target.getLatLng()
                              const lat = p.lat, lon = p.lng
                              setMapPos([lat, lon])
                              // Update name to village/city only and compute auto offset
                              try {
                                const nm = await reverseGeocodeName(lat, lon)
                                setStopName(nm)
                              } catch {}
                              try {
                                await computeAndSetAutoOffset(lat, lon)
                              } catch {}
                            }
                          }}
                        />
                      )}
                    </MapContainer>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-center text-sm">
                    <label className="flex flex-col md:col-span-2">
                      <span className="text-gray-600">Stop name</span>
                      <input className="mt-1 p-2 border rounded" value={stopName} onChange={e=>setStopName(e.target.value)} placeholder="e.g., Kantepudi" />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-gray-600">Offset (minutes)</span>
                      <input className="mt-1 p-2 border rounded" value={offset} onChange={e=>setOffset(e.target.value)} />
                    </label>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                    <div>Tip: drag the marker to the exact stop location before confirming.</div>
                    <button onClick={confirmAddFromSelected} className="px-2 py-2 bg-emerald-600 text-white rounded">Confirm</button>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Removed extra click-to-add map; use draggable marker in preview above */}

          {/* Auto arrange by road */}
          <div className="mb-4 flex items-end gap-3">
            <label className="flex flex-col text-sm">
              <span className="text-gray-600">Avg speed (km/h)</span>
              <input className="mt-1 p-2 border rounded w-36" value={avgSpeed} onChange={e=>setAvgSpeed(e.target.value)} />
            </label>
            <button onClick={autoArrangeByRoad} className="px-3 py-2 bg-blue-600 text-white rounded">Auto Arrange by Road</button>
            <div className="text-xs text-gray-600">Sorts stops along the real road corridor and recalculates offsets.</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Latitude</th>
                  <th className="text-left px-3 py-2">Longitude</th>
                  <th className="text-left px-3 py-2">Offset (min)</th>
                  <th className="text-left px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stops.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>No stops for this bus yet. Use the search above to add stops.</td>
                  </tr>
                ) : (
                  stops.map((s, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <input className="p-1 border rounded w-48" value={s.name} onChange={e=>updateStop(i,{ name:e.target.value })} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="p-1 border rounded w-32" value={s.position?.[0] ?? 0} onChange={e=>updateStop(i,{ position:[parseFloat(e.target.value)||0, s.position?.[1]??0] })} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="p-1 border rounded w-32" value={s.position?.[1] ?? 0} onChange={e=>updateStop(i,{ position:[s.position?.[0]??0, parseFloat(e.target.value)||0] })} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="p-1 border rounded w-24" value={s.plannedOffsetMins ?? 0} onChange={e=>updateStop(i,{ plannedOffsetMins: parseInt(e.target.value,10)||0 })} />
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => deleteStop(i)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'app' && (
        <section className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-3">App Settings (Download page)</h3>
          <AppSettingsBody />
        </section>
      )}
    </div>
  )
}

// separate component for clarity; function declarations are hoisted
function AppSettingsBody(){
  const [form, setForm] = useState({ version: 'v1.0.0', size: '~12 MB', directUrl: 'https://www.upload-apk.com/en/T1VCNGKtl3b4MYy' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    const off = onAppConfig((cfg) => setForm({ version: cfg.version || '', size: cfg.size || '', directUrl: cfg.directUrl || '' }))
    return () => { if (timerRef.current) clearTimeout(timerRef.current); try { off && off() } catch {} }
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await setAppConfig({ version: (form.version||'').trim(), size: (form.size||'').trim(), directUrl: (form.directUrl||'').trim() })
      setSaved(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      alert(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col text-sm">
          <span className="text-gray-600">Latest Version</span>
          <input className="mt-1 p-2 border rounded" value={form.version} onChange={e=>setForm(f=>({ ...f, version: e.target.value }))} placeholder="e.g., v1.1.0" />
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-gray-600">APK Size</span>
          <input className="mt-1 p-2 border rounded" value={form.size} onChange={e=>setForm(f=>({ ...f, size: e.target.value }))} placeholder="e.g., ~14 MB" />
        </label>
        <label className="flex flex-col text-sm md:col-span-2">
          <span className="text-gray-600">Mobile Fallback Direct Link</span>
          <input className="mt-1 p-2 border rounded" value={form.directUrl} onChange={e=>setForm(f=>({ ...f, directUrl: e.target.value }))} placeholder="https://..." />
          <span className="text-xs text-gray-500 mt-1">Shown on mobile if the button fails. Opens in a new tab.</span>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={save} disabled={saving} className="px-3 py-2 bg-indigo-600 text-white rounded">{saving ? 'Saving…' : 'Save'}</button>
        {saved && <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Saved</span>}
      </div>
    </div>
  )
}
