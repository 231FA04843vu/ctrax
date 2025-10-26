// Realtime route stops access layer with local fallback cache
// Path in Firebase: routes/current/stops

import { db } from './firebase'
import { onValue, ref, set, get, update } from 'firebase/database'

// Local default stops (migrated from previous mockData.stops)
const DEFAULT_STOPS = [
  { name: 'chuttugunta', position: [16.3067, 80.4365], eta: '26 mins', plannedOffsetMins: 26 },
  { name: 'perecherla', position: [16.3323613, 80.3527921], eta: '42 mins', plannedOffsetMins: 42 },
  { name: 'medikonduru', position: [16.346464, 80.3002], eta: '52 mins', plannedOffsetMins: 52 },
  { name: 'jangamguntla palem', position: [16.3616057, 80.2697529], eta: '58 mins', plannedOffsetMins: 58 },
  { name: 'bhiminenivaripalem', position: [16.3695, 80.237], eta: '64 mins', plannedOffsetMins: 64 },
  { name: 'sattenapalli', position: [16.3925393, 80.1489341], eta: '81 mins', plannedOffsetMins: 81 }
]

const ROUTE_STOPS_PATH = 'routes/current/stops'

let stopsCache = DEFAULT_STOPS.slice()
const subs = new Set()
let inited = false

function normalizeStops(val) {
  if (!Array.isArray(val)) return DEFAULT_STOPS.slice()
  // Ensure positions are [lat,lng]
  return val.map(s => ({
    ...s,
    position: Array.isArray(s.position)
      ? s.position
      : (s.position && typeof s.position === 'object' && '0' in s.position && '1' in s.position
          ? [Number(s.position[0]), Number(s.position[1])] : undefined)
  })).filter(s => Array.isArray(s.position) && s.position.length === 2)
}

function notify() {
  subs.forEach(cb => { try { cb(stopsCache) } catch {} })
}

async function initOnce() {
  if (inited) return
  inited = true
  const r = ref(db, ROUTE_STOPS_PATH)
  try {
    const snap = await get(r)
    if (!snap.exists()) {
      await set(r, DEFAULT_STOPS)
    }
  } catch {}
  onValue(r, (snap) => {
    const val = snap.val()
    stopsCache = normalizeStops(val)
    if (!stopsCache.length) stopsCache = DEFAULT_STOPS.slice()
    notify()
  }, (err) => {
    console.error('routeData listener error:', err)
  })
}

export function getStops() {
  initOnce()
  return stopsCache
}

export function onStops(callback) {
  initOnce()
  subs.add(callback)
  try { callback(stopsCache) } catch {}
  return () => subs.delete(callback)
}

export async function setStops(stops) {
  const normalized = normalizeStops(stops)
  await set(ref(db, ROUTE_STOPS_PATH), normalized)
}

export default {
  getStops,
  onStops,
  setStops,
}
