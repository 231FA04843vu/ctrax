import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { sendStudentPasswordResetEmail } from '../../utils/auth'

export default function StudentResetPassword(){
  const [form, setForm] = useState({ email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(''); setMessage('')
    setLoading(true)
    try {
  await sendStudentPasswordResetEmail(form.email)
  setMessage('Password reset email sent. Check your inbox for the link. If you don\'t see it shortly, check your Spam/Junk folder and mark it as Not Spam.')
    } catch (e) {
      setError(e.message || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Reset Student Password</h2>
      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      {message && <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{message}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-gray-700">Email</span>
          <input type="email" className="mt-1 w-full border rounded px-3 py-2" value={form.email} onChange={e=>setForm(f=>({ ...f, email: e.target.value }))} required />
        </label>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded">{loading ? 'Sending...' : 'Send reset link'}</button>
      </form>
      <div className="mt-3 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2">
        Didn\'t get the email? Check your Spam/Junk folder and search for "password reset" or "CTraX". If found, mark as Not Spam.
      </div>
      <div className="mt-4 text-sm text-gray-700 flex items-center justify-between">
        <Link to="/login/student" className="hover:underline">Back to login</Link>
      </div>
    </div>
  )
}
