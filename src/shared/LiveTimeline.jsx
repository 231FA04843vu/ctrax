import React, { useEffect, useMemo, useRef, useState } from 'react'
import { buildRouteForNow, getProgress, haversineKm } from '../utils/routeLogic'
import { formatMinutes } from '../utils/format'
import { getBus, onBus } from '../utils/busData'

export default function LiveTimeline(){
  const [bus, setBus] = useState(getBus())
  const sharing = bus.sharing ?? false
  const [speed, setSpeed] = useState(bus.speedKmph ?? 30)
  useEffect(() => {
    const off = onBus(setBus)
    return off
  }, [])
  const routeNow = useMemo(() => buildRouteForNow(), [])
  const ordered = routeNow.orderedStops
  // For timeline rows, exclude the very first origin if present and any terminal vignan (morning)
  const timelineStops = routeNow.timeline

  // Randomize speed every 30s between 10 and 60 km/h
  useEffect(() => {
    const tick = () => setSpeed(10 + Math.floor(Math.random() * 51))
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  const fmtIST = (date) => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(date)
  const todayAt = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d
  }

  const startPlanned = todayAt(routeNow.startTime)
  const now = new Date()
  const rows = timelineStops.map((s, i) => {
    const distanceKm = haversineKm(bus.position, s.position)
    const etaMins = Math.max(0, Math.round((distanceKm / speed) * 60))
    const estArrival = new Date(now.getTime() + etaMins * 60000)
    const planned = new Date(startPlanned.getTime() + (s.plannedOffsetMins ?? 0) * 60000)
    // Apply same recovery and clamp logic so ETA is within ±15 of planned
    const rawDelay = Math.round((estArrival.getTime() - planned.getTime()) / 60000)
    const recovery = Math.max(0.4, 1 - i * 0.18)
    const adjusted = Math.round(rawDelay * recovery)
    const delayMin = Math.max(-15, Math.min(15, adjusted))
    const displayETA = new Date(planned.getTime() + delayMin * 60000)

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
  const prelim = getProgress(bus.position, ordered)
  const nearestIdx = prelim.arrivedIdx
  const ARRIVAL_RADIUS_KM = 0.08 // ~80 meters
  const distToNearest = haversineKm(bus.position, ordered[nearestIdx]?.position || ordered[0]?.position)
  const arrivedIdx = distToNearest <= ARRIVAL_RADIUS_KM ? nearestIdx : Math.max(0, nearestIdx - 1)
  const nextIdx = Math.min(arrivedIdx + 1, ordered.length - 1)
  const arrivedName = ordered[arrivedIdx]?.name
  const startName = ordered[0]?.name
  const nextName = ordered[nextIdx]?.name
  const nextPos = ordered[nextIdx]?.position
  const distToNext = Math.round(haversineKm(bus.position, nextPos || ordered[ordered.length - 1].position))

  // Robust departure tracking: mark the moment we leave a stop and show 'left ... ago' from a timestamp
  const arrivedPos = ordered[arrivedIdx]?.position || ordered[0]?.position
  const distFromArrivedKm = haversineKm(bus.position, arrivedPos)
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

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Live timeline</div>
        {sharing ? (
          <div className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded">
            {arrivedIdx === 0 ? (
              hasLeftArrived ? (
                <>
                  Left <span className="capitalize font-semibold">{startName}</span> {leftLabel || 'just now'}, Next stop <span className="capitalize font-semibold">{nextName}</span> — {`${distToNext} km`}
                </>
              ) : (
                <>
                  Started at <span className="capitalize font-semibold">{startName}</span>, Next stop <span className="capitalize font-semibold">{nextName}</span> — {`${distToNext} km`}
                </>
              )
            ) : (
              <>
                Arrived <span className="capitalize font-semibold">{arrivedName}</span>, Next stop <span className="capitalize font-semibold">{nextName}</span> — {`${distToNext} km`}
                {hasLeftArrived && <> • left {leftLabel || 'just now'}</>}
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
          <div className="flex items-center gap-8">
            {rows.map((r, idx) => {
              const isCurrent = r.name === arrivedName
              return (
                <div key={idx} className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full border ${isCurrent ? 'bg-blue-600 border-blue-600' : 'bg-white border-blue-300'}`} />
                  <div className={`h-1 w-24 mt-2 ${sharing ? 'bg-blue-200' : 'bg-gray-300'}`} />
                  <div className="mt-2 text-xs text-center">
                    <div className="capitalize font-medium">{r.name}</div>
                    <div className="text-gray-600">Planned {r.planned}</div>
                    <div className={`${sharing ? 'text-gray-800' : 'text-gray-400'}`}>ETA {sharing ? r.eta : '—'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bus chip */}
      <div className="mt-3 text-xs">
        {sharing ? (
          <span className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-2 py-1 rounded-full">
            <span className="relative inline-flex">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-500 opacity-75" style={{ animationDuration: `${Math.max(0.6, 60/speed)}s` }}></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M6 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm12 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
              <path fillRule="evenodd" d="M7 3h10a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2v2a1 1 0 1 1-2 0v-2H8v2a1 1 0 0 1-2 0v-2a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3zm10 2H7a1 1 0 0 0-1 1v6h12V6a1 1 0 0 0-1-1z" clipPath="evenodd"/>
            </svg>
            {speed} km/h • {next.distanceKm} km to {next.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 bg-orange-50 text-orange-800 px-2 py-1 rounded-full">
            <span className="relative inline-flex">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            Bus not started
          </span>
        )}
      </div>
    </div>
  )
}
