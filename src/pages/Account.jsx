import React, { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSession, logout, updateProfile, getUsers } from '../utils/auth'
import { buildRouteForNow } from '../utils/routeLogic'
import { getBus, onBus } from '../utils/busData'

export default function Account(){
  const navigate = useNavigate()
  const session = getSession()
  const [form, setForm] = useState({ name: session?.name || '', email: session?.email || '' })
  // student-specific editable fields
  const [studentForm, setStudentForm] = useState({ rollNo: '', parentPhone: '', stop: '', busNo: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // hydrate student fields if applicable
  useEffect(() => {
    if (session?.role === 'student'){
      try {
        const students = getUsers('student') || []
        const me = students.find(s => s.id === session.id)
        setStudentForm({
          rollNo: me?.rollNo || '',
          parentPhone: me?.parentPhone || '',
          stop: me?.stop || '',
          busNo: me?.busNo || ''
        })
      } catch {}
    }
  }, [])

  // route/stop options based on current bus
  const routeNow = useMemo(() => buildRouteForNow(), [])
  const validBus = useMemo(() => {
    const target = (getBus()?.id || '').trim().toLowerCase()
    const entered = (studentForm.busNo || '').trim().toLowerCase()
    return !!target && !!entered && entered === target
  }, [studentForm.busNo])
  useEffect(() => {
    const off = onBus(() => {})
    return off
  }, [])
  const stopOptions = useMemo(() => validBus ? ((routeNow?.orderedStops || []).map(s => s.name)) : [], [routeNow, validBus])
  useEffect(() => {
    if (session?.role !== 'student') return
    if (!validBus) return
    if (validBus && stopOptions.length && !stopOptions.includes(studentForm.stop)){
      setStudentForm(f => ({ ...f, stop: stopOptions[0] }))
    }
  }, [validBus, stopOptions])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!session) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updates = { name: form.name, email: form.email }
      if (session.role === 'student'){
        updates.rollNo = studentForm.rollNo
        updates.parentPhone = studentForm.parentPhone
        updates.stop = studentForm.stop
      }
      await Promise.resolve(updateProfile(updates))
      setMessage('Profile updated')
    } catch (e) {
      setError(e.message || 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = () => {
    logout()
    navigate('/')
  }

  if (!session){
    return (
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Account</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded shadow">
            <h3 className="font-semibold mb-2">Student</h3>
            <div className="text-sm text-gray-600 mb-4">Sign in to view live bus status and timelines.</div>
            <div className="flex items-center gap-3">
              <Link to="/login/student" className="px-3 py-2 bg-indigo-600 text-white rounded">Sign in</Link>
              <Link to="/register/student" className="px-3 py-2 border rounded">Create account</Link>
            </div>
          </div>
          <div className="bg-white p-5 rounded shadow">
            <h3 className="font-semibold mb-2">Driver</h3>
            <div className="text-sm text-gray-600 mb-4">Sign in to start sharing live bus location.</div>
            <div className="flex items-center gap-3">
              <Link to="/login/driver" className="px-3 py-2 bg-indigo-600 text-white rounded">Sign in</Link>
              <Link to="/register/driver" className="px-3 py-2 border rounded">Create account</Link>
            </div>
          </div>
          <div className="bg-white p-5 rounded shadow">
            <h3 className="font-semibold mb-2">Parent</h3>
            <div className="text-sm text-gray-600 mb-4">Track your child's bus using parent phone and roll number.</div>
            <div className="flex items-center gap-3">
              <Link to="/login/parent" className="px-3 py-2 bg-indigo-600 text-white rounded">Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Account</h2>
        <button onClick={handleSignOut} className="px-3 py-2 bg-red-600 text-white rounded">Sign out</button>
      </div>

      <form onSubmit={handleSave} className="bg-white p-6 rounded shadow space-y-6">
        <section>
          <h3 className="text-lg font-medium mb-3">Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col">
              <span className="text-sm text-gray-600">Name</span>
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="mt-1 p-2 border rounded" />
            </label>
            <label className="flex flex-col">
              <span className="text-sm text-gray-600">Email</span>
              <input value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} className="mt-1 p-2 border rounded" />
            </label>
            <div className="md:col-span-2 text-sm text-gray-600">
              <span className="font-medium">Role:</span> <span className="capitalize">{session.role}</span>
            </div>
          </div>
        </section>

        {session.role === 'student' && (
          <section>
            <h3 className="text-lg font-medium mb-3">Student details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col">
                <span className="text-sm text-gray-600">Bus ID</span>
                <input value={studentForm.busNo} readOnly className="mt-1 p-2 border rounded bg-gray-50" />
              </label>
              <div className="flex flex-col text-xs text-gray-600 md:pt-6">
                {validBus ? (
                  <span>Stops loaded from current route.</span>
                ) : (
                  <span>Stop dropdown is available when your Bus ID matches the active bus.</span>
                )}
              </div>

              <label className="flex flex-col">
                <span className="text-sm text-gray-600">Roll number</span>
                <input value={studentForm.rollNo} onChange={e => setStudentForm(p => ({...p, rollNo: e.target.value}))} className="mt-1 p-2 border rounded" />
              </label>
              <label className="flex flex-col">
                <span className="text-sm text-gray-600">Parent phone</span>
                <input value={studentForm.parentPhone} onChange={e => setStudentForm(p => ({...p, parentPhone: e.target.value}))} className="mt-1 p-2 border rounded" />
              </label>

              {validBus ? (
                <label className="flex flex-col md:col-span-2">
                  <span className="text-sm text-gray-600">Stop</span>
                  <select value={studentForm.stop} onChange={e => setStudentForm(p => ({...p, stop: e.target.value}))} className="mt-1 p-2 border rounded">
                    {stopOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              ) : (
                <label className="flex flex-col md:col-span-2">
                  <span className="text-sm text-gray-600">Stop</span>
                  <input value={studentForm.stop} onChange={e => setStudentForm(p => ({...p, stop: e.target.value}))} className="mt-1 p-2 border rounded" placeholder="Enter your stop" />
                </label>
              )}
            </div>
          </section>
        )}

        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
        {message && <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{message}</div>}

        <div className="flex items-center gap-3">
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
          <button type="button" onClick={() => navigate('/')} className="px-4 py-2 bg-white border rounded">Cancel</button>
        </div>
      </form>
    </div>
  )
}
