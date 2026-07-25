import React, { useEffect, useMemo, useRef, useState } from 'react'
import { buildRouteForNow, getProgress, haversineKm } from '../utils/routeLogic'
import { formatMinutes } from '../utils/format'
import { getBusFor, onBusFor } from '../utils/busData'
import { onStopsFor } from '../utils/routeData'
import { getLastGoodPosition } from '../utils/geolocation'

export default function LiveTimeline({ busId = null, highlightStopName = '' }){
  const [bus, setBus] = useState(busId ? (getBusFor(busId) || {}) : {})
  const sharing = bus.sharing ?? false
  // Only use REAL speed from DB — don't fake it with defaults
  const realSpeed = Number(bus?.speedKmph) || 0
  const speed = realSpeed > 0 ? realSpeed : 1 // Fallback for calculations, but showRealETAs will be false if 0
  const [liveTick, setLiveTick] = useState(0)
  useEffect(() => {
    if (!busId) {
      setBus({})
      return undefined
    }
    const off = onBusFor(busId, setBus)
    return off
  }, [busId])
  const [stopsTick, setStopsTick] = useState(0)
  useEffect(() => {
    if (!busId) return undefined
    return onStopsFor(busId, () => setStopsTick(t => t + 1))
  }, [busId])
  const routeNow = useMemo(() => {
    if (!busId) return { orderedStops: [], timeline: [], startTime: '16:30', startPlace: 'Vignan University', phase: 'evening' }
    return buildRouteForNow(busId)
  }, [busId, stopsTick])
  const ordered = routeNow.orderedStops || []
  const originPos = ordered[0]?.position
  // Prefer live bus position from DB; fall back to last good GPS position; then to route origin
  let currentPos = originPos || [0,0]
  if (Array.isArray(bus?.position) && bus.position.length === 2) {
    currentPos = bus.position  // Use live position if available
  } else {
    // Try fallback to last good GPS position
    const lastGood = getLastGoodPosition()
    if (lastGood && lastGood.latitude !== undefined && lastGood.longitude !== undefined) {
      currentPos = [lastGood.latitude, lastGood.longitude]
    }
  }

  // Force-refresh every second so distance/ETA update continuously
  useEffect(() => {
    const id = setInterval(() => setLiveTick((t) => (t + 1) % 1_000_000), 1000)
    return () => clearInterval(id)
  }, [])
  // For timeline rows, exclude the very first origin if present and any terminal vignan (morning)
  const timelineStops = routeNow.timeline

  // Randomization removed — using `bus.speedKmph` from DB (real data)

  const fmtIST = (date) => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(date)
  const todayAt = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d
  }

  const startPlanned = todayAt(routeNow.startTime)
  const now = new Date()
  // Only show real ETAs if we have actual GPS position and real speed from driver
  const hasRealPosition = Array.isArray(bus?.position) && bus.position.length === 2
  const hasRealSpeed = bus?.speedKmph && bus.speedKmph > 0
  const showRealETAs = sharing && hasRealPosition && hasRealSpeed
  
  const rows = timelineStops.map((s, i) => {
    const distanceKm = haversineKm(currentPos, s.position)
    const etaMins = Math.max(0, Math.round((distanceKm / speed) * 60))
    const estArrival = new Date(now.getTime() + etaMins * 60000)
    const planned = new Date(startPlanned.getTime() + (s.plannedOffsetMins ?? 0) * 60000)
    // Show actual real delay without clamping or recovery
    const realDelay = Math.round((estArrival.getTime() - planned.getTime()) / 60000)
    const displayETA = new Date(planned.getTime() + realDelay * 60000)

    return {
      name: s.name,
      eta: fmtIST(displayETA),
      planned: fmtIST(planned),
      etaMins,
      distanceKm: Math.round(distanceKm)
    }
  })

  // Determine next and arrived along the ordered route
  // Compute arrived/next with an arrival radius so the dot only turns blue when actually at the stop
  const prelim = getProgress(currentPos, ordered)
  const nearestIdx = prelim.arrivedIdx
  const ARRIVAL_RADIUS_KM = 0.08 // ~80 meters
  const distToNearest = haversineKm(currentPos, ordered[nearestIdx]?.position || ordered[0]?.position)
  const arrivedIdx = distToNearest <= ARRIVAL_RADIUS_KM ? nearestIdx : Math.max(0, nearestIdx - 1)
  const nextIdx = Math.min(arrivedIdx + 1, ordered.length - 1)
  const arrivedName = ordered[arrivedIdx]?.name
  const startName = ordered[0]?.name
  const nextName = ordered[nextIdx]?.name
  const nextPos = ordered[nextIdx]?.position
  const distToNext = Math.round(haversineKm(currentPos, nextPos || ordered[ordered.length - 1]?.position || originPos || currentPos))
  
  // If bus is far from the nearest route stop, show it as "en route" or show coordinates
  const isAtRouteStop = distToNearest <= ARRIVAL_RADIUS_KM
  const nearestStopName = ordered[nearestIdx]?.name || startName
  const distToNearestKm = Math.round(distToNearest * 10) / 10
  
  // Current location display logic
  let currentLocationDisplay = arrivedName || startName
  if (!isAtRouteStop && distToNearestKm > 0.5) {
    // Far from any route stop - show as en route
    currentLocationDisplay = `${distToNearestKm} km from ${nearestStopName}`
  } else if (!isAtRouteStop) {
    // Near but not at stop
    currentLocationDisplay = `near ${nearestStopName}`
  }

  // Robust departure tracking: mark the moment we leave a stop and show 'left ... ago' from a timestamp
  const arrivedPos = ordered[arrivedIdx]?.position || ordered[0]?.position || originPos || currentPos
  const distFromArrivedKm = haversineKm(currentPos, arrivedPos)
  const LEFT_THRESHOLD_KM = 0.1 // ~100 meters to consider it "left"
  const hasLeftArrived = distFromArrivedKm > LEFT_THRESHOLD_KM
  const lastDepartedAtRef = useRef(null)
  const lastDepartedIdxRef = useRef(null)
  const prevHasLeftRef = useRef(false)
  const prevArrivedIdxRef = useRef(arrivedIdx)

  useEffect(() => {
    const prevHasLeft = prevHasLeftRef.current
    const prevIdx = prevArrivedIdxRef.current
    // Edge 1: transitioned from at-stop to left-stop for this arrivedIdx
    if (!prevHasLeft && hasLeftArrived) {
      lastDepartedAtRef.current = new Date()
      lastDepartedIdxRef.current = arrivedIdx
    }
    // Edge 2: arrived to a new stop (within radius again) -> reset 'hasLeft' detection
    if (arrivedIdx !== prevIdx) {
      prevHasLeftRef.current = false
      prevArrivedIdxRef.current = arrivedIdx
      return
    }
    // Update flag for next cycle
    prevHasLeftRef.current = hasLeftArrived
  }, [arrivedIdx, hasLeftArrived])

  // Humanized left-ago from timestamp (fallback to distance-based if missing)
  let leftLabel = null
  if (hasLeftArrived) {
    if (lastDepartedAtRef.current && lastDepartedIdxRef.current === arrivedIdx) {
      const mins = Math.max(0, Math.round((Date.now() - lastDepartedAtRef.current.getTime()) / 60000))
      leftLabel = mins <= 0 ? 'just now' : `${formatMinutes(mins)} ago`
    } else {
      // Fallback to approximate when timestamp not yet captured
      const approxMins = speed > 0 ? Math.round((distFromArrivedKm / speed) * 60) : 0
      leftLabel = approxMins <= 0 ? 'just now' : `${formatMinutes(approxMins)} ago`
    }
  }

  // Find timeline entry matching nextName for highlighting
  const nextRowIdx = rows.findIndex(r => r.name === nextName)
  const next = nextRowIdx >= 0 ? rows[nextRowIdx] : rows[rows.length - 1]
  const nextEtaMin = Math.max(0, next?.etaMins ?? 0)
  const nextDistKm = Math.max(0, next?.distanceKm ?? 0)

  // Track how long bus has been at current location (for idle detection)
  const lastMoveTimeRef = useRef(Date.now())
  const lastPosRef = useRef(currentPos)
  useEffect(() => {
    const currentPosStr = JSON.stringify(currentPos)
    const lastPosStr = JSON.stringify(lastPosRef.current)
    if (currentPosStr !== lastPosStr) {
      lastMoveTimeRef.current = Date.now()
      lastPosRef.current = currentPos
    }
  }, [currentPos])
  
  // Calculate idle time
  const idleMins = Math.round((Date.now() - lastMoveTimeRef.current) / 60000)
  const isIdle = realSpeed === 0 || !hasRealSpeed

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Live timeline</div>
        {sharing && showRealETAs && isIdle ? (
          // Idle: "Bus idle since X mins at [location] • Y km for next stop ([name])"
          <div className="text-xs bg-amber-50 text-amber-800 px-2 py-1 rounded">
            Bus idle since {idleMins > 0 ? formatMinutes(idleMins) : '0 min'} at <span className="capitalize font-semibold">{currentLocationDisplay}</span> • {nextDistKm} km for next stop (<span className="capitalize font-semibold">{nextName}</span>)
          </div>
        ) : sharing && showRealETAs && hasLeftArrived ? (
          // Moving after leaving: "Left X mins ago at [location] • Y km to [next stop]"
          <div className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded">
            Left {leftLabel || 'just now'} at <span className="capitalize font-semibold">{arrivedName || startName}</span> • {nextDistKm} km to <span className="capitalize font-semibold">{nextName}</span>
          </div>
        ) : sharing && showRealETAs ? (
          // Moving but hasn't left yet: "Next stop [name] — X min • Y km"
          <div className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded">
            Next stop <span className="capitalize font-semibold">{nextName}</span> — {nextEtaMin} min • {nextDistKm} km
          </div>
        ) : sharing && !showRealETAs ? (
          // Sharing started but no real GPS/speed yet
          <div className="text-xs bg-gray-50 text-gray-700 px-2 py-1 rounded border border-gray-200">
            Bus at <span className="capitalize font-semibold">{currentLocationDisplay}</span> • {nextDistKm} km to <span className="capitalize font-semibold">{nextName}</span>
          </div>
        ) : (
          <div className="text-xs bg-orange-50 text-orange-800 px-2 py-1 rounded">
            Waiting for the bus to start for updates • Planned start: <span className="capitalize font-semibold">{routeNow.startPlace}</span> — {fmtIST(todayAt(routeNow.startTime))}
          </div>
        )}
      </div>

      {/* Horizontal timeline */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div className="flex items-center gap-8">
            {rows.map((r, idx) => {
              const norm = (v) => String(v || '').trim().toLowerCase()
              const isCurrent = r.name === arrivedName
              const isMine = norm(r.name) === norm(highlightStopName)
              return (
                <div key={idx} className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full border ${isMine ? 'bg-purple-600 border-purple-600' : (isCurrent ? 'bg-blue-600 border-blue-600' : 'bg-white border-blue-300')}`} />
                  <div className={`h-1 w-24 mt-2 ${sharing ? 'bg-blue-200' : 'bg-gray-300'}`} />
                  <div className="mt-2 text-xs text-center">
                    <div className="capitalize font-medium">{r.name} {isMine && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 align-middle">Your stop</span>}</div>
                    <div className="text-gray-600">Planned {r.planned}</div>
                    <div className={`${sharing ? 'text-gray-800' : 'text-gray-400'}`}>ETA {sharing ? r.eta : '—'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
