import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../../utils/auth'

export default function DriverLogin(){
  const nav = useNavigate()
  const [form, setForm] = useState({ phone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await Promise.resolve(login('driver', form.phone, form.password))
      nav('/driver')
    } catch (e) {
      setError(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Driver Login</h2>
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-gray-700">Phone number</span>
          <input type="tel" className="mt-1 w-full border rounded px-3 py-2" value={form.phone} onChange={e=>setForm(f=>({ ...f, phone: e.target.value }))} required />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Password</span>
          <input type="password" className="mt-1 w-full border rounded px-3 py-2" value={form.password} onChange={e=>setForm(f=>({ ...f, password: e.target.value }))} required />
        </label>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded">{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
      <div className="mt-4 text-sm text-gray-700 flex items-center justify-between">
        <Link to="/register/driver" className="text-indigo-700 hover:underline">Create account</Link>
        <Link to="/login/student" className="hover:underline">Student login</Link>
      </div>
    </div>
  )
}
