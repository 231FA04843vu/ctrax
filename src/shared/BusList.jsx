
import React, { useEffect, useMemo, useState } from 'react'
import { getBus, onBus, getBusFor, onBusFor } from '../utils/busData'
import { getUsers } from '../utils/auth'
import { formatMinutes } from '../utils/format'
import { buildRouteForNow, haversineKm } from '../utils/routeLogic'
import { onStopsFor, onStops } from '../utils/routeData'
import { computeSimulatedPos } from '../utils/sim'

export default function BusList({ busId = null, highlightStopName = '' }){
  const [bus, setBus] = useState(busId ? (getBusFor(busId) || {}) : getBus())
  const sharing = bus.sharing ?? false
  // Use a single source of truth for speed from simulation or bus config
  const speed = Math.max(1, Number(bus?.sim?.speedKmph) || Number(bus?.speedKmph) || 30)
  const [liveTick, setLiveTick] = useState(0)
  const [assignedDriver, setAssignedDriver] = useState(null)

  useEffect(() => {
    if (busId){
      const off = onBusFor(busId, setBus)
      return off
    }
    const off = onBus(setBus)
    return off
  }, [busId])

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

  // (Removed randomization) — keep speed consistent with DB simulation

  // Live refresh so ETAs and distance update while sim runs
  useEffect(() => {
    const id = setInterval(() => setLiveTick((t) => (t + 1) % 1_000_000), 1000)
    return () => clearInterval(id)
  }, [])

  // Route selection (morning/evening) and helpers
  const [stopsTick, setStopsTick] = useState(0)
  useEffect(() => {
    if (busId) return onStopsFor(busId, () => setStopsTick(t => t + 1))
    return onStops(() => setStopsTick(t => t + 1))
  }, [busId])
  const routeNow = useMemo(() => buildRouteForNow(busId || null), [busId, stopsTick])
  const ordered = routeNow.orderedStops || []
  const originPos = ordered[0]?.position
  const currentPos = computeSimulatedPos(bus?.sim, ordered.map(s => s.position)) || (originPos || [0,0])
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
  const etaFinalMins = Math.max(1, Math.round((distToFinalKm / Math.max(1, speed)) * 60))
  const computedBusEta = sharing ? `≈ ${formatMinutes(etaFinalMins)}` : '—'

  // Build per-stop rows: planned vs estimated & delay
  const startPlanned = todayAt(routeNow.startTime)
  const now = new Date()
  // Build rows sequentially so delay propagates from previous arrival
  const rows = []
  let prevEtaTime = new Date(now) // start from 'now'
  let prevPos = currentPos
  routeNow.timeline.forEach((s, i) => {
    const distanceKm = haversineKm(prevPos, s.position)
    const travelMins = Math.max(0, Math.round((distanceKm / Math.max(1, speed)) * 60))
    const estArrival = new Date(prevEtaTime.getTime() + travelMins * 60000)
    const planned = new Date(startPlanned.getTime() + (s.plannedOffsetMins ?? 0) * 60000)
    const rawDelay = Math.round((estArrival.getTime() - planned.getTime()) / 60000)
    // Optional recovery so later stops can catch up a bit
    const recovery = Math.max(0.4, 1 - i * 0.18)
    const adjusted = Math.round(rawDelay * recovery)
    const delayMin = Math.max(-15, Math.min(15, adjusted))
    const displayETA = new Date(planned.getTime() + delayMin * 60000)
    // Set state for next leg to the displayed ETA and this stop's position
    prevEtaTime = displayETA
    prevPos = s.position

    rows.push({
      name: s.name,
      planned: fmtIST(planned),
      eta: fmtIST(displayETA),
      delayMin,
      etaMins: travelMins,
      distanceKm: Math.round(distanceKm),
      etaDisplay: sharing ? fmtIST(displayETA) : '—',
      delayDisplay: sharing ? (delayMin === 0 ? 'On time' : (delayMin > 0 ? `+${delayMin} min` : `${delayMin} min`)) : '—'
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
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" style={{ animationDuration: `${Math.max(0.6, 60/speed)}s` }}></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  {speed} km/h
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
