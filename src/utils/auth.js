// Auth utility backed by Firebase Realtime Database for user storage.
// Session is still kept in localStorage on the client.

import { db, auth } from './firebase'
import { sendPasswordResetEmail, createUserWithEmailAndPassword, signInWithEmailAndPassword, fetchSignInMethodsForEmail, onAuthStateChanged, signOut } from 'firebase/auth'
import { ref, get, set, update, onValue } from 'firebase/database'

const KEY_SESSION = 'auth:session'
const KEY_LOGOUT_FLAG = 'auth:explicitLogout'

const safeParse = (s, fallback = null) => {
  try { return JSON.parse(s) } catch { return fallback }
}

// In-memory cache kept in sync via listeners so existing UI can read synchronously
const cache = { student: [], driver: [], admin: [] }
let listenersStarted = false

function startListeners(){
  if (listenersStarted) return
  listenersStarted = true
  ;['student', 'driver', 'admin'].forEach(role => {
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

// Rehydrate local session from Firebase Auth if possible and not explicitly logged out
;(function rehydrateFromAuth(){
  try {
    onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) return
      // Respect explicit logout: if user logged out via app, don't auto-restore
      if (localStorage.getItem(KEY_LOGOUT_FLAG) === '1') return
      const existing = safeParse(localStorage.getItem(KEY_SESSION), null)
      if (existing && existing.email === (fbUser.email || '').toLowerCase()) return
      const em = (fbUser.email || '').toLowerCase()
      if (!em) return
      // Try to find profile in DB for any role
      const roles = ['admin', 'student', 'driver']
      for (const role of roles){
        try {
          const snap = await get(ref(db, `users/${role}`))
          const list = Object.values(snap.val() || {})
          const user = list.find(u => (String(u.email || '').toLowerCase()) === em)
          if (user){
            const session = { id: user.id, role, email: user.email, name: user.name }
            if (role === 'driver' && user.busNo) session.busNo = user.busNo
            setSession(session)
            // Also refresh cache for that role so UI reads synchronously
            cache[role] = list
            break
          }
        } catch {}
      }
    })
  } catch {}
})()

export function getUsers(role){
  // Return cached array for UI consumption (may be empty until first load)
  if (role === 'driver') return cache.driver || []
  if (role === 'admin') return cache.admin || []
  return cache.student || []
}

export function getSession(){
  return safeParse(localStorage.getItem(KEY_SESSION), null)
}

export function setSession(session){
  if (!session) {
    localStorage.removeItem(KEY_SESSION)
  } else {
    localStorage.setItem(KEY_SESSION, JSON.stringify(session))
    // Clear explicit logout flag on successful session set so auto-restore works next reload
    try { localStorage.removeItem(KEY_LOGOUT_FLAG) } catch {}
  }
}

export async function register(role, payload, options = {}){
  const roleKey = role === 'driver' ? 'driver' : 'student'
  const snap = await get(ref(db, `users/${roleKey}`))
  const existing = snap.val() || {}
  const list = Object.values(existing)
  const email = (payload.email || '').trim().toLowerCase()
  if (!email || !payload.password) {
    throw new Error('Email and password are required')
  }
  if (String(payload.password).length < 6) {
    throw new Error('Password must be at least 6 characters (Firebase requirement)')
  }
  if (list.some(u => (u.email || '').toLowerCase() === email)){
    throw new Error('An account with this email already exists')
  }
  // Create an Auth account so email reset works (students and drivers)
  if (roleKey === 'student' || roleKey === 'driver') {
    try {
      // If user already exists in Auth (migrated), skip create
      const methods = await fetchSignInMethodsForEmail(auth, email)
      if (!methods || methods.length === 0) {
        await createUserWithEmailAndPassword(auth, email, payload.password)
      }
    } catch (err) {
      // Surface meaningful messages
      const msg = err?.message?.toLowerCase?.() || ''
      if (msg.includes('email-already-in-use')) {
        throw new Error('This email is already registered. Try signing in.')
      }
      if (err?.code === 'auth/weak-password') {
        throw new Error('Password must be at least 6 characters (Firebase requirement)')
      }
      throw err
    }
  }
  const id = `${roleKey}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
  const user = {
    id,
    role: roleKey,
    name: payload.name?.trim() || 'User',
    email,
    password: payload.password, // kept for backward compatibility; consider removing after full Auth migration
    phone: payload.phone || '',
    createdAt: Date.now()
  }
  if (roleKey === 'driver') {
    user.busNo = payload.busNo || ''
    if (payload.licenseNo) user.licenseNo = payload.licenseNo
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
  if (!options.noSession) {
    setSession(baseSession)
  }
  // update cache eagerly
  cache[roleKey] = [...(cache[roleKey] || []), user]
  return user
}

export async function login(role, identifier, password){
  // Admin login
  if (role === 'admin') {
    const email = (identifier || '').trim().toLowerCase()
    // Try Firebase Auth first (preferred)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      // If Auth fails (legacy admin), fall back to DB
      const snap = await get(ref(db, 'users/admin'))
      const list = Object.values(snap.val() || {})
      const userLegacy = list.find(u => (u.email || '').toLowerCase() === email && u.password === password)
      if (!userLegacy) {
        // Normalize Firebase error codes for UX
        const code = e?.code || ''
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
          throw new Error('Invalid email or password')
        }
        // Unknown error
        throw new Error('Sign-in failed. Please try again.')
      }
      cache.admin = list
      const sessionLegacy = { id: userLegacy.id, role: 'admin', email: userLegacy.email, name: userLegacy.name }
      setSession(sessionLegacy)
      return userLegacy
    }
    // If Auth sign-in succeeded, fetch admin profile from DB
    const snap = await get(ref(db, 'users/admin'))
    const list = Object.values(snap.val() || {})
    let user = list.find(u => (u.email || '').toLowerCase() === email)
    // Auto-provision admin profile if missing (Auth succeeded). Safer when this email is truly an admin.
    if (!user) {
      const uid = auth.currentUser?.uid || `a-${Date.now()}`
      const id = `admin-${uid}`
      user = {
        id,
        role: 'admin',
        name: auth.currentUser?.displayName || 'Admin',
        email,
        // Keep a placeholder password only for legacy compatibility; not used by Auth logins.
        password: 'auth-managed',
        createdAt: Date.now()
      }
      await set(ref(db, `users/admin/${id}`), user)
      list.push(user)
    }
    cache.admin = list
    const session = { id: user.id, role: 'admin', email: user.email, name: user.name }
    setSession(session)
    try { localStorage.removeItem(KEY_LOGOUT_FLAG) } catch {}
    return user
  }

  const roleKey = role === 'driver' ? 'driver' : 'student'
  const snap = await get(ref(db, `users/${roleKey}`))
  const list = Object.values(snap.val() || {})
  let user = null
  if (roleKey === 'driver'){
    const idStr = String(identifier || '')
    const isEmail = idStr.includes('@')
    if (isEmail) {
      const em = idStr.trim().toLowerCase()
      try {
        await signInWithEmailAndPassword(auth, em, password)
        user = list.find(u => (u.email || '').toLowerCase() === em)
        if (!user) throw new Error('Driver profile not found')
      } catch (e) {
        // Fallback to legacy DB phone login if needed
        const phoneNorm = idStr.replace(/\D+/g, '')
        user = list.find(u => String(u.phone || '').replace(/\D+/g, '') === phoneNorm && u.password === password)
      }
    } else {
      const phoneNorm = idStr.replace(/\D+/g, '')
      user = list.find(u => String(u.phone || '').replace(/\D+/g, '') === phoneNorm && u.password === password)
    }
  } else {
    const em = (identifier || '').trim().toLowerCase()
    // Prefer Firebase Auth for students
    try {
      await signInWithEmailAndPassword(auth, em, password)
      user = list.find(u => (u.email || '').toLowerCase() === em)
      if (!user) throw new Error('Student profile not found')
    } catch (e) {
      // Fall back to legacy DB auth for existing users
      user = list.find(u => (u.email || '').toLowerCase() === em && u.password === password)
    }
  }
  if (!user) throw new Error('Invalid credentials')
  const baseSession = { id: user.id, role: user.role, email: user.email, name: user.name }
  if (roleKey === 'driver' && user.busNo) baseSession.busNo = user.busNo
  setSession(baseSession)
  try { localStorage.removeItem(KEY_LOGOUT_FLAG) } catch {}
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
  try { localStorage.setItem(KEY_LOGOUT_FLAG, '1') } catch {}
  try { signOut(auth).catch(() => {}) } catch {}
}

export async function updateProfile(updates){
  const session = getSession()
  if (!session) throw new Error('Not signed in')
  const roleKey = session.role === 'driver' ? 'driver' : (session.role === 'admin' ? 'admin' : 'student')
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

// Helper: reset driver password by phone (demo only; add OTP/verification in production)
export async function resetDriverPassword(phone, newPassword){
  const snap = await get(ref(db, 'users/driver'))
  const list = Object.values(snap.val() || {})
  const phoneNorm = String(phone || '').replace(/\D+/g, '')
  const user = list.find(u => String(u.phone || '').replace(/\D+/g, '') === phoneNorm)
  if (!user) throw new Error('Driver not found for this phone')
  await update(ref(db, `users/driver/${user.id}`), { password: newPassword })
  // refresh cache
  const idx = (cache.driver || []).findIndex(u => u.id === user.id)
  if (idx >= 0) {
    cache.driver[idx] = { ...cache.driver[idx], password: newPassword }
    cache.driver = [...cache.driver]
  }
  return true
}

// Reset student password by email
export async function resetStudentPassword(email, newPassword){
  const em = (email || '').trim().toLowerCase()
  const snap = await get(ref(db, 'users/student'))
  const list = Object.values(snap.val() || {})
  const user = list.find(u => (u.email || '').toLowerCase() === em)
  if (!user) throw new Error('Student not found for this email')
  await update(ref(db, `users/student/${user.id}`), { password: newPassword })
  // refresh cache
  const idx = (cache.student || []).findIndex(u => u.id === user.id)
  if (idx >= 0) {
    cache.student[idx] = { ...cache.student[idx], password: newPassword }
    cache.student = [...cache.student]
  }
  return true
}

// Reset admin password by email
export async function resetAdminPassword(email, newPassword){
  const em = (email || '').trim().toLowerCase()
  const snap = await get(ref(db, 'users/admin'))
  const list = Object.values(snap.val() || {})
  const user = list.find(u => (u.email || '').toLowerCase() === em)
  if (!user) throw new Error('Admin not found for this email')
  await update(ref(db, `users/admin/${user.id}`), { password: newPassword })
  // refresh cache
  const idx = (cache.admin || []).findIndex(u => u.id === user.id)
  if (idx >= 0) {
    cache.admin[idx] = { ...cache.admin[idx], password: newPassword }
    cache.admin = [...cache.admin]
  }
  return true
}

// Parent password reset removed — parents use roll number only

// Firebase Auth email reset (students/admins with email accounts)
function mapResetEmailError(err){
  const code = err?.code || ''
  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/user-not-found':
      return 'No account found with this email.'
    case 'auth/configuration-not-found':
      return 'Password reset email is not fully configured for this Firebase project. Set a Support email in Project settings, enable Email/Password sign-in, and save the Password reset template.'
    case 'auth/invalid-continue-uri':
      return 'The reset link URL is invalid or not authorized. Add your site domain to Authentication → Settings → Authorized domains.'
    default:
      return err?.message || 'Failed to send reset email'
  }
}

export async function sendStudentPasswordResetEmail(email){
  const em = (email || '').trim().toLowerCase()
  if (!em) throw new Error('Email is required')
  try {
    const url = (typeof window !== 'undefined' && window.location && window.location.origin)
      ? `${window.location.origin}/login/student`
      : 'http://localhost:5173/login/student'
    await sendPasswordResetEmail(auth, em, { url })
    return true
  } catch (err) {
    throw new Error(mapResetEmailError(err))
  }
}

export async function sendAdminPasswordResetEmail(email){
  const em = (email || '').trim().toLowerCase()
  if (!em) throw new Error('Email is required')
  try {
    const url = (typeof window !== 'undefined' && window.location && window.location.origin)
      ? `${window.location.origin}/login/admin`
      : 'http://localhost:5173/login/admin'
    await sendPasswordResetEmail(auth, em, { url })
    return true
  } catch (err) {
    throw new Error(mapResetEmailError(err))
  }
}

// Driver password reset via email
export async function sendDriverPasswordResetEmail(email){
  const em = (email || '').trim().toLowerCase()
  if (!em) throw new Error('Email is required')
  try {
    const url = (typeof window !== 'undefined' && window.location && window.location.origin)
      ? `${window.location.origin}/login/driver`
      : 'http://localhost:5173/login/driver'
    await sendPasswordResetEmail(auth, em, { url })
    return true
  } catch (err) {
    throw new Error(mapResetEmailError(err))
  }
}
