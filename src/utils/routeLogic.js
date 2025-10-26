// Utilities to decide route direction (morning/evening),
// build ordered stops including origin, and provide timing hints.
import { getStartTime } from './busData'
import { getStops } from './routeData'

export const toRad = (v) => (v * Math.PI) / 180
export const haversineKm = (a, b) => {
  const R = 6371
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Decide morning vs evening based on local time, with explicit windows.
export function getRoutePhase(now = new Date()){
  const h = now.getHours()
  const m = now.getMinutes()
  const mins = h * 60 + m
  // Morning window: 05:00–10:30
  if (mins >= 5*60 && mins <= 10*60 + 30) return 'morning'
  return 'evening'
}

// Build ordered stops including origin and meta info
export function buildRouteForNow(){
  const phase = getRoutePhase()
  const stops = getStops()
  // Use a fixed Vignan University coordinate to avoid mutation from live movement
  const VIGNAN_POS = [16.2315471, 80.5526116]
  const vignan = { name: 'vignan university', position: VIGNAN_POS }
  const sattenapalli = stops[stops.length - 1]

  if (phase === 'morning'){
    // sattenapalli -> ... -> chuttugunta -> vignan university
    const middle = [...stops].slice(0, stops.length) // full list includes sattenapalli at end; reverse excludes duplicate end handling
    const forward = middle // chuttu.. to sattenapalli
    const reversed = [...forward].reverse() // sattenapalli ... chuttugunta
    const ordered = [sattenapalli, ...reversed.slice(1), vignan]

    // derive reversed planned offsets relative to morning start at 06:30 and target arrival around 07:50
    const lastOffset = stops[stops.length - 1].plannedOffsetMins || 81
    const startTime = '06:30'
    // Build timeline including start (Sattenapalli) and end (Vignan)
    const reversedWithOffsets = reversed.map((s) => ({
      name: s.name,
      position: s.position,
      plannedOffsetMins: Math.max(0, lastOffset - (s.plannedOffsetMins ?? 0))
    }))
    // Append Vignan at the end with final offset
    const timeline = [
      ...reversedWithOffsets,
      { name: vignan.name, position: vignan.position, plannedOffsetMins: lastOffset }
    ]
    return {
      phase,
      startTime,
      startPlace: 'Sattenapalli',
      orderedStops: ordered,
      // timeline includes Sattenapalli start and Vignan end
      timeline
    }
  }

  // evening: vignan university -> chuttugunta -> ... -> sattenapalli
  const ordered = [vignan, ...stops]
  return {
    phase,
    startTime: getStartTime() || '16:30',
    startPlace: 'Vignan University',
    orderedStops: ordered,
    // timeline includes start (Vignan) and all subsequent stops, with Vignan offset 0
    timeline: [
      { name: vignan.name, position: vignan.position, plannedOffsetMins: 0 },
      ...stops.map((s) => ({ name: s.name, position: s.position, plannedOffsetMins: s.plannedOffsetMins }))
    ]
  }
}

// Given current position and ordered stops, estimate nearest and next indices.
export function getProgress(pos, orderedStops){
  if (!orderedStops || orderedStops.length === 0) return { arrivedIdx: 0, nextIdx: 0 }
  let nearestIdx = 0
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < orderedStops.length; i++){
    const d = haversineKm(pos, orderedStops[i].position)
    if (d < best){ best = d; nearestIdx = i }
  }
  const arrivedIdx = Math.max(0, Math.min(nearestIdx, orderedStops.length - 1))
  const nextIdx = Math.min(arrivedIdx + 1, orderedStops.length - 1)
  return { arrivedIdx, nextIdx }
}

export default {
  haversineKm,
  getRoutePhase,
  buildRouteForNow,
  getProgress
}
