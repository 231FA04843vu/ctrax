import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../../utils/auth'

export default function DriverRegister(){
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', busNo: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!form.busNo.trim()) throw new Error('Bus ID is required')
      await Promise.resolve(register('driver', form))
      nav('/driver')
    } catch (e) {
      setError(e.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Create Driver Account</h2>
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-gray-700">Full name</span>
          <input className="mt-1 w-full border rounded px-3 py-2" value={form.name} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} required />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Email</span>
          <input type="email" className="mt-1 w-full border rounded px-3 py-2" value={form.email} onChange={e=>setForm(f=>({ ...f, email: e.target.value }))} required />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Bus ID (required, connects students)</span>
          <input className="mt-1 w-full border rounded px-3 py-2" value={form.busNo} onChange={e=>setForm(f=>({ ...f, busNo: e.target.value }))} required />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Phone</span>
          <input className="mt-1 w-full border rounded px-3 py-2" value={form.phone} onChange={e=>setForm(f=>({ ...f, phone: e.target.value }))} />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Password</span>
          <input type="password" className="mt-1 w-full border rounded px-3 py-2" value={form.password} onChange={e=>setForm(f=>({ ...f, password: e.target.value }))} required />
        </label>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded">{loading ? 'Creating...' : 'Create account'}</button>
      </form>
      <div className="mt-4 text-sm text-gray-700 flex items-center justify-between">
        <Link to="/login/driver" className="text-indigo-700 hover:underline">Already have an account?</Link>
        <Link to="/register/student" className="hover:underline">Student register</Link>
      </div>
    </div>
  )
}
