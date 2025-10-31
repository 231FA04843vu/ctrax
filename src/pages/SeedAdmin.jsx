import React, { useState, useEffect } from 'react'
import { ref, get, set } from 'firebase/database'
import { db, auth } from '../utils/firebase'
import { createUserWithEmailAndPassword } from 'firebase/auth'

// ONE-TIME ADMIN SEEDER
// Visit /__seed_admin locally, fill the form, click Seed. Then delete this file and its route.
export default function SeedAdmin(){
  const [exists, setExists] = useState(false)
  const [checking, setChecking] = useState(true)
  const [form, setForm] = useState({ name: 'Administrator', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const snap = await get(ref(db, 'users/admin'))
        const data = snap.val() || {}
        setExists(Object.keys(data).length > 0)
      } catch (e) {
        setError(e.message || 'Failed to check admin users')
      } finally {
        setChecking(false)
      }
    })()
  }, [])

  const onSeed = async (e) => {
    e.preventDefault()
    setError(''); setMessage('')
    if (!form.email || !form.password) {
      setError('Email and password are required')
      return
    }
    setLoading(true)
    try {
      // re-check to avoid race
      const snap = await get(ref(db, 'users/admin'))
      const data = snap.val() || {}
      if (Object.keys(data).length > 0) {
        setExists(true)
        setMessage('Admin already exists. No action needed.')
        return
      }
      const id = `admin-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
      const adminUser = {
        id,
        role: 'admin',
        name: form.name || 'Administrator',
        email: form.email.trim().toLowerCase(),
        password: form.password,
        createdAt: Date.now()
      }
      // Create Auth user if not present; ignore if already exists
      try {
        await createUserWithEmailAndPassword(auth, adminUser.email, form.password)
      } catch (e) {
        // if email exists, continue to write profile
      }
      await set(ref(db, `users/admin/${id}`), adminUser)
      setExists(true)
      setMessage('Admin user seeded successfully. You can now delete this file and route.')
    } catch (e) {
      setError(e.message || 'Failed to seed admin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow mt-10">
      <h2 className="text-2xl font-semibold mb-1">Seed Admin</h2>
      <p className="text-sm text-gray-600 mb-4">One-time setup to create the first admin in Firebase.</p>
      {checking ? (
        <div className="text-gray-600">Checking existing admin...</div>
      ) : exists ? (
        <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
          Admin already exists. You can remove this page.
        </div>
      ) : (
        <form onSubmit={onSeed} className="space-y-3">
          {error && <div className="text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
          {message && <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{message}</div>}
          <label className="block text-sm">
            <span className="text-gray-700">Name</span>
            <input className="mt-1 w-full border rounded px-3 py-2" value={form.name} onChange={e=>setForm(f=>({...f, name: e.target.value}))} />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Email</span>
            <input type="email" className="mt-1 w-full border rounded px-3 py-2" value={form.email} onChange={e=>setForm(f=>({...f, email: e.target.value}))} required />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Password</span>
            <input type="password" className="mt-1 w-full border rounded px-3 py-2" value={form.password} onChange={e=>setForm(f=>({...f, password: e.target.value}))} required />
          </label>
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded">{loading ? 'Seeding...' : 'Seed admin'}</button>
        </form>
      )}
    </div>
  )
}
