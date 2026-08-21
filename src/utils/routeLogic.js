// Utilities to decide route direction (morning/evening),
// build ordered stops including origin, and provide timing hints.
import { getStopsFor } from './routeData'

export const toRad = (v) => (v * Math.PI) / 180
export const haversineKm = (a, b) => {
  if (!a || !b || typeof a[0] !== 'number' || typeof b[0] !== 'number') return 0
  const R = 6371
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Helper to find shortest distance from point to a line segment
export const distanceToSegmentKm = (p, v, w) => {
  const l2 = (w[0] - v[0]) ** 2 + (w[1] - v[1]) ** 2;
  if (l2 === 0) return haversineKm(p, v);
  
  // Consider latitude and longitude as flat for short distances (approximation for performance)
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projection = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
  return haversineKm(p, projection);
}

// Helper to find shortest distance from point to a polyline
export const distanceToPolylineKm = (p, polyline) => {
  if (!polyline || polyline.length < 2) return 0;
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = distanceToSegmentKm(p, polyline[i], polyline[i+1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// Decide morning vs evening based on local time, with explicit windows.
export function getRoutePhase(explicitPhase = null, now = new Date()){
  if (explicitPhase === 'morning' || explicitPhase === 'evening') return explicitPhase
  const h = now.getHours()
  const m = now.getMinutes()
  const mins = h * 60 + m
  // Morning window: 05:00–10:30
  if (mins >= 5*60 && mins <= 10*60 + 30) return 'morning'
  return 'evening'
}

// Build ordered stops including origin and meta info
export function buildRouteForNow(busId=null, explicitPhase=null){
  const phase = getRoutePhase(explicitPhase)
  // Use per-bus stops only. Avoid legacy global route path to prevent permission errors.
  const stops = busId ? (getStopsFor(busId) || []) : []
  // Use a fixed Vignan University coordinate to avoid mutation from live movement
  const VIGNAN_POS = [16.2315471, 80.5526116]
  const vignan = { name: 'vignan university', position: VIGNAN_POS }
  const hasStops = Array.isArray(stops) && stops.length > 0
  const sattenapalli = hasStops ? stops[stops.length - 1] : null

  if (phase === 'morning'){
    if (!hasStops){
      return {
        phase,
        startTime: '06:30',
        startPlace: 'Vignan University',
        orderedStops: [vignan],
        timeline: [
          { name: vignan.name, position: vignan.position, plannedOffsetMins: 0 }
        ]
      }
    }
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
  const ordered = hasStops ? [vignan, ...stops] : [vignan]
  return {
    phase,
    startTime: '16:30',
    startPlace: 'Vignan University',
    orderedStops: ordered,
    // timeline includes start (Vignan) and all subsequent stops, with Vignan offset 0
    timeline: [
      { name: vignan.name, position: vignan.position, plannedOffsetMins: 0 },
      ...(hasStops ? stops.map((s) => ({ name: s.name, position: s.position, plannedOffsetMins: s.plannedOffsetMins })) : [])
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
