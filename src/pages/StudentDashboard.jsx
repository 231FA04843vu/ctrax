import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import MapView from '../shared/MapView'
import BusList from '../shared/BusList'
import LiveTimeline from '../shared/LiveTimeline'
import { isRole, logout, getSession, getUsers, updateProfile } from '../utils/auth'
import { useI18n } from '../i18n/i18n.jsx'
import { buildRouteForNow } from '../utils/routeLogic'
import { onStopsFor, onStops } from '../utils/routeData'
import { onBus } from '../utils/busData'
import { subscribeToTopic } from '../utils/notifications'

export default function StudentDashboard(){
  const { t } = useI18n()
  if (!isRole('student')) {
    return <Navigate to="/login/student" replace />
  }
  const navigate = useNavigate()
  const session = getSession()
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimerRef = useRef(null)
  const [form, setForm] = useState({
    busNo: '',
    rollNo: '',
    parentPhone: '',
    stop: ''
  })

  // hydrate student details from storage
  useEffect(() => {
    try {
      const students = getUsers('student') || []
      const me = students.find(s => s.id === session.id)
      if (me){
        setForm({
          busNo: me.busNo || '',
          rollNo: me.rollNo || '',
          parentPhone: me.parentPhone || '',
          stop: me.stop || ''
        })
      }
    } catch {}
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  // Auto-subscribe to student topic when notifications are enabled
  useEffect(() => {
    const STORAGE_KEY = 'ctrax_notifications_enabled'
    const TOKEN_KEY = 'ctrax_notifications_token'
    const subscribedKey = `ctrax_subscribed_student_${session.id}`

    async function doSubscribe(token) {
      try {
        // avoid double subscribing
        const already = window.localStorage.getItem(subscribedKey)
        if (already === '1') return
        const topic = `student-${session.id}`
        await subscribeToTopic(token, topic)
        try { window.localStorage.setItem(subscribedKey, '1') } catch {}
      } catch (err) {
        console.warn('Failed to subscribe student topic', err)
      }
    }

    // If enabled and token present, subscribe immediately
    try {
      const enabled = window.localStorage.getItem(STORAGE_KEY) === '1'
      const token = window.localStorage.getItem(TOKEN_KEY)
      if (enabled && token) doSubscribe(token)
    } catch (e) {}

    // Listen for enable event (EnableNotifications will dispatch this)
    function onEnabled(e) {
      const token = e?.detail?.token
      if (token) doSubscribe(token)
    }
    window.addEventListener('ctrax:notifications:enabled', onEnabled)
    return () => window.removeEventListener('ctrax:notifications:enabled', onEnabled)
  }, [session.id])

  // route/stop dropdown logic
  const busId = (form.busNo || '').trim()
  const [stopsTick, setStopsTick] = useState(0)
  useEffect(() => {
    if (busId) return onStopsFor(busId, () => setStopsTick(t => t + 1))
    return onStops(() => setStopsTick(t => t + 1))
  }, [busId])
  const routeNow = useMemo(() => buildRouteForNow(busId || null), [busId, stopsTick])
  const validBus = useMemo(() => {
    return !!busId && (routeNow?.orderedStops || []).length > 1
  }, [busId, routeNow])
  // No need to subscribe to global bus anymore for validity
  const stopOptions = useMemo(() => validBus ? ((routeNow?.orderedStops || []).map(s => s.name)) : [], [routeNow, validBus])
  useEffect(() => {
    if (!validBus) return
    if (validBus && stopOptions.length && !stopOptions.includes(form.stop)){
      setForm(f => ({ ...f, stop: stopOptions[0] }))
    }
  }, [validBus, stopOptions])

  const onChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    setSaved(false)
  }
  const onSave = async () => {
    try {
      await Promise.resolve(updateProfile({
        rollNo: form.rollNo,
        parentPhone: form.parentPhone,
        stop: form.stop
      }))
      setSaved(true)
      setEditing(false)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => setSaved(false), 2500)
    } catch {}
  }
  const onCancel = () => {
    // reset
    try {
      const students = getUsers('student') || []
      const me = students.find(s => s.id === session.id)
      if (me){
        setForm({
          busNo: me.busNo || '',
          rollNo: me.rollNo || '',
          parentPhone: me.parentPhone || '',
          stop: me.stop || ''
        })
      }
    } catch {}
    setEditing(false)
  }
  const onLogout = () => {
    try { logout() } catch {}
    navigate('/account')
  }
  return (
  <div className="space-y-4 w-full max-w-none mx-0 px-0 sm:px-3 md:px-4">
      <div className="flex items-center justify-between px-3 sm:px-0">
        <h2 className="text-2xl font-semibold">{t('dashboard.student')}</h2>
        <button onClick={onLogout} className="px-3 py-2 bg-red-600 text-white rounded shadow text-sm">{t('action.logout')}</button>
      </div>

      {/* Student details card */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Your details</h3>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Saved</span>}
            {!editing ? (
              <button onClick={() => setEditing(true)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">Edit</button>
            ) : (
              <button onClick={onCancel} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">Cancel</button>
            )}
          </div>
        </div>

        {!editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between md:block">
              <div className="text-gray-600 md:mb-1">Bus ID</div>
              <div className="font-medium break-all">{form.busNo || '—'}</div>
            </div>
            <div className="flex items-center justify-between md:block">
              <div className="text-gray-600 md:mb-1">Roll No</div>
              <div className="font-medium">{form.rollNo || '—'}</div>
            </div>
            <div className="flex items-center justify-between md:block">
              <div className="text-gray-600 md:mb-1">Parent Phone</div>
              <div className="font-medium tracking-wide">{form.parentPhone || '—'}</div>
            </div>
            <div className="flex items-center justify-between md:block">
              <div className="text-gray-600 md:mb-1">Stop</div>
              <div className="font-medium capitalize">{form.stop || '—'}</div>
            </div>
            <p className="md:col-span-2 text-xs text-gray-500">These details are used in the driver roster and parent login.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Bus ID</span>
                <input name="busNo" value={form.busNo} readOnly className="w-full border rounded px-2 py-1 bg-gray-50" />
              </label>
              <div className="text-xs text-gray-600 self-end mb-1">
                {validBus ? 'Stops loaded from current route.' : 'Stop dropdown appears when your Bus ID matches the active bus.'}
              </div>
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Roll number</span>
                <input name="rollNo" value={form.rollNo} onChange={onChange} className="w-full border rounded px-2 py-1" />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Parent phone</span>
                <input name="parentPhone" value={form.parentPhone} onChange={onChange} className="w-full border rounded px-2 py-1" />
              </label>
              {validBus ? (
                <label className="text-sm md:col-span-2">
                  <span className="block text-gray-600 mb-1">Stop</span>
                  <select name="stop" value={form.stop} onChange={onChange} className="w-full border rounded px-2 py-1">
                    {stopOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              ) : (
                <label className="text-sm md:col-span-2">
                  <span className="block text-gray-600 mb-1">Stop</span>
                  <input name="stop" value={form.stop} onChange={onChange} className="w-full border rounded px-2 py-1" placeholder="Enter your stop" />
                </label>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={onSave} className="px-3 py-2 bg-indigo-600 text-white text-sm rounded">Save</button>
              <span className="text-xs text-gray-500">These details are used in the driver roster and parent login.</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="md:col-span-2 lg:col-span-3 bg-white p-3 sm:p-4 rounded-none md:rounded shadow">
          <MapView role="student" busId={busId || null} highlightStopName={(form.stop || '').trim()} />
          <div className="mt-4">
            <LiveTimeline busId={busId || null} highlightStopName={(form.stop || '').trim()} />
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-none md:rounded shadow lg:col-span-1">
          <BusList busId={busId || null} highlightStopName={(form.stop || '').trim()} />
        </div>
      </div>
    </div>
  )
}
