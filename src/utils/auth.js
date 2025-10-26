// Auth utility backed by Firebase Realtime Database for user storage.
// Session is still kept in localStorage on the client.

import { db } from './firebase'
import { ref, get, set, update, onValue } from 'firebase/database'

const KEY_SESSION = 'auth:session'

const safeParse = (s, fallback = null) => {
  try { return JSON.parse(s) } catch { return fallback }
}

// In-memory cache kept in sync via listeners so existing UI can read synchronously
const cache = { student: [], driver: [] }
let listenersStarted = false

function startListeners(){
  if (listenersStarted) return
  listenersStarted = true
  ;['student', 'driver'].forEach(role => {
    const r = ref(db, `users/${role}`)
    onValue(r, (snap) => {
      const val = snap.val() || {}
      // stored as { id: user, ... }
      cache[role] = Object.values(val)
    }, (err) => {
      // on error, keep cache as-is
      // eslint-disable-next-line no-console
      console.warn('Firebase listener error', role, err?.message)
    })
  })
}
startListeners()

export function getUsers(role){
  // Return cached array for UI consumption (may be empty until first load)
  return cache[role === 'driver' ? 'driver' : 'student'] || []
}

export function getSession(){
  return safeParse(localStorage.getItem(KEY_SESSION), null)
}

export function setSession(session){
  if (!session) {
    localStorage.removeItem(KEY_SESSION)
  } else {
    localStorage.setItem(KEY_SESSION, JSON.stringify(session))
  }
}

export async function register(role, payload){
  const roleKey = role === 'driver' ? 'driver' : 'student'
  const snap = await get(ref(db, `users/${roleKey}`))
  const existing = snap.val() || {}
  const list = Object.values(existing)
  const email = (payload.email || '').trim().toLowerCase()
  if (!email || !payload.password) {
    throw new Error('Email and password are required')
  }
  if (list.some(u => (u.email || '').toLowerCase() === email)){
    throw new Error('An account with this email already exists')
  }
  const id = `${roleKey}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
  const user = {
    id,
    role: roleKey,
    name: payload.name?.trim() || 'User',
    email,
    password: payload.password, // demo only — consider Firebase Auth later
    phone: payload.phone || '',
    createdAt: Date.now()
  }
  if (roleKey === 'driver') {
    user.busNo = payload.busNo || ''
  }
  if (roleKey === 'student') {
    user.busNo = payload.busNo || ''
    user.rollNo = payload.rollNo || ''
    user.parentPhone = payload.parentPhone || ''
    user.stop = payload.stop || ''
    if (payload.parentPassword) user.parentPassword = payload.parentPassword
  }
  await set(ref(db, `users/${roleKey}/${id}`), user)
  const baseSession = { id, role: roleKey, email: user.email, name: user.name }
  if (roleKey === 'driver' && user.busNo) baseSession.busNo = user.busNo
  setSession(baseSession)
  // update cache eagerly
  cache[roleKey] = [...(cache[roleKey] || []), user]
  return user
}

export async function login(role, identifier, password){
  const roleKey = role === 'driver' ? 'driver' : 'student'
  const snap = await get(ref(db, `users/${roleKey}`))
  const list = Object.values(snap.val() || {})
  let user = null
  if (roleKey === 'driver'){
    const phoneNorm = String(identifier || '').replace(/\D+/g, '')
    user = list.find(u => String(u.phone || '').replace(/\D+/g, '') === phoneNorm && u.password === password)
  } else {
    const em = (identifier || '').trim().toLowerCase()
    user = list.find(u => (u.email || '').toLowerCase() === em && u.password === password)
  }
  if (!user) throw new Error('Invalid credentials')
  const baseSession = { id: user.id, role: user.role, email: user.email, name: user.name }
  if (roleKey === 'driver' && user.busNo) baseSession.busNo = user.busNo
  setSession(baseSession)
  // refresh cache for role
  cache[roleKey] = list
  return user
}

// Parent login uses parent's phone and student's roll number as password
export async function loginParent(parentPhone, rollNo){
  const snap = await get(ref(db, 'users/student'))
  const list = Object.values(snap.val() || {})
  const phone = (parentPhone || '').replace(/\s+/g, '')
  const rn = (rollNo || '').trim()
  const student = list.find(s => (s.parentPhone || '').replace(/\s+/g, '') === phone && (s.rollNo || '').trim() === rn)
  if (!student) throw new Error('Invalid parent phone or roll number')
  const parentName = `Parent of ${student.name || 'Student'}`
  const session = {
    id: `parent-${student.id}`,
    role: 'parent',
    name: parentName,
    email: '',
    studentId: student.id,
    studentName: student.name,
    busNo: student.busNo,
    stop: student.stop,
    rollNo: student.rollNo,
    parentPhone: student.parentPhone
  }
  setSession(session)
  // refresh student cache
  cache.student = list
  return session
}

export function logout(){
  setSession(null)
}

export async function updateProfile(updates){
  const session = getSession()
  if (!session) throw new Error('Not signed in')
  const roleKey = session.role === 'driver' ? 'driver' : 'student'
  const userRef = ref(db, `users/${roleKey}/${session.id}`)
  await update(userRef, updates)
  // update cache entry if present
  const arr = cache[roleKey] || []
  const idx = arr.findIndex(u => u.id === session.id)
  if (idx >= 0) {
    arr[idx] = { ...arr[idx], ...updates }
    cache[roleKey] = [...arr]
  }
  const newSession = { ...session }
  if (updates.name) newSession.name = updates.name
  if (updates.email) newSession.email = updates.email
  setSession(newSession)
  return arr.find(u => u.id === session.id) || null
}

export function isRole(role){
  const s = getSession()
  return !!s && s.role === role
}
