import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../../utils/auth'

export default function StudentLogin(){
  const nav = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await Promise.resolve(login('student', form.email, form.password))
      nav('/student')
    } catch (e) {
      setError(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Student Login</h2>
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-gray-700">Email</span>
          <input type="email" className="mt-1 w-full border rounded px-3 py-2" value={form.email} onChange={e=>setForm(f=>({ ...f, email: e.target.value }))} required />
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
        <Link to="/register/student" className="text-indigo-700 hover:underline">Create account</Link>
        <Link to="/reset/student" className="hover:underline">Forgot password?</Link>
      </div>
    </div>
  )
}
