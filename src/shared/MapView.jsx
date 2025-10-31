
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { buildRouteForNow, haversineKm } from '../utils/routeLogic'
import { onStopsFor, onStops } from '../utils/routeData'
import { getBus, onBus, getBusFor, onBusFor, setPosition, setPositionFor, setSimFor } from '../utils/busData'
import { computeSimulatedPos } from '../utils/sim'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

function FlyTo({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.setView(position, 14, { animate: true })
  }, [position])
  return null
}

// Keep the map focused on the route area: fit to bounds and constrain pan/zoom
function BoundsController({ points }){
  const map = useMap()
  useEffect(() => {
    if (!points || points.length < 2) return
    try {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])))
      // Fit to route with padding and limit panning outside padded bounds
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
      map.setMaxBounds(bounds.pad(0.25))
      const minZ = map.getBoundsZoom(bounds, true)
      if (typeof minZ === 'number' && isFinite(minZ)) map.setMinZoom(minZ)
    } catch {}
  }, [points, map])
  return null
}

// simple lerp helper
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

// bus icon (white bus on blue circle)
const busIcon = L.divIcon({
  className: '',
  html: `
    <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:#2563eb;box-shadow:0 1px 4px rgba(0,0,0,0.3)">
      <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='white'>
        <path d='M6 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm12 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'/>
        <path fill-rule='evenodd' d='M7 3h10a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2v2a1 1 0 1 1-2 0v-2H8v2a1 1 0 0 1-2 0v-2a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3zm10 2H7a1 1 0 0 0-1 1v6h12V6a1 1 0 0 0-1-1z' clip-rule='evenodd'/>
      </svg>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
})

// stop icons (start/mid/end) as clean circular badges: start=play, mid=dot, end=stop
const stopIcon = (variant = 'mid') => {
  const color = variant === 'start' ? '#16a34a' : variant === 'end' ? '#dc2626' : '#2563eb'
  const inner = variant === 'start'
    ? "<polygon points='10,7 17,12 10,17' fill='white'/>" // play
    : variant === 'end'
      ? "<rect x='9' y='9' width='6' height='6' rx='1.5' fill='white'/>" // stop
      : "<circle cx='12' cy='12' r='3' fill='white'/>" // dot
  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4))">
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='32' height='32'>
          <circle cx='12' cy='12' r='10' fill='${color}' />
          <circle cx='12' cy='12' r='10' fill='none' stroke='white' stroke-width='1.5' opacity='0.85' />
          ${inner}
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
}

export default function MapView({ role = 'student', sharing = false, busId = null, highlightStopName = '' }) {

// Special icon for the student's own stop
const myStopIcon = () => L.divIcon({
  className: '',
  html: `
    <div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4))">
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='36' height='36'>
        <circle cx='12' cy='12' r='10' fill='#7c3aed' />
        <circle cx='12' cy='12' r='10' fill='none' stroke='white' stroke-width='2' opacity='0.95' />
        <path d='M10 16l-3-3 1.4-1.4L10 13.2l5.6-5.6L17 9l-7 7z' fill='white'/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
})
  const [bus, setBus] = useState(busId ? (getBusFor(busId) || {}) : getBus())
  const [stopsTick, setStopsTick] = useState(0)
  useEffect(() => {
    if (busId) {
      const off = onBusFor(busId, setBus)
      // also subscribe to per-bus stops to refresh route when they arrive/change
      const offStops = onStopsFor(busId, () => setStopsTick(t => t + 1))
      return () => { off(); offStops() }
    }
    const off = onBus(setBus)
    const offGlobalStops = onStops(() => setStopsTick(t => t + 1))
    return () => { off(); offGlobalStops() }
  }, [busId])
  const routeNow = useMemo(() => buildRouteForNow(busId || null), [busId, stopsTick])
  const orderedStops = useMemo(() => routeNow.orderedStops.map(s => s.position), [routeNow])

  const [routePoints, setRoutePoints] = useState(orderedStops)
  const [pos, setPos] = useState(orderedStops[0])
  const [center, setCenter] = useState(orderedStops[0])
  const segIndexRef = useRef(0)
  const segTRef = useRef(0)
  const speedRef = useRef(bus.speedKmph ?? 30)
  const dirRef = useRef(1) // 1 forward, -1 backward for continuous simulation
  const startMarkerRef = useRef(null)
  const endMarkerRef = useRef(null)
  const simTickRef = useRef(null)

  // Densify a path so animation looks smoother when falling back to straight segments
  const densifyByKm = (pts, stepKm = 0.12) => {
    if (!pts || pts.length < 2) return pts || []
    const out = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++){
      const a = pts[i]
      const b = pts[i+1]
      const d = Math.max(0.001, haversineKm(a,b))
      const steps = Math.max(1, Math.ceil(d / stepKm))
      for (let s = 1; s <= steps; s++){
        const t = s / steps
        out.push(lerp(a, b, t))
      }
    }
    return out
  }

  // Try to fetch a real road-following route via OSRM. Fallback to straight-line interpolation.
  useEffect(() => {
    let cancelled = false
    async function build() {
      try {
        if (!orderedStops || orderedStops.length < 2) {
          // Not enough points to request OSRM; just use given points
          const pts = orderedStops.length ? [orderedStops[0]] : []
          if (!cancelled){
            setRoutePoints(orderedStops)
            setPos(orderedStops[0])
            setCenter(orderedStops[0])
            if (role === 'driver' && busId) {
              try { setPositionFor(busId, orderedStops[0]) } catch {}
            } else if (role === 'driver') {
              try { setPosition(orderedStops[0]) } catch {}
            }
            segIndexRef.current = 0
            segTRef.current = 0
            dirRef.current = 1
          }
          return
        }
        const coordsParam = orderedStops.map(([lat,lng]) => `${lng},${lat}`).join(';')
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&steps=false&continue_straight=true`
        const res = await fetch(url)
        if (!res.ok) throw new Error('OSRM request failed')
        const data = await res.json()
        const coords = data?.routes?.[0]?.geometry?.coordinates
        if (!coords || !coords.length) throw new Error('No geometry')
        const pts = coords.map(([lng, lat]) => [lat, lng])
        if (!cancelled){
          setRoutePoints(pts)
          setPos(pts[0])
          setCenter(pts[0])
          if (role === 'driver') {
            if (busId) {
              try { setPositionFor(busId, pts[0]) } catch {}
            } else {
              try { setPosition(pts[0]) } catch {}
            }
          }
          segIndexRef.current = 0
          segTRef.current = 0
          dirRef.current = 1
        }
      } catch (e) {
        const fallback = densifyByKm(orderedStops)
        if (!cancelled){
          setRoutePoints(fallback)
          setPos(fallback[0])
          setCenter(fallback[0])
          if (role === 'driver') {
            if (busId) {
              try { setPositionFor(busId, fallback[0]) } catch {}
            } else {
              try { setPosition(fallback[0]) } catch {}
            }
          }
          segIndexRef.current = 0
          segTRef.current = 0
          dirRef.current = 1
        }
      }
    }
    build()
    return () => { cancelled = true }
  }, [orderedStops])

  // Show one-time hints for Start and Destination popups on first view
  useEffect(() => {
    try {
      if (sessionStorage.getItem('mapStartEndHintsShown') === '1') return
    } catch {}
    const t1 = setTimeout(() => {
      try { startMarkerRef.current && startMarkerRef.current.openPopup() } catch {}
    }, 600)
    const t2 = setTimeout(() => {
      try { startMarkerRef.current && startMarkerRef.current.closePopup() } catch {}
    }, 2800)
    const t3 = setTimeout(() => {
      try { endMarkerRef.current && endMarkerRef.current.openPopup() } catch {}
    }, 1000)
    const t4 = setTimeout(() => {
      try { endMarkerRef.current && endMarkerRef.current.closePopup() } catch {}
      try { sessionStorage.setItem('mapStartEndHintsShown', '1') } catch {}
    }, 3200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  // (Removed local random speed loop) — speed is now driven by DB sim for consistency across views

  // DB-driven continuous simulation: compute position from sim params periodically
  useEffect(() => {
    if (!routePoints || routePoints.length < 1) return
    // initialize to first point for visual stability
    setPos(routePoints[0])
    setCenter(routePoints[0])
    const stepMs = 1000
    const tick = () => {
      const sim = (bus && bus.sim) || null
      const p = computeSimulatedPos(sim, routePoints) || routePoints[0]
      setPos(p)
      setCenter(p)
    }
    tick()
    const id = setInterval(tick, stepMs)
    simTickRef.current = id
    return () => { clearInterval(id); simTickRef.current = null }
  }, [routePoints, bus?.sim])

  // Start/pause simulation from sharing toggles (driver prop or bus.sharing)
  useEffect(() => {
    if (!busId && !bus?.id) return
    const id = busId || bus.id
    const sim = bus?.sim || {}
    // desired active if driver role uses prop 'sharing', else use bus.sharing from DB
    const desiredActive = (role === 'driver') ? !!sharing : !!(bus.sharing)
    if (desiredActive) {
      if (sim.active) return // already running
      const patch = {
        active: true,
        speedKmph: sim.speedKmph || bus.speedKmph || 30,
        dir: sim.dir ?? 1,
        mode: sim.mode || 'bounce',
        lastUpdateAt: Date.now(),
        offsetKm: typeof sim.offsetKm === 'number' ? sim.offsetKm : 0,
      }
      try { setSimFor(id, patch) } catch {}
    } else {
      if (!sim.active) return // already paused
      const speed = Number(sim.speedKmph) || Number(bus.speedKmph) || 30
      const dir = sim.dir === -1 ? -1 : 1
      const last = Number(sim.lastUpdateAt) || Date.now()
      const dtH = Math.max(0, (Date.now() - last) / 3600000)
      const travelKm = (Number(sim.offsetKm) || 0) + dir * speed * dtH
      const patch = {
        active: false,
        offsetKm: travelKm,
        lastUpdateAt: Date.now(),
      }
      try { setSimFor(id, patch) } catch {}
    }
  }, [sharing, role, busId, bus?.id, bus?.sim?.active, bus?.sim?.offsetKm, bus?.sim?.speedKmph, bus?.sim?.dir, bus?.sim?.lastUpdateAt, bus?.sharing, bus?.speedKmph])

  // Position for non-driver roles is handled by the sim tick above

  // Prefer constraining view to the full polyline when we have at least 2 points
  const boundsPoints = useMemo(() => {
    if (routePoints && routePoints.length >= 2) return routePoints
    if (orderedStops && orderedStops.length >= 2) return orderedStops
    return null
  }, [routePoints, orderedStops])

  return (
    <MapContainer center={center} zoom={13} style={{ height: '460px', width: '100%' }} maxBoundsViscosity={1}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {boundsPoints && <BoundsController points={boundsPoints} />}
      {/* Live bus marker */}
      <Marker position={pos} icon={busIcon}>
        <Popup>
          {bus.name} — {bus.route}
        </Popup>
      </Marker>

      {routeNow.orderedStops.map((s, i) => {
        const norm = (v) => String(v || '').trim().toLowerCase()
        const isMine = norm(s.name) === norm(highlightStopName)
        const variant = i === 0 ? 'start' : (i === routeNow.orderedStops.length - 1 ? 'end' : 'mid')
        return (
        <Marker
          key={`${s.name}-${i}`}
          position={s.position}
            icon={isMine ? myStopIcon() : stopIcon(variant)}
          ref={i === 0 ? startMarkerRef : (i === routeNow.orderedStops.length - 1 ? endMarkerRef : null)}
        >
          <Popup>
            <div className="capitalize font-semibold">{s.name}</div>
              <div className="text-xs text-gray-700">{isMine ? 'Your stop' : (i === 0 ? 'Start' : (i === routeNow.orderedStops.length - 1 ? 'Destination' : 'Stop'))}</div>
          </Popup>
        </Marker>
        )
  })}

      <Polyline positions={routePoints} />
      <FlyTo position={center} />
    </MapContainer>
  )
}
