import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../../utils/auth'
import { listBuses, onBuses } from '../../utils/busData'
import { onStopsFor, getStopsFor, getStops } from '../../utils/routeData'

export default function StudentRegister(){
  const nav = useNavigate()
  const [form, setForm] = useState({
    name: '',
    rollNo: '',
    email: '',
    phone: '',
    parentPhone: '',
    busNo: '',
    stop: '',
    password: ''
  })
  const [buses, setBuses] = useState(() => listBuses())
  const [busStops, setBusStops] = useState([])
  useEffect(() => {
    const off = onBuses((list) => setBuses(list))
    return off
  }, [])
  const stopOptions = useMemo(() => (busStops || []).map(s => s.name), [busStops])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)
  const [agree, setAgree] = useState(false)
  const passLen = (form.password || '').length
  const passOk = passLen >= 6
  const passClass = `mt-1 w-full border rounded px-3 py-2 pr-20 ${form.password ? (passOk ? 'border-emerald-500 focus:ring-emerald-500' : 'border-red-500 focus:ring-red-500') : ''}`

  useEffect(() => {
    // subscribe to stops for the selected bus
    if (!form.busNo) {
      setBusStops([])
      if (form.stop) setForm(f => ({ ...f, stop: '' }))
      return
    }
    // seed immediate snapshot then subscribe for live updates
    const prime = getStopsFor(form.busNo)
    if (Array.isArray(prime) && prime.length) {
      setBusStops(prime)
    } else {
      // Fallback to global route stops until admin configures per-bus
      setBusStops(getStops())
    }
    const off = onStopsFor(form.busNo, (stops) => {
      if (Array.isArray(stops) && stops.length) {
        setBusStops(stops)
      } else {
        setBusStops(getStops())
      }
    })
    return off
  }, [form.busNo])

  useEffect(() => {
    // ensure selected stop remains valid when list updates
    if (!form.busNo) return
    if (stopOptions.length && !stopOptions.includes(form.stop)){
      setForm(f => ({ ...f, stop: stopOptions[0] }))
    }
  }, [stopOptions])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!agree) {
        throw new Error('Please accept the Terms and Privacy Policy to continue')
      }
        if (!form.busNo) {
          throw new Error('Please select your Bus ID')
        }
      if (!form.stop) {
        throw new Error('Please select your stop')
      }
      // enrich payload: store that parent login password is student's roll no (for future parent portal)
      const payload = { ...form, parentPassword: form.rollNo }
      await Promise.resolve(register('student', payload))
      nav('/student')
    } catch (e) {
      setError(e.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-semibold mb-1">Create Student Account</h2>
      <p className="text-sm text-gray-600 mb-4">Connect to your bus by entering the Bus ID and selecting your stop.</p>
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-gray-700">Full name</span>
          <input className="mt-1 w-full border rounded px-3 py-2" value={form.name} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} required />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Roll number</span>
          <input className="mt-1 w-full border rounded px-3 py-2" value={form.rollNo} onChange={e=>setForm(f=>({ ...f, rollNo: e.target.value }))} required />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Email</span>
          <input type="email" className="mt-1 w-full border rounded px-3 py-2" value={form.email} onChange={e=>setForm(f=>({ ...f, email: e.target.value }))} required />
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-gray-700">Phone</span>
            <input className="mt-1 w-full border rounded px-3 py-2" value={form.phone} onChange={e=>setForm(f=>({ ...f, phone: e.target.value }))} required />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Parent phone</span>
            <input className="mt-1 w-full border rounded px-3 py-2" value={form.parentPhone} onChange={e=>setForm(f=>({ ...f, parentPhone: e.target.value }))} required />
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-gray-700">Bus ID</span>
            <select className="mt-1 w-full border rounded px-3 py-2" value={form.busNo} onChange={e=>setForm(f=>({ ...f, busNo: e.target.value, stop: '' }))} required>
              <option value="">Select a bus</option>
              {buses.map(b => (
                <option key={b.id} value={b.id}>{b.id}{b.name ? ` — ${b.name}` : ''}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Your stop</span>
            <select className="mt-1 w-full border rounded px-3 py-2" value={form.stop} onChange={e=>setForm(f=>({ ...f, stop: e.target.value }))} disabled={!form.busNo}>
              {!form.busNo && <option value="">Select a bus first</option>}
              {form.busNo && stopOptions.length === 0 && <option value="">No stops configured</option>}
              {form.busNo && stopOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-gray-700">Password</span>
          <div className="relative">
            <input type={show ? 'text' : 'password'} minLength={6} className={passClass} value={form.password} onChange={e=>setForm(f=>({ ...f, password: e.target.value }))} required />
            <button type="button" onClick={() => setShow(s=>!s)} className="absolute right-2 top-1.5 px-2 py-1 text-xs border rounded">{show ? 'Hide' : 'Show'}</button>
          </div>
          <p className={`mt-1 text-xs ${form.password ? (passOk ? 'text-emerald-600' : 'text-red-600') : 'text-gray-500'}`}>Password must be at least 6 characters.</p>
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
        <button type="submit" disabled={loading || !agree} className={`w-full py-2 rounded ${loading || !agree ? 'bg-indigo-300 text-white cursor-not-allowed' : 'bg-indigo-600 text-white'}`}>{loading ? 'Creating...' : 'Create account'}</button>
      </form>
      <div className="mt-4 text-sm text-gray-700 flex items-center justify-between">
        <Link to="/login/student" className="text-indigo-700 hover:underline">Already have an account?</Link>
      </div>
    </div>
  )
}
