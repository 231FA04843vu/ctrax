import React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import MapView from '../shared/MapView'
import BusList from '../shared/BusList'
import LiveTimeline from '../shared/LiveTimeline'
import { getSession, isRole, logout } from '../utils/auth'
import { useI18n } from '../i18n/i18n.jsx'

export default function ParentDashboard(){
  const { t } = useI18n()
  if (!isRole('parent')) {
    return <Navigate to="/login/parent" replace />
  }
  const navigate = useNavigate()
  const session = getSession()
  const busId = (session?.busNo || '').trim()
  const highlight = (session?.stop || '').trim()
  return (
  <div className="space-y-4 w-full max-w-none mx-0 px-0 sm:px-3 md:px-4">
      <div className="flex items-center justify-between px-3 sm:px-0">
        <h2 className="text-2xl font-semibold">{t('dashboard.parent')}</h2>
        <button onClick={() => { try { logout(); } catch {}; navigate('/account') }} className="px-3 py-2 bg-red-600 text-white rounded shadow text-sm">{t('action.logout')}</button>
      </div>

      {session?.studentName && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded p-3">
          Viewing as parent of <span className="font-semibold">{session.studentName}</span>
          {session.busNo ? <> — Bus ID: <span className="font-mono">{session.busNo}</span></> : null}
          {session.stop ? <> — Stop: <span className="capitalize">{session.stop}</span></> : null}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="md:col-span-2 lg:col-span-3 bg-white p-3 sm:p-4 rounded-none md:rounded shadow">
          <MapView role="student" busId={busId || null} highlightStopName={highlight} />
          <div className="mt-4">
            <LiveTimeline busId={busId || null} highlightStopName={highlight} />
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-none md:rounded shadow lg:col-span-1">
          <BusList busId={busId || null} highlightStopName={highlight} />
        </div>
      </div>
    </div>
  )
}
