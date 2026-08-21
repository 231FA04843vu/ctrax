
import React, { useEffect, useMemo, useState } from 'react'
import { getBusFor, onBusFor } from '../utils/busData'
import { getUsers } from '../utils/auth'
import { formatMinutes } from '../utils/format'
import { buildRouteForNow, haversineKm } from '../utils/routeLogic'
import { onStopsFor } from '../utils/routeData'
import { getLastGoodPosition } from '../utils/geolocation'

export default function BusList({ busId = null, highlightStopName = '' }){
  const [bus, setBus] = useState(busId ? (getBusFor(busId) || {}) : {})
  const sharing = bus.sharing ?? false
  const realSpeed = Number(bus?.speedKmph) || 0
  // Display the real speed on the UI, but for ETA projections, we shouldn't assume the bus will travel the ENTIRE route at a crawling speed (e.g. 9 km/h GPS drift).
  // We use a baseline route average of 30 km/h, unless the bus is currently traveling faster than that.
  const etaCalcSpeed = Math.max(30, realSpeed)
  const [liveTick, setLiveTick] = useState(0)
  const [assignedDriver, setAssignedDriver] = useState(null)

  useEffect(() => {
    if (!busId) {
      setBus({})
      return undefined
    }
    const off = onBusFor(busId, setBus)
    return off
  }, [busId])

  // Force refresh bus data every 2 seconds to catch sharing status changes
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      if (!busId) return
      const freshBus = getBusFor(busId)
      if (freshBus && freshBus.sharing !== sharing) {
        console.log('🔄 Bus sharing status updated:', freshBus.sharing)
        setBus(freshBus)
      }
    }, 2000)
    return () => clearInterval(refreshInterval)
  }, [busId, sharing])

  // Track assigned driver from users cache so name/phone reflect updates everywhere
  useEffect(() => {
    const id = setInterval(() => {
      if (!busId) { setAssignedDriver(null); return }
      try {
        const drivers = getUsers('driver') || []
        const d = drivers.find(x => (x.busNo||'').trim().toLowerCase() === busId.trim().toLowerCase())
        setAssignedDriver(d || null)
      } catch { setAssignedDriver(null) }
    }, 1000)
    return () => clearInterval(id)
  }, [busId])

  // Randomization removed — using `bus.speedKmph` from DB (real data)

  // Live refresh so ETAs and distance update while the bus moves
  useEffect(() => {
    const id = setInterval(() => setLiveTick((t) => (t + 1) % 1_000_000), 1000)
    return () => clearInterval(id)
  }, [])

  // Route selection (morning/evening) and helpers
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
  
  // Log what position and speed we're using for ETA calculations
  useEffect(() => {
    if (sharing) {
      console.log('🚌 BusList ETA calculation:', {
        currentPos,
        etaCalcSpeed,
        realSpeed,
        sharing,
        hasBusPosition: Array.isArray(bus?.position) && bus.position.length === 2,
        busData: { position: bus?.position, sharing: bus?.sharing, speedKmph: bus?.speedKmph }
      })
    }
  }, [sharing, bus?.position, bus?.speedKmph, etaCalcSpeed, realSpeed])
  
  const fmtIST = (date) => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(date)
  const todayAt = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d
  }

  // Dynamic ETA to final stop based on current speed
  const finalStop = ordered[ordered.length - 1]
  const distToFinalKm = haversineKm(currentPos, finalStop?.position || originPos || currentPos)
  const etaFinalMins = Math.max(1, Math.round((distToFinalKm / etaCalcSpeed) * 60))
  const computedBusEta = sharing ? `≈ ${formatMinutes(etaFinalMins)}` : '—'

  // Build per-stop rows: planned vs real ETA from actual GPS position and speed
  const hasRealPosition = Array.isArray(bus?.position) && bus.position.length === 2
  // Show ETAs when we have a real position and sharing is active
  const showRealETAs = sharing && hasRealPosition
  
  const startPlanned = todayAt(routeNow.startTime)
  const now = new Date()
  // Build rows sequentially so delay propagates from previous arrival
  const rows = []
  let prevEtaTime = new Date(now) // start from 'now'
  let prevPos = currentPos
  routeNow.timeline.forEach((s, i) => {
    const distanceKm = haversineKm(prevPos, s.position)
    const travelMins = Math.max(0, Math.round((distanceKm / etaCalcSpeed) * 60))
    const estArrival = new Date(prevEtaTime.getTime() + travelMins * 60000)
    const planned = new Date(startPlanned.getTime() + (s.plannedOffsetMins ?? 0) * 60000)
    const realDelay = Math.round((estArrival.getTime() - planned.getTime()) / 60000)
    const displayETA = new Date(planned.getTime() + realDelay * 60000)
    // Set state for next leg to the actual ETA and this stop's position
    prevEtaTime = displayETA
    prevPos = s.position

    rows.push({
      name: s.name,
      planned: fmtIST(planned),
      eta: fmtIST(displayETA),
      delayMin: realDelay,
      etaMins: travelMins,
      distanceKm: Math.round(distanceKm),
      etaDisplay: showRealETAs ? fmtIST(displayETA) : '—',
      delayDisplay: showRealETAs ? (realDelay === 0 ? 'On time' : (realDelay > 0 ? `+${realDelay} min` : `${realDelay} min`)) : '—'
    })
  })
  const stopRows = rows

  // Determine the next stop (smallest positive ETA)
  const futureStops = stopRows.filter(r => r.etaMins > 0)
  const nextStop = futureStops.sort((a,b) => a.etaMins - b.etaMins)[0] || stopRows[stopRows.length - 1]
  const kmToNext = nextStop?.distanceKm ?? 0

  return (
    <div>
      <h3 className="font-semibold mb-2">Active Bus</h3>
      <div className="space-y-2">
        <div className="p-3 bg-gray-50 rounded border border-gray-200">
          <div className="flex justify-between">
            <div>
              <div className="font-medium">{bus.name}</div>
              <div className="text-sm text-gray-600">{bus.route}</div>
            </div>
            <div className="text-sm font-medium">{computedBusEta}</div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Bus No</span>
              <span className="font-medium">{bus.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status</span>
              {sharing ? (
                <span className="font-medium inline-flex items-center gap-2">
                  <span className="relative inline-flex">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" style={{ animationDuration: `${Math.max(0.6, 60/(realSpeed||30))}s` }}></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  {realSpeed} km/h
                </span>
              ) : (
                <span className="font-medium inline-flex items-center gap-2 text-amber-700">
                  <span className="relative inline-flex">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                  Bus not started
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Start</span>
              <span className="font-medium">{routeNow.startPlace} — {fmtIST(todayAt(routeNow.startTime))} IST</span>
            </div>
            {(assignedDriver?.name || bus.driverName) && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Driver</span>
                <span className="font-medium">{assignedDriver?.name || bus.driverName}</span>
              </div>
            )}
            {(assignedDriver?.phone || bus.driverPhone) && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Phone</span>
                <span className="font-medium tracking-wide">{assignedDriver?.phone || bus.driverPhone}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              ⚠ For safety, avoid calling the driver directly. Use this number only for urgent situations.
            </p>
          </div>

          {/* Stop schedule table */}
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Schedule and ETAs (IST)</div>
            <div className={`overflow-hidden rounded border border-gray-200 ${!sharing ? 'opacity-70' : ''}`}>
              <div className="grid grid-cols-4 bg-gray-100 text-xs font-semibold text-gray-700">
                <div className="px-2 py-2">Stop</div>
                <div className="px-2 py-2 text-center">Planned</div>
                <div className="px-2 py-2 text-center">ETA</div>
                <div className="px-2 py-2 text-center">Delay</div>
              </div>
              <div className="divide-y divide-gray-200 bg-white">
                {stopRows.map((r, i) => {
                  const norm = (v) => String(v || '').trim().toLowerCase()
                  const isMine = norm(r.name) === norm(highlightStopName)
                  const d = r.delayMin
                  const delayClass = !sharing ? 'text-gray-500' : (d > 0 ? 'text-red-600' : d < 0 ? 'text-emerald-600' : 'text-gray-700')
                  return (
                    <div key={i} className={`grid grid-cols-4 text-xs ${isMine ? 'bg-purple-50' : ''}`}>
                      <div className="px-2 py-2 capitalize">
                        <div className="leading-tight">{r.name}</div>
                        {isMine && (
                          <div className="mt-0.5 text-[10px] inline-block px-1 py-0.5 rounded bg-purple-100 text-purple-700">
                            Your stop
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-2 text-center">{r.planned}</div>
                      <div className="px-2 py-2 text-center">{r.etaDisplay}</div>
                      <div className={`px-2 py-2 text-center ${delayClass}`}>
                        {r.delayDisplay}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Live timeline moved to map column (below MapView) */}
        </div>
      </div>
    </div>
  )
}
