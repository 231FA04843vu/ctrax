
import React, { useMemo, useRef, useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import MapView from '../shared/MapView'
import { buildRouteForNow, haversineKm, getRoutePhase } from '../utils/routeLogic'
import { onStopsFor } from '../utils/routeData'
import { formatMinutes } from '../utils/format'
import { isRole, getUsers, getSession, logout, updateProfile } from '../utils/auth'
import { useI18n } from '../i18n/i18n.jsx'
import { getBusFor, onBusFor, setBusFor, setSharingFor, setPositionFor } from '../utils/busData'
import { startLocationTracking, stopLocationTracking, onLocationUpdate, isWithinRange, calculateSpeedKmh, completeStopTracking, resumeTracking, loadTrackingState, getLastPosition, getLastGoodPosition, isGpsQualityGood, onGpsQualityChange, requestLocationPermission } from '../utils/geolocation'

export default function DriverDashboard(){
  const { t } = useI18n()
  if (!isRole('driver')) {
    return <Navigate to="/login/driver" replace />
  }
  const navigate = useNavigate()
  const [busId, setBusId] = useState('')
  const [bus, setBus] = useState({})
  const [sharing, setSharing] = useState(false)
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [gpsAccuracy, setGpsAccuracy] = useState(null)
  const [isUsingFallbackPosition, setIsUsingFallbackPosition] = useState(false)  // True when GPS is poor and showing last good position
  const locationUnsubscribeRef = useRef(null)
  
  useEffect(() => {
    // derive assigned bus id from session/users (admin assignment)
    try {
      const session = getSession()
      if (session?.role === 'driver'){
        const drivers = getUsers('driver') || []
        const me = drivers.find(d => d.id === session.id)
        const assigned = (session.busNo || me?.busNo || '').trim()
        setBusId(assigned)
      }
    } catch {}
  }, [])
  useEffect(() => {
    if (!busId) return
    const off = onBusFor(busId, (b) => {
      setBus(b || {})
      setSharing((b && b.sharing) || false)
    })
    return off
  }, [busId])

  // Real-time geolocation tracking for driver
  useEffect(() => {
    // Don't auto-start GPS on login. Only start when driver clicks "Start Sharing"
    if (!busId) {
      console.log('⏸️ Waiting for bus assignment before tracking can start')
      return
    }

    // Check if we should resume tracking from previous session (only if sharing was active)
    const previousState = loadTrackingState()
    const shouldResumeTracking = previousState && previousState.busId === busId && previousState.enabled && sharing

    // Only start tracking if sharing is active (either from current session or resumed)
    if (!shouldResumeTracking && !sharing) {
      console.log('⏸️ GPS tracking not started - waiting for driver to click Start Sharing')
      return
    }

    // Start or resume location tracking only when sharing is ON
    const started = shouldResumeTracking 
      ? resumeTracking(busId)
      : startLocationTracking({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
          updateInterval: 500
        }, busId)

    if (!started) {
      console.error('❌ Failed to start location tracking')
      return
    }
    
    console.log('✅ Location tracking active for bus:', busId)

    // Subscribe to GPS quality changes (good → bad → good)
    const unsubscribeQuality = onGpsQualityChange((status) => {
      const wasFallback = isUsingFallbackPosition
      const isBad = !status.isGood
      setIsUsingFallbackPosition(isBad)
      
      if (isBad && !wasFallback) {
        console.warn('⚠️ GPS quality is poor, switching to last known good position')
      } else if (!isBad && wasFallback) {
        console.log('✅ GPS quality recovered, switching back to live position')
      }
    })

    // Subscribe to location updates and push to database
    const unsubscribe = onLocationUpdate((position) => {
      try {
        // Update accuracy display
        setGpsAccuracy(Math.round(position.accuracy))
        
        // Convert from geolocation format to our array format [lat, lng]
        const busPosition = [position.latitude, position.longitude]
        
        console.log('📍 GPS:', position.latitude.toFixed(6), position.longitude.toFixed(6), '| Accuracy:', Math.round(position.accuracy) + 'm')
        
        // Calculate current speed in km/h
        const speedKmh = calculateSpeedKmh(position)
        if (speedKmh !== null) {
          setCurrentSpeed(Math.round(speedKmh * 10) / 10)
        }

        // Update driver position and metadata in database for this bus
        // Send actual GPS position - even if accuracy is poor
        // Only use fallback for minor accuracy degradation (50-500m), not extreme cases (>1000m)
        // Ignore positions with accuracy > 10km (completely broken GPS)
        try {
          const ts = Date.now()
          
          // Completely reject positions with extreme inaccuracy (> 10km)
          // These are GPS failures, not real positions
          if (position.accuracy > 10000) {
            console.warn('⚠️ GPS accuracy extremely poor (>10km):', Math.round(position.accuracy / 1000) + 'km', '- ignoring this position')
            return
          }
          
          // Determine which position to send: current or fallback
          let positionToSend = busPosition
          let usingFallback = false
          
          // Only use fallback for minor GPS degradation (50-500m range)
          // For extreme inaccuracy (>500m), send actual position to avoid jumping to wrong location
          if (position.accuracy > 50 && position.accuracy <= 500) {
            const lastGood = getLastGoodPosition()
            if (lastGood && lastGood.latitude && lastGood.longitude) {
              positionToSend = [lastGood.latitude, lastGood.longitude]
              usingFallback = true
              console.log('💾 Using fallback position (minor GPS degradation):', positionToSend, '| Accuracy:', Math.round(position.accuracy) + 'm', '| Last good accuracy:', Math.round(lastGood.accuracy) + 'm')
            }
          }
          
          const patch = {
            position: positionToSend,
            lastUpdate: ts,
            gpsAccuracy: Math.round(position.accuracy),
            heading: position.heading ?? null,
            usingFallback // Flag to indicate if showing fallback position
          }
          // Only include speedKmph if we have actual speed data (not zero/null)
          const reportedSpeed = (position.speed != null) ? Math.round((position.speed * 3.6) * 10) / 10 : (speedKmh !== null ? Math.round(speedKmh * 10) / 10 : null)
          if (reportedSpeed && reportedSpeed > 0) {
            patch.speedKmph = reportedSpeed
          }
          // Use setBusFor to write a richer patch (keeps position array and metadata)
          setBusFor(busId, patch).catch(err => console.error('❌ Failed to save position patch:', err))
        } catch (err) {
          console.error('❌ Failed to prepare position patch:', err)
        }

        // Check if driver reached final destination (within 500m)
        const routePhase = getRoutePhase()
        const routeInfo = buildRouteForNow(busId)
        const orderedStops = routeInfo.orderedStops
        
        if (orderedStops && orderedStops.length > 0) {
          const finalDestination = orderedStops[orderedStops.length - 1]
          const hasReachedDestination = isWithinRange(
            position,
            finalDestination.position[0],
            finalDestination.position[1],
            0.5 // 500 meters
          )

          // Auto-stop at final destination for both morning and evening routes
          // Morning: Vignan University, Evening: Sattenapalli (last stop in route)
          if (hasReachedDestination) {
            console.log(`🏁 Bus reached final destination: ${finalDestination.name}. Stopping GPS tracking.`)
            // Completely stop tracking when reaching final destination
            // This clears the persistent state too
            setSharing(false)
            try {
              setSharingFor(busId, false)
              completeStopTracking()  // Full stop with state cleanup
            } catch (error) {
              console.error('Error stopping tracking:', error)
            }
          }
        }
      } catch (error) {
        console.error('Error updating position:', error)
      }
    })

    // Cleanup: stop location tracking and unsubscribe when component unmounts or busId changes
    // NOTE: Only stop listener subscription and watch, DON'T stop tracking completely
    // Tracking will continue even after logout until destination is reached
    return () => {
      unsubscribe()
      unsubscribeQuality()
      stopLocationTracking()  // This just stops the watch, not the persistent tracking state
    }
  }, [busId, sharing])
  const [form, setForm] = useState({
    driverName: '',
    driverPhone: ''
  })
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const saveTimerRef = useRef(null)
  const shareSectionRef = useRef(null)
  const [showShareHint, setShowShareHint] = useState(true)
  const [showNudge, setShowNudge] = useState(true)

  const onChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    setSaved(false)
  }

  const onSave = async () => {
    if (!busId) return
    const name = (form.driverName || '').trim()
    const phone = (form.driverPhone || '').trim()
    // Update driver profile so Admin and Student views reflect it everywhere
    try { await updateProfile({ name, phone }) } catch {}
    // Mirror into bus metadata for backward compatibility (student views may still read from bus)
    try { await setBusFor(busId, { driverName: name, driverPhone: phone }) } catch {}
    setSaved(true)
    setEditing(false)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => setSaved(false), 2500)
  }
  const onCancel = () => {
    // Reset form to current saved values and close editor
    const b = bus
    setForm({
      driverName: b.driverName || '',
      driverPhone: b.driverPhone || ''
    })
    setEditing(false)
  }

  // Route details for the driver
  const [stopsTick, setStopsTick] = useState(0)
  useEffect(() => {
    if (!busId) return undefined
    return onStopsFor(busId, () => setStopsTick(t => t + 1))
  }, [busId])
  const routeNow = useMemo(() => {
    if (!busId) {
      return { orderedStops: [], timeline: [], phase: getRoutePhase(), startTime: '16:30', startPlace: 'Vignan University' }
    }
    return buildRouteForNow(busId)
  }, [busId, stopsTick])
  const ordered = routeNow.orderedStops
  const timeline = routeNow.timeline
  const totalDistanceKm = useMemo(() => {
    if (!ordered || ordered.length < 2) return 0
    let sum = 0
    for (let i = 0; i < ordered.length - 1; i++){
      sum += haversineKm(ordered[i].position, ordered[i+1].position)
    }
    return Math.round(sum * 10) / 10
  }, [ordered])
  const todayAt = (hhmm) => {
    const raw = String(hhmm || '00:00')
    const parts = raw.split(':')
    const h = Number(parts[0])
    const m = Number(parts[1])
    const safeH = Number.isFinite(h) && h >= 0 && h <= 23 ? h : 0
    const safeM = Number.isFinite(m) && m >= 0 && m <= 59 ? m : 0
    const d = new Date()
    d.setHours(safeH, safeM, 0, 0)
    return d
  }
  const fmtIST = (date) => {
    const t = date instanceof Date ? date.getTime() : NaN
    if (!Number.isFinite(t)) return '--:--'
    return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(date)
  }
  const startPlanned = todayAt(routeNow.startTime)
  const maxOffset = timeline.length ? Math.max(...timeline.map(t => t.plannedOffsetMins ?? 0)) : 0
  const endPlanned = new Date(startPlanned.getTime() + maxOffset * 60000)
  const endPlace = ordered[ordered.length - 1]?.name
  const toggleShare = async () => {
    const willBeSharing = !sharing
    
    // If turning ON sharing, request GPS permission first
    if (willBeSharing) {
      console.log('📍 Requesting GPS permission...')
      const hasPermission = await requestLocationPermission()
      
      if (!hasPermission) {
        console.error('❌ Location permission denied')
        alert('Location permission is required to share your bus location with students. Please enable location access in your device settings and try again.')
        return // Don't toggle if permission denied
      }
      
      console.log('✅ GPS permission granted, starting location tracking...')
      
      // Start location tracking immediately
      if (busId) {
        const started = startLocationTracking({
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0,
          updateInterval: 500
        }, busId)
        
        if (!started) {
          console.error('❌ Failed to start location tracking')
          alert('Failed to start GPS tracking. Please check your device location settings.')
          return
        }
        console.log('✅ Location tracking started')
      }
      
      // Wait up to 5 seconds for GPS to get first position
      console.log('⏳ Waiting for GPS position...')
      let positionFound = false
      let attempts = 0
      while (!positionFound && attempts < 50) {
        const lastPos = getLastPosition?.()
        if (lastPos && lastPos.latitude && lastPos.longitude) {
          positionFound = true
          console.log('✅ GPS position acquired:', lastPos.latitude.toFixed(6), lastPos.longitude.toFixed(6), '| Accuracy:', Math.round(lastPos.accuracy) + 'm')
          break
        }
        attempts++
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      if (!positionFound) {
        console.warn('⚠️ GPS position not acquired within 5 seconds, but proceeding with sharing')
      }
    }
    
    // Now actually toggle the sharing state
    setSharing((s) => {
      const ns = !s
      try { 
        if (busId) {
          // If turning ON sharing
          if (ns) {
            const lastPos = getLastPosition?.()
            if (lastPos && lastPos.latitude && lastPos.longitude) {
              try {
                const ts = Date.now()
                const patch = {
                  position: [lastPos.latitude, lastPos.longitude],
                  lastUpdate: ts,
                  gpsAccuracy: Math.round(lastPos.accuracy || 0),
                  heading: lastPos.heading ?? null
                }
                const reportedSpeed = (lastPos.speed != null) ? Math.round((lastPos.speed * 3.6) * 10) / 10 : null
                if (reportedSpeed && reportedSpeed > 0) {
                  patch.speedKmph = reportedSpeed
                }
                // Send position BEFORE updating sharing flag so students see real location immediately
                setBusFor(busId, patch).catch(err => console.error('❌ Failed to send initial GPS position:', err))
                console.log('✅ Sent initial GPS position to Firebase:', patch)
              } catch (err) {
                console.error('❌ Error preparing initial position:', err)
              }
            } else {
              console.warn('⚠️ No GPS position available yet. Will send on next update...')
            }
            // Now set sharing flag
            setSharingFor(busId, ns).catch(err => console.error('❌ Failed to set sharing flag:', err))
            console.log('✅ Sharing enabled')
          } else {
            // Turning OFF sharing - stop location tracking
            console.log('⏹️ Stopping location tracking')
            stopLocationTracking()
            setSharingFor(busId, ns).catch(err => console.error('❌ Failed to disable sharing flag:', err))
            console.log('✅ Sharing disabled')
          }
        }
      } catch (err) {
        console.error('❌ Error in toggleShare:', err)
      }
      
      if (ns) {
        // Starting real location sharing
        setShowShareHint(false)
        setShowNudge(false)
        try {
          localStorage.setItem('driverShareHintHidden', '1')
          localStorage.setItem('driverShareNudgeHidden', '1')
        } catch {}
      }
      return ns
    })
  }

  const scrollToShare = () => {
    const el = shareSectionRef.current
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    // hide and persist nudge once used
    setShowNudge(false)
    try { localStorage.setItem('driverShareNudgeHidden', '1') } catch {}
  }
  useEffect(() => {
    // initialize persisted hint/nudge visibility
    // initialize form from driver profile if available
    try {
      const session = getSession()
      if (session?.role === 'driver'){
        const drivers = getUsers('driver') || []
        const me = drivers.find(d => d.id === session.id)
        if (me){
          setForm({ driverName: me.name || '', driverPhone: me.phone || '' })
        }
      }
    } catch {}
    // initialize persisted hint/nudge visibility
    try {
      const hintHidden = localStorage.getItem('driverShareHintHidden') === '1'
      const nudgeHidden = localStorage.getItem('driverShareNudgeHidden') === '1'
      if (hintHidden) setShowShareHint(false)
      if (nudgeHidden) setShowNudge(false)
    } catch {}
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // Auto-hide the mobile nudge after a few seconds
  useEffect(() => {
    if (!showNudge || sharing) return
    const t = setTimeout(() => {
      setShowNudge(false)
      try { localStorage.setItem('driverShareNudgeHidden', '1') } catch {}
    }, 4500)
    return () => clearTimeout(t)
  }, [showNudge, sharing])
  return (
  <div className="space-y-4 w-full max-w-none mx-0 px-0 sm:px-3 md:px-4">
      <div className="flex items-center justify-between px-3 sm:px-0">
        <h2 className="text-2xl font-semibold">{t('dashboard.driver')}</h2>
        <button
          onClick={() => { try { setSharingFor(busId, false); logout(); } catch {}; navigate('/account') }}
          className="px-3 py-2 bg-red-600 text-white rounded shadow text-sm"
        >
          {t('action.logout')}
        </button>
      </div>

      {/* Floating mobile nudge to scroll for live controls */}
      {showNudge && !sharing && (
        <button
          type="button"
          onClick={scrollToShare}
          className="md:hidden fixed bottom-6 right-4 z-20 bg-indigo-600 text-white text-xs px-3 py-2 rounded-full shadow-lg flex items-center gap-2 opacity-90"
        >
          <span>Scroll for live controls</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="animate-bounce">
            <path d="M12 16.5a1 1 0 0 1-.7-.29l-5-5a1 1 0 1 1 1.4-1.42L12 14.09l4.3-4.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-.7.29z"/>
          </svg>
        </button>
      )}

      {/* Mobile hint to find Start Sharing */}
      {showShareHint && !sharing && (
        <div className="md:hidden bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded p-3 flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">Start sharing is below</div>
            <div>Scroll to the bottom to tap <span className="font-semibold">Start Sharing</span> and begin live updates.</div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={scrollToShare} className="px-2 py-1 bg-amber-600 text-white text-xs rounded shadow">Jump</button>
            <button onClick={() => { setShowShareHint(false); try { localStorage.setItem('driverShareHintHidden', '1') } catch {} }} className="px-2 py-1 border text-xs rounded">Hide</button>
          </div>
        </div>
      )}

      {/* Driver details card (view mode with side Edit button; collapses after save) */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Driver details</h3>
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
              <div className="font-medium break-all">{busId || '—'}</div>
            </div>
            <div className="flex items-center justify-between md:block">
              <div className="text-gray-600 md:mb-1">Bus Name</div>
              <div className="font-medium capitalize">{bus.name}</div>
            </div>
            <div className="flex items-center justify-between md:block">
              <div className="text-gray-600 md:mb-1">Driver Name</div>
              <div className="font-medium capitalize">{
                (()=>{
                  try {
                    const session = getSession()
                    const drivers = getUsers('driver') || []
                    const d = drivers.find(x => x.busNo && busId && x.busNo.toLowerCase() === busId.toLowerCase()) || drivers.find(x=>x.id===session?.id)
                    return d?.name || bus.driverName || '—'
                  } catch { return bus.driverName || '—' }
                })()
              }</div>
            </div>
            <div className="flex items-center justify-between md:block">
              <div className="text-gray-600 md:mb-1">Driver Phone</div>
              <div className="font-medium tracking-wide">{
                (()=>{
                  try {
                    const session = getSession()
                    const drivers = getUsers('driver') || []
                    const d = drivers.find(x => x.busNo && busId && x.busNo.toLowerCase() === busId.toLowerCase()) || drivers.find(x=>x.id===session?.id)
                    return d?.phone || bus.driverPhone || '—'
                  } catch { return bus.driverPhone || '—' }
                })()
              }</div>
            </div>
            <p className="md:col-span-2 text-xs text-gray-500">These details are used in the student view.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Driver Name</span>
                <input name="driverName" value={form.driverName} onChange={onChange} className="w-full border rounded px-2 py-1" />
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Driver Phone</span>
                <input name="driverPhone" value={form.driverPhone} onChange={onChange} className="w-full border rounded px-2 py-1" />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={onSave} className="px-3 py-2 bg-indigo-600 text-white text-sm rounded">Save</button>
              <span className="text-xs text-gray-500">These details are used in the student view.</span>
            </div>
          </>
        )}
      </div>

      {/* Today's Route overview */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Today's Route</h3>
          <span className="text-xs text-gray-500 capitalize">{routeNow.phase}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-gray-600">Start</div>
            <div className="font-medium capitalize">{routeNow.startPlace}</div>
            <div className="text-gray-700">{fmtIST(startPlanned)} IST</div>
          </div>
          <div>
            <div className="text-gray-600">End</div>
            <div className="font-medium capitalize">{endPlace}</div>
            <div className="text-gray-700">{fmtIST(endPlanned)} IST</div>
          </div>
          <div>
            <div className="text-gray-600">Stops</div>
            <div className="font-medium">{timeline.length}</div>
          </div>
          <div>
            <div className="text-gray-600">Distance</div>
            <div className="font-medium">{totalDistanceKm} km</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Planned schedule (IST)</div>
          <div className="overflow-hidden rounded border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-3 bg-gray-100 text-xs font-semibold text-gray-700">
              <div className="px-2 py-2">Stop</div>
              <div className="px-2 py-2 md:text-center">Planned</div>
              <div className="hidden md:block px-2 py-2 text-center">Offset</div>
            </div>
            <div className="divide-y divide-gray-200 bg-white text-xs">
              {timeline.map((s, i) => (
                <div key={i} className="grid grid-cols-2 md:grid-cols-3">
                  <div className="px-2 py-2 capitalize">{s.name}</div>
                  <div className="px-2 py-2 md:text-center">{fmtIST(new Date(startPlanned.getTime() + (s.plannedOffsetMins ?? 0) * 60000))}</div>
                  <div className="hidden md:block px-2 py-2 text-center">{formatMinutes(s.plannedOffsetMins ?? 0)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-3 sm:p-4 rounded-none md:rounded shadow" ref={shareSectionRef}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button onClick={toggleShare} disabled={!busId} className="px-3 py-2 bg-indigo-600 text-white rounded disabled:opacity-60 disabled:cursor-not-allowed">{sharing ? t('action.stopSharing') : t('action.startSharing')}</button>
            <span className="text-sm font-medium">{sharing ? '🔴 Sharing live location' : '⚪ Not sharing'}</span>
          </div>
          <div className="flex gap-4">
            {gpsAccuracy && sharing && (
              <div className="text-right">
                <div className="text-xs text-gray-600">GPS Accuracy</div>
                <div className={`text-lg font-bold ${gpsAccuracy < 20 ? 'text-green-600' : gpsAccuracy < 100 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {gpsAccuracy < 20 ? '✅' : gpsAccuracy < 100 ? '⚠️' : '❌'} {gpsAccuracy}m
                </div>
              </div>
            )}
            {sharing && currentSpeed > 0 && (
              <div className="text-right">
                <div className="text-xs text-gray-600">Current Speed</div>
                <div className="text-lg font-bold text-indigo-600">{currentSpeed} km/h</div>
              </div>
            )}
          </div>
        </div>
        {sharing && bus?.position && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
            <div><strong>Current Location:</strong> {bus.position[0].toFixed(6)}, {bus.position[1].toFixed(6)}</div>
          </div>
        )}
        <MapView role="driver" sharing={sharing} busId={busId} />
      </div>

      {/* Enrolled Students List */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Enrolled Students</h3>
          <span className="text-xs text-gray-500">Bus ID: {busId || '—'}</span>
        </div>
        {(() => {
          const students = (getUsers('student') || []).filter(s => (s.busNo || '').trim() && (busId || '').trim() && s.busNo.trim().toLowerCase() === (busId || '').trim().toLowerCase())
          const count = students.length
          if (!busId){
            return <div className="text-sm text-gray-600">Set your Bus ID in Driver details to see enrolled students.</div>
          }
          if (count === 0){
            return <div className="text-sm text-gray-600">No students enrolled for this bus yet.</div>
          }
          const sorted = students.slice().sort((a,b) => (a.stop||'').localeCompare(b.stop||''))
          return (
            <>
              <div className="text-sm text-gray-700 mb-2">Total: <span className="font-medium">{count}</span></div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">Roll No</th>
                      <th className="text-left px-3 py-2">Parent Phone</th>
                      <th className="text-left px-3 py-2">Stop</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sorted.map(s => (
                      <tr key={s.id}>
                        <td className="px-3 py-2 capitalize">{s.name}</td>
                        <td className="px-3 py-2">{s.rollNo || '—'}</td>
                        <td className="px-3 py-2">{s.parentPhone || '—'}</td>
                        <td className="px-3 py-2 capitalize">{s.stop || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}
