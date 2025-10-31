// Admin utilities for managing driver applications and basic notifications (SMS stub)
import { db } from './firebase'
import { ref, set, get, update, onValue, remove } from 'firebase/database'
import { register } from './auth'

const APPS_PATH = 'applications/driver'

// Submit a new driver application (public)
export async function applyDriverApplication(payload){
  const id = `app-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
  const app = {
    id,
    name: payload.name?.trim() || '',
    email: (payload.email || '').trim().toLowerCase(),
    phone: payload.phone || '',
    busNo: payload.busNo || '',
    licenseNo: (payload.licenseNo || payload.license || '').trim(),
    password: (payload.password || '').trim(),
    notes: payload.notes || '',
    status: 'pending',
    createdAt: Date.now()
  }
  await set(ref(db, `${APPS_PATH}/${id}`), app)
  return app
}

// Subscribe to all driver applications (admin)
export function onDriverApplications(callback){
  const r = ref(db, APPS_PATH)
  return onValue(r, (snap) => {
    const val = snap.val() || {}
    // Auto-clean any non-pending applications (approved/rejected) that might remain from older versions
    Object.values(val).forEach(app => {
      if (app?.status === 'rejected' || app?.status === 'approved') {
        try { remove(ref(db, `${APPS_PATH}/${app.id}`)) } catch {}
      }
    })
    // Provide only pending items to the UI
    const list = Object.values(val)
      .filter(a => (a?.status ?? 'pending') === 'pending')
      .sort((a,b) => b.createdAt - a.createdAt)
    try { callback(list) } catch {}
  })
}

export async function deleteDriverApplication(id){
  await remove(ref(db, `${APPS_PATH}/${id}`))
}

// Approve: create driver account and mark application approved
export async function approveDriverApplication(app, options = {}){
  const password = (app.password && String(app.password)) || options.password || generatePassword()
  // Create driver user using auth.register('driver')
  const userPayload = {
    name: app.name,
    email: app.email,
    password,
    phone: app.phone,
    busNo: app.busNo,
    licenseNo: app.licenseNo || ''
  }
  await register('driver', userPayload, { noSession: true })
  // Delete the application after approval so it is removed from the approvals list
  try {
    await remove(ref(db, `${APPS_PATH}/${app.id}`))
  } catch (e) {
    // As a fallback, at least mark as approved
    try { await update(ref(db, `${APPS_PATH}/${app.id}`), { status: 'approved', approvedAt: Date.now() }) } catch {}
  }
  // Send credentials via SMS stub
  try {
    await sendSmsStub(app.phone, `Your driver account is approved. Login with phone: ${app.phone} and password: ${password}.`) // demo only
  } catch {}
  return { password }
}

export async function rejectDriverApplication(app, reason = ''){
  // Delete the application entirely after rejection so it is removed from the approvals list
  try {
    // Optionally, one could archive the rejection somewhere else; for now, delete as requested
    await remove(ref(db, `${APPS_PATH}/${app.id}`))
  } catch (e) {
    // As a fallback, at least mark as rejected so UI can hide it if needed
    try { await update(ref(db, `${APPS_PATH}/${app.id}`), { status: 'rejected', rejectedAt: Date.now(), reason }) } catch {}
  }
}

export function generatePassword(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random()*chars.length)]
  return out
}

// SMS stub — replace with a provider like Twilio or Firebase Extensions in production
export async function sendSmsStub(phone, message){
  // eslint-disable-next-line no-console
  console.log('[SMS]', phone, message)
  return true
}

// Assign a bus to an existing active driver (admin-only action)
export async function assignDriverToBus(driverId, busId){
  const id = String(driverId || '')
  const bus = String(busId || '')
  if (!id) throw new Error('Driver ID is required')
  // Allow clearing assignment by passing empty bus string
  await update(ref(db, `users/driver/${id}`), { busNo: bus })
  return true
}

export default {
  applyDriverApplication,
  onDriverApplications,
  approveDriverApplication,
  rejectDriverApplication,
  deleteDriverApplication,
  generatePassword,
  sendSmsStub,
  assignDriverToBus,
}
