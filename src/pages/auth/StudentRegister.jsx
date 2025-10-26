import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../../utils/auth'
import { buildRouteForNow } from '../../utils/routeLogic'
import { getBus, onBus } from '../../utils/busData'

export default function StudentRegister(){
  const nav = useNavigate()
  const routeNow = useMemo(() => buildRouteForNow(), [])
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
  const validBus = useMemo(() => {
    const target = (getBus()?.id || '').trim().toLowerCase()
    const entered = (form.busNo || '').trim().toLowerCase()
    return !!target && entered && entered === target
  }, [form.busNo])
  useEffect(() => {
    const off = onBus(() => {})
    return off
  }, [])
  const stopOptions = useMemo(() => validBus ? ((routeNow?.orderedStops || []).map(s => s.name)) : [], [routeNow, validBus])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!validBus) {
      if (form.stop) setForm(f => ({ ...f, stop: '' }))
      return
    }
    if (validBus && stopOptions.length && !stopOptions.includes(form.stop)){
      setForm(f => ({ ...f, stop: stopOptions[0] }))
    }
  }, [validBus, stopOptions])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!validBus) {
        throw new Error('Enter a valid Bus ID to select your stop')
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
            <span className="text-gray-700">Bus ID (ask driver)</span>
            <input className="mt-1 w-full border rounded px-3 py-2" value={form.busNo} onChange={e=>setForm(f=>({ ...f, busNo: e.target.value }))} placeholder={getBus()?.id || ''} required />
          </label>
          {validBus ? (
            <label className="block text-sm">
              <span className="text-gray-700">Your stop</span>
              <select className="mt-1 w-full border rounded px-3 py-2" value={form.stop} onChange={e=>setForm(f=>({ ...f, stop: e.target.value }))}>
                {stopOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          ) : (
            <div className="text-xs text-gray-600 self-end mb-1">Enter a valid Bus ID to pick your stop.</div>
          )}
        </div>
        <label className="block text-sm">
          <span className="text-gray-700">Password</span>
          <input type="password" className="mt-1 w-full border rounded px-3 py-2" value={form.password} onChange={e=>setForm(f=>({ ...f, password: e.target.value }))} required />
        </label>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded">{loading ? 'Creating...' : 'Create account'}</button>
      </form>
      <div className="mt-4 text-sm text-gray-700 flex items-center justify-between">
        <Link to="/login/student" className="text-indigo-700 hover:underline">Already have an account?</Link>
        <Link to="/register/driver" className="hover:underline">Driver register</Link>
      </div>
    </div>
  )
}
