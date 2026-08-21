
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { buildRouteForNow, haversineKm } from '../utils/routeLogic'
import { onStopsFor } from '../utils/routeData'
import { getBusFor, onBusFor } from '../utils/busData'
import { getLastGoodPosition } from '../utils/geolocation'

const FALLBACK_CENTER = [16.2315471, 80.5526116]

function isValidLatLng(pos) {
  return Array.isArray(pos)
    && pos.length === 2
    && Number.isFinite(Number(pos[0]))
    && Number.isFinite(Number(pos[1]))
}

function toLatLngFromStored(value) {
  if (!value) return null
  const lat = Number(value.latitude)
  const lng = Number(value.longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng]
  return null
}

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

function FlyTo({ position }) {
  const map = useMap()
  const hasFlown = useRef(false)
  useEffect(() => {
    if (isValidLatLng(position) && !hasFlown.current && position !== FALLBACK_CENTER) {
      map.setView(position, 14, { animate: true })
      hasFlown.current = true
    }
  }, [position, map])
  return null
}

// Keep the map focused on the route area: fit to bounds and constrain pan/zoom
function BoundsController({ points }){
  const map = useMap()
  useEffect(() => {
    if (!points || points.length < 2) return
    try {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])))
      // Fit to route with reasonable padding - focus on stops and route
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18, animate: true })
      // Allow slight panning beyond bounds but not too far
      map.setMaxBounds(bounds.pad(0.15))
      // Set reasonable min zoom to see full route
      const minZ = Math.max(10, map.getBoundsZoom(bounds, false))
      if (typeof minZ === 'number' && isFinite(minZ)) {
        map.setMinZoom(minZ)
      }
    } catch (err) {
      console.warn('BoundsController error:', err)
    }
  }, [points, map])
  return null
}

// simple lerp helper
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

// bus icon (Transparent PNG illustration with contour drop shadow)
const getBusIcon = (phase = 'evening') => {
  const imgSrc = phase === 'morning' ? '/bus-2.png' : '/bus_icon.png'
  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:64px;height:64px;transform:translateY(-16px);filter:drop-shadow(0 6px 8px rgba(0,0,0,0.4));">
        <img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;" alt="Bus" />
      </div>
    `,
    iconSize: [64, 64],
    iconAnchor: [32, 48]
  })
}

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

// Special icon for the college (Vignan University)
const collegeIcon = () => L.divIcon({
  className: '',
  html: `
    <div style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;transform:translateY(-12px);filter:drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
      <img src="/college.png" style="width:100%;height:100%;object-fit:contain;" alt="College" />
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 36]
})

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
  const effectiveBusId = String(busId || '').trim()
  const [bus, setBus] = useState(effectiveBusId ? (getBusFor(effectiveBusId) || {}) : {})
  const [stopsTick, setStopsTick] = useState(0)
  useEffect(() => {
    if (effectiveBusId) {
      const off = onBusFor(effectiveBusId, setBus)
      const offStops = onStopsFor(effectiveBusId, () => setStopsTick(t => t + 1))
      return () => { off(); offStops() }
    }
    setBus({})
    return undefined
  }, [effectiveBusId])
  const routeNow = useMemo(() => {
    if (!effectiveBusId) {
      return { orderedStops: [], timeline: [], phase: 'evening', startTime: '16:30', startPlace: '' }
    }
    return buildRouteForNow(effectiveBusId)
  }, [effectiveBusId, stopsTick])
  const orderedStops = useMemo(
    () => (routeNow.orderedStops || []).map(s => s.position).filter(isValidLatLng),
    [routeNow]
  )
  const localGps = useMemo(() => toLatLngFromStored(getLastGoodPosition()), [stopsTick])

  const initialPoint = localGps || orderedStops[0] || FALLBACK_CENTER
  const [routePoints, setRoutePoints] = useState(orderedStops.length ? orderedStops : [initialPoint])
  const [pos, setPos] = useState(initialPoint)
  const [center, setCenter] = useState(initialPoint)
  const segIndexRef = useRef(0)
  const segTRef = useRef(0)
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

  const [liveDeviationPos, setLiveDeviationPos] = useState(null)
  
  // Try to fetch a real road-following route via OSRM. Fallback to straight-line interpolation.
  useEffect(() => {
    let cancelled = false
    async function build() {
      try {
        let stopsToRoute = [...orderedStops]
        
        // Inject learned waypoints from bus to force OSRM to follow driver's habits
        if (bus?.waypoints && Array.isArray(bus.waypoints) && stopsToRoute.length > 2) {
          // insert waypoints in the middle of the route so OSRM routes through them
          const wps = bus.waypoints.filter(w => isValidLatLng(w.position)).map(w => w.position)
          if (wps.length > 0) {
            stopsToRoute = [
              stopsToRoute[0],
              ...wps,
              ...stopsToRoute.slice(1)
            ]
          }
        }

        // If we have a detected deviation, prepend it so the blue line routes from the driver's current spot
        if (liveDeviationPos && stopsToRoute.length > 0) {
          stopsToRoute = [liveDeviationPos, ...stopsToRoute]
        }
        
        if (!stopsToRoute || stopsToRoute.length < 2) {
          const pts = stopsToRoute.length ? [stopsToRoute[0]] : [initialPoint]
          if (!cancelled){
            setRoutePoints(pts)
            setPos(pts[0])
            setCenter(pts[0])
          }
          return
        }
        const coordsParam = stopsToRoute.map(([lat,lng]) => `${lng},${lat}`).join(';')
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&steps=false&continue_straight=true`
        const res = await fetch(url)
        if (!res.ok) throw new Error('OSRM request failed')
        const data = await res.json()
        const coords = data?.routes?.[0]?.geometry?.coordinates
        if (!coords || !coords.length) throw new Error('No geometry')
        const pts = coords.map(([lng, lat]) => [lat, lng])
        if (!cancelled){
          setRoutePoints(pts)
          // Only snap pos/center if we aren't tracking a live moving bus
          if (!isValidLatLng(bus?.position)) {
            setPos(pts[0])
            setCenter(pts[0])
          }
        }
      } catch (e) {
        const fallback = densifyByKm(orderedStops)
          if (!cancelled){
          const safeFallback = (fallback && fallback.length) ? fallback : [FALLBACK_CENTER]
          setRoutePoints(safeFallback)
          if (!isValidLatLng(bus?.position)) {
            setPos(safeFallback[0])
            setCenter(safeFallback[0])
          }
        }
      }
    }
    build()
    return () => { cancelled = true }
  }, [orderedStops, liveDeviationPos]) // Re-run if deviation detected

  // Detect deviation from the rendered routePoints
  useEffect(() => {
    if (!bus?.position || !isValidLatLng(bus.position) || !routePoints || routePoints.length < 2) return
    import('../utils/routeLogic').then(({ distanceToPolylineKm }) => {
      const dist = distanceToPolylineKm(bus.position, routePoints)
      // 100 meters deviation threshold
      if (dist > 0.1) {
        // Only set it once to avoid infinite loops, or if it moved significantly from previous deviation
        setLiveDeviationPos(prev => {
          if (!prev) {
            if (onDeviation) onDeviation(bus.position)
            return bus.position
          }
          const { haversineKm } = require('../utils/routeLogic')
          if (haversineKm(prev, bus.position) > 0.05) {
            if (onDeviation) onDeviation(bus.position)
            return bus.position // Update if moved > 50m since last deviation
          }
          return prev
        })
      }
    })
  }, [bus?.position, routePoints])

  // Show one-time hints for Start and Destination popups on first view
  useEffect(() => {
    try {
      if (sessionStorage.getItem('mapStartEndHintsShown') === '1') return
    } catch (err) {}
    const t1 = setTimeout(() => {
      try { startMarkerRef.current && startMarkerRef.current.openPopup() } catch (err) {}
    }, 600)
    const t2 = setTimeout(() => {
      try { startMarkerRef.current && startMarkerRef.current.closePopup() } catch (err) {}
    }, 2800)
    const t3 = setTimeout(() => {
      try { endMarkerRef.current && endMarkerRef.current.openPopup() } catch (err) {}
    }, 1000)
    const t4 = setTimeout(() => {
      try { endMarkerRef.current && endMarkerRef.current.closePopup() } catch (err) {}
      try { sessionStorage.setItem('mapStartEndHintsShown', '1') } catch (err) {}
    }, 3200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  // (Removed local random speed loop) — speed is now driven by DB sim for consistency across views

  // Use real GPS position when available (bus.position), fallback to start of route
  useEffect(() => {
    if (!routePoints || routePoints.length < 1) return
    // initialize to first point for visual stability
    setPos(routePoints[0] || initialPoint)
    setCenter(routePoints[0] || initialPoint)
    
    const stepMs = 1000
    const tick = () => {
      const liveLocalGps = toLatLngFromStored(getLastGoodPosition())
      // For real GPS tracking: use bus.position if available and valid
      if (isValidLatLng(bus?.position)) {
        setPos(bus.position)
        setCenter(bus.position)
        return
      }
      if (liveLocalGps) {
        setPos(liveLocalGps)
        setCenter(liveLocalGps)
        return
      }
      const fallback = isValidLatLng(routePoints[0]) ? routePoints[0] : FALLBACK_CENTER
      setPos(fallback)
      setCenter(fallback)
    }
    tick()
    const id = setInterval(tick, stepMs)
    simTickRef.current = id
    return () => { clearInterval(id); simTickRef.current = null }
  }, [routePoints, bus?.position])

  // Prefer constraining view to the full polyline when we have at least 2 points
  const boundsPoints = useMemo(() => {
    if (routePoints && routePoints.length >= 2) return routePoints.filter(isValidLatLng)
    if (orderedStops && orderedStops.length >= 2) return orderedStops
    return null
  }, [routePoints, orderedStops])
  const safePolylinePoints = useMemo(
    () => (routePoints || []).filter(isValidLatLng),
    [routePoints]
  )

  const safeCenter = isValidLatLng(center) ? center : FALLBACK_CENTER
  const busPosForPopup = isValidLatLng(bus?.position) ? bus.position : null
  const focusPoints = useMemo(() => {
    return [...safePolylinePoints]
  }, [safePolylinePoints])

  return (
    <div style={{ position: 'relative', width: '100%', height: '500px' }} className="rounded overflow-hidden border border-gray-200">
      <MapContainer center={safeCenter} zoom={13} style={{ height: '100%', width: '100%' }} maxBoundsViscosity={1}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {import.meta.env.VITE_TOMTOM_API_KEY && (
          <TileLayer
            attribution='&copy; TomTom Traffic'
            url={`https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=${import.meta.env.VITE_TOMTOM_API_KEY}`}
            opacity={0.8}
            maxZoom={22}
          />
        )}
        {focusPoints.length >= 2 && <BoundsController points={focusPoints} />}
        {/* Live bus marker - shows driver's current GPS position */}
        {isValidLatLng(pos) && <Marker position={pos} icon={getBusIcon(bus?.phase)} zIndexOffset={2000} riseOnHover>
          <Popup>
            <div className="font-semibold">{bus.name || 'Bus'}</div>
            <div className="text-xs text-gray-700">{bus.route || 'Route'}</div>
            {busPosForPopup && (
              <div className="text-xs text-gray-600 mt-1">
                📍 {Number(busPosForPopup[0]).toFixed(5)}, {Number(busPosForPopup[1]).toFixed(5)}
              </div>
            )}
            {bus?.gpsAccuracy && (
              <div className="text-xs text-gray-600">
                ⌛ Accuracy: {Math.round(bus.gpsAccuracy)}m
              </div>
            )}
          </Popup>
        </Marker>}

        {(routeNow.orderedStops || []).filter(s => isValidLatLng(s.position)).map((s, i, arr) => {
          const norm = (v) => String(v || '').trim().toLowerCase()
          const isMine = norm(s.name) === norm(highlightStopName)
          const isCollege = norm(s.name) === 'vignan university'
          const variant = i === 0 ? 'start' : (i === arr.length - 1 ? 'end' : 'mid')
          return (
          <Marker
            key={`${s.name}-${i}`}
            position={s.position}
            icon={isCollege ? collegeIcon() : (isMine ? myStopIcon() : stopIcon(variant))}
            ref={i === 0 ? startMarkerRef : (i === arr.length - 1 ? endMarkerRef : null)}
          >
            <Popup>
              <div className="capitalize font-semibold">{s.name}</div>
              <div className="text-xs text-gray-700">{isMine ? '✅ Your stop' : (i === 0 ? 'Start' : (i === arr.length - 1 ? 'End' : 'Stop'))}</div>
              <div className="text-xs text-gray-600 mt-1">📍 {s.position[0]?.toFixed(5)}, {s.position[1]?.toFixed(5)}</div>
            </Popup>
          </Marker>
          )
    })}

        {safePolylinePoints.length >= 2 && <Polyline positions={safePolylinePoints} color="#3b82f6" weight={3} opacity={0.7} />}
        <FlyTo position={safeCenter} />
      </MapContainer>
    </div>
  )
}
