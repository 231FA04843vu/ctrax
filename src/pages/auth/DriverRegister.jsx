import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { applyDriverApplication } from '../../utils/admin'

export default function DriverRegister(){
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', licenseNo: '', password: '', confirm: '', notes: ''})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [agree, setAgree] = useState(false)

  // Live password/confirm feedback
  const passLen = (form.password || '').length
  const passOk = passLen >= 6
  const passClass = `mt-1 w-full border rounded px-3 py-2 ${form.password ? (passOk ? 'border-emerald-500 focus:ring-emerald-500' : 'border-red-500 focus:ring-red-500') : ''}`
  const confirmLen = (form.confirm || '').length
  const confirmOk = confirmLen >= 6 && form.confirm === form.password
  const confirmClass = `mt-1 w-full border rounded px-3 py-2 ${confirmLen ? (confirmOk ? 'border-emerald-500 focus:ring-emerald-500' : 'border-red-500 focus:ring-red-500') : ''}`

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
  if (!agree) throw new Error('Please accept the Terms and Privacy Policy to continue')
  if (!form.password || form.password.length < 6) throw new Error('Password must be at least 6 characters (Firebase requirement)')
  if (form.password !== form.confirm) throw new Error('Passwords do not match')
  await Promise.resolve(applyDriverApplication(form))
  setMessage('Application submitted. Admin will assign your Bus ID, route, and stops. After approval you can log in using the password you set.')
  setTimeout(() => nav('/login/driver'), 1500)
    } catch (e) {
      setError(e.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
  <h2 className="text-2xl font-semibold mb-1">Driver Application</h2>
  <p className="text-sm text-gray-600 mb-4">Submit your details. Admin will approve or reject your request.</p>
  {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
  {message && <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{message}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-gray-700">Full name</span>
          <input className="mt-1 w-full border rounded px-3 py-2" placeholder="e.g., Shankar Rao" value={form.name} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} required />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Email</span>
          <input type="email" className="mt-1 w-full border rounded px-3 py-2" placeholder="e.g., shankar@example.com" value={form.email} onChange={e=>setForm(f=>({ ...f, email: e.target.value }))} required />
        </label>
        {/* Bus ID is assigned by admin after approval */}
        <label className="block text-sm">
          <span className="text-gray-700">Phone</span>
          <input className="mt-1 w-full border rounded px-3 py-2" placeholder="10-digit mobile number" value={form.phone} onChange={e=>setForm(f=>({ ...f, phone: e.target.value }))} />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Driving Licence Number</span>
          <input className="mt-1 w-full border rounded px-3 py-2" placeholder="e.g., AP01 2021 0001234" value={form.licenseNo} onChange={e=>setForm(f=>({ ...f, licenseNo: e.target.value }))} required />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Set password</span>
          <input type="password" minLength={6} className={passClass} placeholder="Choose a password (min 6 characters)" value={form.password} onChange={e=>setForm(f=>({ ...f, password: e.target.value }))} required />
          <p className={`mt-1 text-xs ${form.password ? (passOk ? 'text-emerald-600' : 'text-red-600') : 'text-gray-500'}`}>Password must be at least 6 characters.</p>
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Confirm password</span>
          <input type="password" minLength={6} className={confirmClass} placeholder="Re-enter password" value={form.confirm} onChange={e=>setForm(f=>({ ...f, confirm: e.target.value }))} required />
          {confirmLen > 0 && (
            <p className={`mt-1 text-xs ${confirmOk ? 'text-emerald-600' : 'text-red-600'}`}>{confirmOk ? 'Passwords match.' : 'Passwords do not match.'}</p>
          )}
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Notes (optional)</span>
          <input className="mt-1 w-full border rounded px-3 py-2" placeholder="Anything the admin should know (optional)" value={form.notes} onChange={e=>setForm(f=>({ ...f, notes: e.target.value }))} />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={agree} onChange={e=>setAgree(e.target.checked)} />
          <span className="text-gray-700">
            I have read and agree to the
            {' '}<Link to="/terms" className="text-indigo-700 hover:underline" target="_blank" rel="noreferrer">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-indigo-700 hover:underline" target="_blank" rel="noreferrer">Privacy Policy</Link>.
          </span>
        </label>
        <button type="submit" disabled={loading || !agree} className={`w-full py-2 rounded ${loading || !agree ? 'bg-indigo-300 text-white cursor-not-allowed' : 'bg-indigo-600 text-white'}`}>{loading ? 'Submitting...' : 'Apply'}</button>
      </form>
      <div className="mt-4 text-sm text-gray-700 flex items-center justify-between">
        <Link to="/login/driver" className="text-indigo-700 hover:underline">Back to driver login</Link>
      </div>
    </div>
  )
}
