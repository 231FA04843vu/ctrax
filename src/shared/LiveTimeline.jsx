import React, { useEffect, useMemo, useRef, useState } from 'react'
import { buildRouteForNow, getProgress, haversineKm } from '../utils/routeLogic'
import { formatMinutes } from '../utils/format'
import { getBusFor, onBusFor } from '../utils/busData'
import { onStopsFor } from '../utils/routeData'
import { getLastGoodPosition } from '../utils/geolocation'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'

export default function LiveTimeline({ busId = null, highlightStopName = '' }){
  const [bus, setBus] = useState(busId ? (getBusFor(busId) || {}) : {})
  const sharing = bus.sharing ?? false
  const realSpeed = Number(bus?.speedKmph) || 0
  const etaCalcSpeed = Math.max(30, realSpeed)
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
    return buildRouteForNow(busId, bus?.phase)
  }, [busId, stopsTick, bus?.phase])
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
  // Show ETAs when we have a real position and sharing is active
  const hasRealPosition = Array.isArray(bus?.position) && bus.position.length === 2
  const showRealETAs = sharing && hasRealPosition
  
  const rows = timelineStops.map((s, i) => {
    const distanceKm = haversineKm(currentPos, s.position)
    const etaMins = Math.max(0, Math.round((distanceKm / etaCalcSpeed) * 60))
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
  // Compute arrived/next with a wider arrival radius (400m) so detours don't miss checkpoints
  const prelim = getProgress(currentPos, ordered)
  const nearestIdx = prelim.arrivedIdx
  const ARRIVAL_RADIUS_KM = 0.4 // ~400 meters
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
  const preciseDistToNext = haversineKm(currentPos, nextPos || arrivedPos)
  let progressRatio = 0
  if (distFromArrivedKm + preciseDistToNext > 0) {
    progressRatio = distFromArrivedKm / (distFromArrivedKm + preciseDistToNext)
  }
  
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
      const approxMins = Math.round((distFromArrivedKm / etaCalcSpeed) * 60)
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
  const isIdle = realSpeed === 0

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Live timeline</div>
        {sharing && showRealETAs && isIdle ? (
          // Idle: "Bus idle since X mins at [location] • Y km for next stop ([name])"
          <div className="text-xs bg-amber-50 text-amber-800 px-2 py-1 rounded">
            Bus {bus.stopReason ? 'stopped' : 'idle'} since {idleMins > 0 ? formatMinutes(idleMins) : '0 min'} at <span className="capitalize font-semibold">{currentLocationDisplay}</span>
            {bus.stopReason && ` due to ${bus.stopReason}`}
            {' '}• {nextDistKm} km for next stop (<span className="capitalize font-semibold">{nextName}</span>)
          </div>
        ) : sharing && showRealETAs && hasLeftArrived ? (
          // Moving after leaving: "Left X mins ago at [location] • Y km to [next stop]"
          <div className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded">
            Left {leftLabel || 'just now'} at <span className="capitalize font-semibold">{arrivedName || startName}</span> • {nextDistKm} km to <span className="capitalize font-semibold">{nextName}</span>
            {bus.trafficDelayMins >= 5 && <span className="text-red-600 font-semibold ml-1">(⚠️ +{bus.trafficDelayMins}m traffic delay ahead)</span>}
          </div>
        ) : sharing && showRealETAs ? (
          // Moving but hasn't left yet: "Next stop [name] — X min • Y km"
          <div className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded">
            Next stop <span className="capitalize font-semibold">{nextName}</span> — {nextEtaMin} min • {nextDistKm} km
            {bus.trafficDelayMins >= 5 && <span className="text-red-600 font-semibold ml-1">(⚠️ +{bus.trafficDelayMins}m traffic delay ahead)</span>}
          </div>
        ) : sharing && !showRealETAs ? (
          // Sharing started but no real GPS/speed yet
          <div className="text-xs bg-gray-50 text-gray-700 px-2 py-1 rounded border border-gray-200">
            Bus at <span className="capitalize font-semibold">{currentLocationDisplay}</span> • {nextDistKm} km to <span className="capitalize font-semibold">{nextName}</span>
          </div>
        ) : !sharing && currentPos && currentPos.length === 2 && currentPos[0] !== 0 ? (
          // Sharing is OFF, but we have a last known position
          <div className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded border border-gray-300">
            {bus.stopReason ? (
              <>Bus stopped near <span className="capitalize font-semibold">{currentLocationDisplay}</span> due to {bus.stopReason}</>
            ) : arrivedName ? (
              <>Bus stopped at <span className="capitalize font-semibold">{arrivedName}</span></>
            ) : (
              <>Bus stopped near <span className="capitalize font-semibold">{currentLocationDisplay}</span> (Check local traffic if delayed)</>
            )}
            {(!bus.stopReason && arrivedIdx === 0) && (
              <>
                {' '}• Planned start: <span className="capitalize font-semibold">{routeNow.startPlace}</span> — {fmtIST(todayAt(routeNow.startTime))}
              </>
            )}
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
          <div className="flex items-start gap-0 pt-4">
            {rows.map((r, idx) => {
              const norm = (v) => String(v || '').trim().toLowerCase()
              const isCurrent = r.name === arrivedName
              const isMine = norm(r.name) === norm(highlightStopName)
              const isFirst = idx === 0
              const isLast = idx === rows.length - 1
              return (
                <div key={idx} className="flex flex-col items-center w-40 relative">
                  {/* The continuous road segment */}
                  <div 
                    className={`absolute top-4 h-4 w-full z-0 bg-gray-700 shadow-inner ${isFirst ? 'rounded-l-md' : ''} ${isLast ? 'rounded-r-md' : ''}`}
                    style={{
                      backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.7) 50%, transparent 50%)',
                      backgroundSize: '16px 2px',
                      backgroundRepeat: 'repeat-x',
                      backgroundPosition: 'center'
                    }}
                  />
                  
                  {/* The Bus Animation & End Icon */}
                  <div className="h-12 flex items-center justify-center z-10 w-full relative">
                    {isCurrent && (
                      <div 
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-[80%] w-24 h-24 filter drop-shadow-md z-20 transition-all duration-1000"
                        style={{ left: `calc(50% + ${progressRatio * 100}%)` }}
                      >
                        <DotLottieReact src="/bus-transport.lottie" loop autoplay />
                      </div>
                    )}
                    {isLast && !isCurrent && (
                      <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-[6px] -rotate-90 w-12 h-10 filter drop-shadow z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" className="w-full h-full">
                          <defs>
                            <pattern id="barricade-stripes" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                              <rect width="12" height="24" fill="#ef4444"/>
                              <rect x="12" width="12" height="24" fill="#f4f4f5"/>
                            </pattern>
                          </defs>
                          <rect x="22" y="10" width="8" height="60" fill="#71717a" stroke="#000" strokeWidth="3" />
                          <rect x="14" y="70" width="24" height="8" fill="#71717a" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
                          <rect x="70" y="10" width="8" height="60" fill="#71717a" stroke="#000" strokeWidth="3" />
                          <rect x="62" y="70" width="24" height="8" fill="#71717a" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
                          <rect x="10" y="30" width="80" height="20" fill="url(#barricade-stripes)" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                    {isFirst && !isCurrent && (
                      <div className="absolute top-1/2 left-0 -translate-y-[70%] w-6 h-10 filter drop-shadow z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80" className="w-full h-full">
                          {/* Post Base */}
                          <path d="M 8 75 L 32 75" stroke="#000000" strokeWidth="6" strokeLinecap="round" />
                          {/* Post */}
                          <rect x="16" y="25" width="8" height="50" fill="#71717a" stroke="#000000" strokeWidth="3" />
                          {/* Sign Background */}
                          <circle cx="20" cy="22" r="16" fill="#22c55e" stroke="#000000" strokeWidth="3" />
                          {/* Go Triangle */}
                          <polygon points="15,14 15,30 27,22" fill="#ffffff" stroke="#000000" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Stop Information */}
                  <div className="mt-2 text-xs text-center z-10 px-2 flex flex-col items-center">
                    <div className="capitalize font-medium leading-tight mb-0.5">{r.name}</div>
                    {isMine && (
                      <span className="inline-block mb-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold whitespace-nowrap">
                        Your stop
                      </span>
                    )}
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
