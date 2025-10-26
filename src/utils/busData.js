// Realtime bus data access layer backed by Firebase Realtime Database
// Provides an in-memory cache and subscription helpers so UI remains responsive.

import { db } from './firebase'
import { onValue, ref, update, set, get } from 'firebase/database'

// Default/fallback bus state (mirrors previous mockData.bus)
const DEFAULT_BUS = {
  id: 'BUS-7016',
  name: 'sattenapalli bus',
  route: 'vignan university — sattenapalli',
  position: [16.2315471, 80.5526116],
  eta: '≈81 mins',
  driverName: 'sankar rao',
  driverPhone: '+91 98765 43210',
  speedKmph: 32,
  startPlace: 'Vignan University',
  startTime: '16:30',
  sharing: false
}

let cache = { ...DEFAULT_BUS }
const BUS_PATH = 'bus'
const subs = new Set()
let inited = false

function ensureArrayPosition(pos) {
  if (!pos) return DEFAULT_BUS.position
  if (Array.isArray(pos) && pos.length === 2) return pos
  // if stored as object {0:lat,1:lng}
  if (typeof pos === 'object' && pos !== null && '0' in pos && '1' in pos) {
    return [Number(pos[0]), Number(pos[1])]
  }
  return DEFAULT_BUS.position
}

function notify() {
  subs.forEach(cb => {
    try { cb(cache) } catch {}
  })
}

async function initOnce() {
  if (inited) return
  inited = true
  const r = ref(db, BUS_PATH)
  // Seed if missing (non-destructive; only when path absent)
  try {
    const snap = await get(r)
    if (!snap.exists()) {
      await set(r, DEFAULT_BUS)
    }
  } catch {}
  onValue(r, (snap) => {
    const val = snap.val()
    if (val) {
      cache = {
        ...DEFAULT_BUS,
        ...val,
        position: ensureArrayPosition(val.position)
      }
    } else {
      cache = { ...DEFAULT_BUS }
    }
    notify()
  }, (err) => {
    console.error('busData listener error:', err)
  })
}

export function getBus() {
  // Kick off init lazily
  initOnce()
  return cache
}

export function onBus(callback) {
  initOnce()
  subs.add(callback)
  // Fire once with current cache
  try { callback(cache) } catch {}
  return () => subs.delete(callback)
}

export async function setBus(patch) {
  await update(ref(db, BUS_PATH), patch)
}

export async function setPosition(position) {
  await update(ref(db, BUS_PATH), { position })
}

export async function setSharing(sharing) {
  await update(ref(db, BUS_PATH), { sharing })
}

export function getStartTime() {
  return (cache.startTime || DEFAULT_BUS.startTime)
}

export default {
  getBus,
  onBus,
  setBus,
  setPosition,
  setSharing,
  getStartTime,
}
