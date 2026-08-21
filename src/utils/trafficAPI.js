const API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || ''

/**
 * Calculates ETA using TomTom Routing API which considers real-time traffic.
 * @param {Array} startPos - [lat, lng]
 * @param {Array} endPos - [lat, lng]
 * @returns {Promise<{ travelTimeSeconds: number, trafficDelaySeconds: number, trafficLengthInMeters: number }|null>}
 */
export async function getTrafficETA(startPos, endPos) {
  if (!API_KEY) {
    console.warn('No TomTom API key found. Traffic ETA unavailable.')
    return null
  }
  
  if (!startPos || !endPos || startPos.length !== 2 || endPos.length !== 2) {
    return null
  }

  // TomTom requires lat,lng:lat,lng
  const locations = `${startPos[0]},${startPos[1]}:${endPos[0]},${endPos[1]}`
  // computeTravelTimeFor=all gives us historical, live traffic, and no-traffic ETAs
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${locations}/json?key=${API_KEY}&traffic=true&computeTravelTimeFor=all`
  
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`TomTom API error: ${res.status}`)
    }
    const data = await res.json()
    const route = data.routes?.[0]?.summary
    
    if (route) {
      return {
        travelTimeSeconds: route.travelTimeInSeconds,
        trafficDelaySeconds: route.trafficDelayInSeconds || 0,
        trafficLengthInMeters: route.trafficLengthInMeters || 0,
        noTrafficTravelTimeSeconds: route.noTrafficTravelTimeInSeconds || route.travelTimeInSeconds
      }
    }
  } catch (err) {
    console.error('Failed to fetch TomTom traffic ETA:', err)
  }
  return null
}
