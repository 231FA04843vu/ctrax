// Realtime bus data access layer backed by Firebase Realtime Database
// Provides an in-memory cache and subscription helpers so UI remains responsive.

import { db } from './firebase'
import { onValue, ref, update, set, get } from 'firebase/database'

// Back-compat single-bus cache (no mock defaults)
let cache = {}
const BUS_PATH = 'bus'
const subs = new Set()
let inited = false

// Multi-bus caches under /buses/{id}
const busesCache = new Map() // id -> bus meta
const busesSubs = new Map() // id -> Set(callback)
const busesListSubs = new Set() // callbacks for full list updates
let busesInited = false

function ensureArrayPosition(pos) {
  if (!pos) return undefined
  if (Array.isArray(pos) && pos.length === 2) return pos
  // if stored as object {0:lat,1:lng}
  if (typeof pos === 'object' && pos !== null && '0' in pos && '1' in pos) {
    return [Number(pos[0]), Number(pos[1])]
  }
  return undefined
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
  onValue(r, (snap) => {
    const val = snap.val()
    if (val) {
      cache = {
        ...val,
        position: ensureArrayPosition(val.position)
      }
    } else {
      cache = {}
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
  return (cache.startTime || null)
}

// Multi-bus helpers
function pathForId(id){
  return `buses/${id}`
}

async function ensureBusExists(id){
  const r = ref(db, pathForId(id))
  try {
    const snap = await get(r)
    if (!snap.exists()) {
      // Minimal seed for new bus: only id; other fields to be filled explicitly by admin
      await set(r, { id })
    }
  } catch {}
}

export async function setBusFor(id, patch){
  await ensureBusExists(id)
  await update(ref(db, pathForId(id)), patch)
}

export async function setPositionFor(id, position){
  await ensureBusExists(id)
  await update(ref(db, pathForId(id)), { position })
}

export async function setSharingFor(id, sharing){
  await ensureBusExists(id)
  await update(ref(db, pathForId(id)), { sharing })
}

// Simulation state helpers under buses/{id}/sim
export async function setSimFor(id, patch){
  await ensureBusExists(id)
  await update(ref(db, `${pathForId(id)}/sim`), patch)
}

export function getBusFor(id){
  if (!busesInited) startBusesListener()
  return busesCache.get(id) || null
}

export function onBusFor(id, callback){
  if (!busesInited) startBusesListener()
  if (!busesSubs.has(id)) busesSubs.set(id, new Set())
  const setCbs = busesSubs.get(id)
  setCbs.add(callback)
  const curr = busesCache.get(id)
  if (curr) { try { callback(curr) } catch {} }
  return () => {
    setCbs.delete(callback)
  }
}

function startBusesListener(){
  if (busesInited) return
  busesInited = true
  const r = ref(db, 'buses')
  onValue(r, (snap) => {
    const val = snap.val() || {}
    // normalize each bus without injecting global defaults to avoid cross-bus bleed
    const next = new Map()
    Object.values(val).forEach((b) => {
      const id = b.id || 'unknown'
      next.set(id, {
        ...b,
        position: ensureArrayPosition(b.position)
      })
    })
    // replace cache and notify per-bus subscribers
    busesCache.clear()
    next.forEach((v, k) => busesCache.set(k, v))
    next.forEach((bus, id) => {
      const cbs = busesSubs.get(id)
      if (cbs) cbs.forEach(cb => { try { cb(bus) } catch {} })
    })
    // notify list subscribers with full array snapshot
    const list = Array.from(busesCache.values())
    busesListSubs.forEach(cb => { try { cb(list) } catch {} })
  }, (err) => {
    console.error('buses listener error:', err)
  })
}

export function listBuses(){
  if (!busesInited) startBusesListener()
  return Array.from(busesCache.values())
}

export function onBuses(callback){
  if (!busesInited) startBusesListener()
  busesListSubs.add(callback)
  try { callback(listBuses()) } catch {}
  return () => busesListSubs.delete(callback)
}

export default {
  // single-bus back-compat
  getBus,
  onBus,
  setBus,
  setPosition,
  setSharing,
  getStartTime,
  // multi-bus
  listBuses,
  onBuses,
  getBusFor,
  onBusFor,
  setBusFor,
  setPositionFor,
  setSharingFor,
  setSimFor,
}
