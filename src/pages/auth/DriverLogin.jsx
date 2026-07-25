import React, { useState, useEffect } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { login, isRole, getSession } from '../../utils/auth'
import { requestLocationPermission } from '../../utils/geolocation'

export default function DriverLogin(){
  const nav = useNavigate()
  const [form, setForm] = useState({ phone: '', password: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [locationError, setLocationError] = useState('')
  const [sessionChecked, setSessionChecked] = useState(false)
  
  // Check if already logged in as driver
  useEffect(() => {
    const session = getSession()
    if (session && isRole('driver')) {
      console.log('✅ Driver already logged in, redirecting to dashboard')
      nav('/driver', { replace: true })
    } else {
      setSessionChecked(true)
    }
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLocationError('')
    setLoading(true)
    try {
      // First attempt to get location permission
      const locationGranted = await requestLocationPermission()
      if (!locationGranted) {
        setLocationError('Location services are required for driver tracking. Please enable location access in your device settings.')
        setLoading(false)
        return
      }

      // Then perform login
      await Promise.resolve(login('driver', form.phone, form.password))
      nav('/driver')
    } catch (e) {
      setError(e.message || 'Login failed')
      setLoading(false)
    }
  }
  
  // If still checking session, show loading state
  if (!sessionChecked) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Driver Login</h2>
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      {locationError && <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">{locationError}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-gray-700">Phone number</span>
          <input type="tel" className="mt-1 w-full border rounded px-3 py-2" value={form.phone} onChange={e=>setForm(f=>({ ...f, phone: e.target.value }))} required />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Password</span>
          <div className="relative">
            <input type={show ? 'text' : 'password'} className="mt-1 w-full border rounded px-3 py-2 pr-20" value={form.password} onChange={e=>setForm(f=>({ ...f, password: e.target.value }))} required />
            <button type="button" onClick={() => setShow(s=>!s)} className="absolute right-2 top-1.5 px-2 py-1 text-xs border rounded">{show ? 'Hide' : 'Show'}</button>
          </div>
        </label>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded">{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
      <div className="mt-4 text-sm text-gray-700 flex items-center justify-between">
        <Link to="/register/driver" className="text-indigo-700 hover:underline">Apply</Link>
        <Link to="/reset/driver" className="hover:underline">Forgot password?</Link>
      </div>
    </div>
  )
}
