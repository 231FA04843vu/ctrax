import { haversineKm } from './routeLogic'

// Build cumulative distance array for a polyline of [lat,lng] points
export function cumulativeKm(points){
  const n = (points || []).length
  if (n === 0) return []
  const cum = new Array(n).fill(0)
  for (let i = 1; i < n; i++){
    cum[i] = cum[i-1] + haversineKm(points[i-1], points[i])
  }
  return cum
}

// Reflect distance for bounce mode (0..L..0..L..)
function reflectDistance(d, L){
  if (L <= 0) return 0
  const period = 2 * L
  let mod = d % period
  if (mod < 0) mod += period
  return mod <= L ? mod : (period - mod)
}

// Return point at traveled distance d along the polyline
export function pointAtDistance(points, cum, d, mode = 'bounce'){
  const n = (points || []).length
  if (n === 0) return null
  if (n === 1) return points[0]
  const L = cum[n - 1]
  let along = 0
  if (mode === 'loop'){
    let mod = d % L
    if (mod < 0) mod += L
    along = mod
  } else {
    along = reflectDistance(d, L)
  }
  // binary search for segment
  let lo = 0, hi = n - 1
  while (lo + 1 < hi){
    const mid = Math.floor((lo + hi) / 2)
    if (cum[mid] <= along) lo = mid
    else hi = mid
  }
  const segStart = cum[lo]
  const segLen = Math.max(1e-9, cum[lo+1] - segStart)
  const t = Math.max(0, Math.min(1, (along - segStart) / segLen))
  const a = points[lo]
  const b = points[lo+1]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

// Compute current position from simulation parameters in DB
export function computeSimulatedPos(sim, points){
  if (!sim || !sim.active || !Array.isArray(points) || points.length < 1) return points?.[0] || null
  const speed = Number(sim.speedKmph) || 30
  const dir = sim.dir === -1 ? -1 : 1
  const mode = sim.mode === 'loop' ? 'loop' : 'bounce'
  const offsetKm = Number(sim.offsetKm) || 0
  const last = Number(sim.lastUpdateAt) || Date.now()
  const dtH = Math.max(0, (Date.now() - last) / 3600000)
  const travelKm = offsetKm + dir * speed * dtH
  const cum = cumulativeKm(points)
  return pointAtDistance(points, cum, travelKm, mode)
}

export default {
  cumulativeKm,
  pointAtDistance,
  computeSimulatedPos,
}
