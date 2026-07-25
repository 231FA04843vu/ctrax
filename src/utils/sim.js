// Simulation utilities have been removed — production code should use real GPS data.
// These stubs are left to avoid runtime errors if any imports remained.

export function cumulativeKm(points){
  return []
}

export function pointAtDistance(points){
  return points?.[0] || null
}

export function computeSimulatedPos(sim, points){
  // Simulation disabled — return null to indicate no simulated position
  return null
}

export default {
  cumulativeKm,
  pointAtDistance,
  computeSimulatedPos,
}
