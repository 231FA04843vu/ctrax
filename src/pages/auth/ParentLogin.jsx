import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginParent } from '../../utils/auth'

export default function ParentLogin(){
  const nav = useNavigate()
  const [form, setForm] = useState({ parentPhone: '', rollNo: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await Promise.resolve(loginParent(form.parentPhone, form.rollNo))
      nav('/parent')
    } catch (e) {
      setError(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Parent Login</h2>
      <p className="text-sm text-gray-600 mb-4">Use the registered parent phone and your child’s roll number as the password.</p>
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-gray-700">Parent phone</span>
          <input className="mt-1 w-full border rounded px-3 py-2" value={form.parentPhone} onChange={e=>setForm(f=>({ ...f, parentPhone: e.target.value }))} required />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Roll number (password)</span>
          <input className="mt-1 w-full border rounded px-3 py-2" value={form.rollNo} onChange={e=>setForm(f=>({ ...f, rollNo: e.target.value }))} required />
        </label>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded">{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
      <div className="mt-4 text-sm text-gray-700 flex items-center justify-between">
        <Link to="/login/student" className="hover:underline">Student login</Link>
        <Link to="/login/driver" className="hover:underline">Driver login</Link>
      </div>
    </div>
  )
}
