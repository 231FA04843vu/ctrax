import React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import MapView from '../shared/MapView'
import BusList from '../shared/BusList'
import LiveTimeline from '../shared/LiveTimeline'
import { getSession, isRole, logout } from '../utils/auth'

export default function ParentDashboard(){
  if (!isRole('parent')) {
    return <Navigate to="/login/parent" replace />
  }
  const navigate = useNavigate()
  const session = getSession()
  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Parent Dashboard</h2>
        <button onClick={() => { try { logout(); } catch {}; navigate('/account') }} className="px-3 py-2 bg-red-600 text-white rounded shadow text-sm">Logout</button>
      </div>

      {session?.studentName && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded p-3">
          Viewing as parent of <span className="font-semibold">{session.studentName}</span>
          {session.busNo ? <> — Bus ID: <span className="font-mono">{session.busNo}</span></> : null}
          {session.stop ? <> — Stop: <span className="capitalize">{session.stop}</span></> : null}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white p-4 rounded shadow">
          <MapView role="student" />
          <div className="mt-4">
            <LiveTimeline />
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <BusList />
        </div>
      </div>
    </div>
  )
}
