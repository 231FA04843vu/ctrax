// Realtime route stops access layer with local fallback cache
// Path in Firebase: routes/current/stops

import { db } from './firebase'
import { onValue, ref, set, get } from 'firebase/database'

const ROUTE_STOPS_PATH = 'routes/current/stops' // back-compat

let stopsCache = []
const subs = new Set()
let inited = false
// Multi-bus caches
const busStopsCache = new Map() // id -> stops[]
const busSubs = new Map() // id -> Set(cb)
const busInit = new Set()

function asArray(val){
  if (Array.isArray(val)) return val
  if (val && typeof val === 'object') return Object.values(val)
  return []
}

function normalizeStops(val) {
  const list = asArray(val)
  // Ensure positions are [lat,lng]
  return list.map(s => {
    const pos = s.position
    let normalizedPos
    if (Array.isArray(pos)) {
      normalizedPos = pos
    } else if (pos && typeof pos === 'object') {
      if ('lat' in pos && 'lng' in pos) normalizedPos = [Number(pos.lat), Number(pos.lng)]
      else if ('latitude' in pos && 'longitude' in pos) normalizedPos = [Number(pos.latitude), Number(pos.longitude)]
      else if ('0' in pos && '1' in pos) normalizedPos = [Number(pos[0]), Number(pos[1])]
    } else {
      // Fallback to top-level coordinates
      if ('lat' in s && 'lng' in s) normalizedPos = [Number(s.lat), Number(s.lng)]
      else if ('latitude' in s && 'longitude' in s) normalizedPos = [Number(s.latitude), Number(s.longitude)]
    }
    return { ...s, position: normalizedPos }
  }).filter(s => Array.isArray(s.position) && s.position.length === 2)
}

function notify() {
  subs.forEach(cb => { try { cb(stopsCache) } catch {} })
}

async function initOnce() {
  if (inited) return
  inited = true
  const r = ref(db, ROUTE_STOPS_PATH)
  onValue(r, (snap) => {
    const val = snap.val()
    stopsCache = normalizeStops(val)
    if (!stopsCache.length) stopsCache = []
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

// Multi-bus variants at /buses/{id}/stops
function pathForId(id){
  return `buses/${id}/stops`
}

// For per-bus routes, we never want to fall back to DEFAULT_STOPS.
function normalizeStopsForBus(val){
  const list = asArray(val)
  return list.map(s => {
    const pos = s.position
    let normalizedPos
    if (Array.isArray(pos)) {
      normalizedPos = pos
    } else if (pos && typeof pos === 'object') {
      if ('lat' in pos && 'lng' in pos) normalizedPos = [Number(pos.lat), Number(pos.lng)]
      else if ('latitude' in pos && 'longitude' in pos) normalizedPos = [Number(pos.latitude), Number(pos.longitude)]
      else if ('0' in pos && '1' in pos) normalizedPos = [Number(pos[0]), Number(pos[1])]
    } else {
      // Fallback to top-level coordinates
      if ('lat' in s && 'lng' in s) normalizedPos = [Number(s.lat), Number(s.lng)]
      else if ('latitude' in s && 'longitude' in s) normalizedPos = [Number(s.latitude), Number(s.longitude)]
    }
    return { ...s, position: normalizedPos }
  }).filter(s => Array.isArray(s.position) && s.position.length === 2)
}

async function initForBus(id){
  if (busInit.has(id)) return
  busInit.add(id)
  const r = ref(db, pathForId(id))
  try {
    const snap = await get(r)
    if (!snap.exists()) {
      // For per-bus routes, start empty; admin will add stops
      await set(r, [])
    }
  } catch {}
  onValue(r, (snap) => {
    const val = snap.val()
    const normalized = normalizeStopsForBus(val)
    busStopsCache.set(id, normalized.length ? normalized : [])
    const cbs = busSubs.get(id)
    if (cbs) cbs.forEach(cb => { try { cb(busStopsCache.get(id)) } catch {} })
  }, (err) => {
    console.error('routeData bus listener error:', id, err)
  })
}

export function getStopsFor(id){
  initForBus(id)
  return busStopsCache.get(id) || []
}

export function onStopsFor(id, callback){
  initForBus(id)
  if (!busSubs.has(id)) busSubs.set(id, new Set())
  const setCbs = busSubs.get(id)
  setCbs.add(callback)
  try { callback(getStopsFor(id)) } catch {}
  return () => setCbs.delete(callback)
}

export async function setStopsFor(id, stops){
  const normalized = normalizeStopsForBus(stops)
  await set(ref(db, pathForId(id)), normalized)
}

export default {
  getStops,
  onStops,
  setStops,
  getStopsFor,
  onStopsFor,
  setStopsFor,
}
