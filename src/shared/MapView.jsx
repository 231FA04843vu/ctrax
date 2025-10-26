
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { buildRouteForNow, haversineKm } from '../utils/routeLogic'
import { getBus, onBus, setPosition } from '../utils/busData'

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

export default function MapView({ role = 'student', sharing = false }) {
  const [bus, setBus] = useState(getBus())
  useEffect(() => {
    const off = onBus(setBus)
    return off
  }, [])
  const routeNow = useMemo(() => buildRouteForNow(), [])
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
            try { setPosition(pts[0]) } catch {}
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
            try { setPosition(fallback[0]) } catch {}
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

  // change speed every 30s to keep map movement lively
  useEffect(() => {
    const id = setInterval(() => {
      speedRef.current = 10 + Math.floor(Math.random() * 51)
    }, 30000)
    return () => clearInterval(id)
  }, [])

  // movement along the polyline every 3 seconds
  useEffect(() => {
    if (!routePoints || routePoints.length < 2) return
    // ensure we start exactly at the origin of the selected route
    setPos(routePoints[0])
    setCenter(routePoints[0])
    if (role === 'driver') {
      try { setPosition(routePoints[0]) } catch {}
    }
    segIndexRef.current = 0
    segTRef.current = 0
    dirRef.current = 1
    const stepMs = 3000
    const move = () => {
      const canMove = role === 'driver' ? sharing : (bus.sharing ?? false)
      if (!canMove) return
      let i = segIndexRef.current
      const dir = dirRef.current
      // determine current segment endpoints based on direction
      const nextIndex = i + (dir > 0 ? 1 : -1)
      if (nextIndex < 0 || nextIndex >= routePoints.length) {
        // bounce
        dirRef.current = -dir
        return
      }
      const a = routePoints[i]
      const b = routePoints[nextIndex]
      const segKm = Math.max(0.001, haversineKm(a, b))
      const kmThisTick = (speedRef.current / 3600) * (stepMs / 1000)
      const dt = kmThisTick / segKm
      let t = segTRef.current + dt
      let idx = i
      let currentA = a
      let currentB = b
      while (t >= 1) {
        t -= 1
        const nextIdx = idx + (dirRef.current > 0 ? 1 : -1)
        if (nextIdx < 0 || nextIdx >= routePoints.length) {
          // flip and clamp
          dirRef.current = -dirRef.current
          break
        }
        idx = nextIdx
        const ni = idx + (dirRef.current > 0 ? 1 : -1)
        currentA = routePoints[idx]
        currentB = routePoints[ni] || routePoints[idx]
      }
      segIndexRef.current = idx
      segTRef.current = t
      const p = lerp(currentA, currentB, t)
      setPos(p)
      setCenter(p)
      if (role === 'driver') {
        try { setPosition(p) } catch {}
      }
    }
    const id = setInterval(move, stepMs)
    return () => clearInterval(id)
  }, [routePoints, sharing, bus.sharing, role])

  // For non-driver roles, follow DB-updated position
  useEffect(() => {
    if (role === 'driver') return
    const p = Array.isArray(bus.position) ? bus.position : orderedStops[0]
    setPos(p)
    setCenter(p)
  }, [bus.position, role])

  return (
    <MapContainer center={center} zoom={13} style={{ height: '400px', width: '100%' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* Live bus marker */}
      <Marker position={pos} icon={busIcon}>
        <Popup>
          {bus.name} — {bus.route}
        </Popup>
      </Marker>

      {routeNow.orderedStops.map((s, i) => (
        <Marker
          key={`${s.name}-${i}`}
          position={s.position}
          icon={stopIcon(i === 0 ? 'start' : (i === routeNow.orderedStops.length - 1 ? 'end' : 'mid'))}
          ref={i === 0 ? startMarkerRef : (i === routeNow.orderedStops.length - 1 ? endMarkerRef : null)}
        >
          <Popup>
            <div className="capitalize font-semibold">{s.name}</div>
            <div className="text-xs text-gray-700">{i === 0 ? 'Start' : (i === routeNow.orderedStops.length - 1 ? 'Destination' : 'Stop')}</div>
          </Popup>
        </Marker>
      ))}

      <Polyline positions={routePoints} />
      <FlyTo position={center} />
    </MapContainer>
  )
}
