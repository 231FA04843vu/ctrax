
import React, { useMemo, useRef, useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import MapView from '../shared/MapView'
import { buildRouteForNow, haversineKm, getRoutePhase } from '../utils/routeLogic'
import { onStopsFor } from '../utils/routeData'
import { formatMinutes } from '../utils/format'
import { isRole, getUsers, getSession, logout, updateProfile } from '../utils/auth'
import { useI18n } from '../i18n/i18n.jsx'
import { getBusFor, onBusFor, setBusFor, setSharingFor, setPositionFor, setPhaseFor } from '../utils/busData'
import { startLocationTracking, stopLocationTracking, onLocationUpdate, isWithinRange, calculateSpeedKmh, completeStopTracking, resumeTracking, loadTrackingState, getLastPosition, getLastGoodPosition, isGpsQualityGood, onGpsQualityChange, requestLocationPermission } from '../utils/geolocation'
import { getTrafficETA } from '../utils/trafficAPI'

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

  // Idle tracking & Stop Reason
  const [idleMins, setIdleMins] = useState(0)
  const [showReasonPrompt, setShowReasonPrompt] = useState(false)
  const [stopReasonInput, setStopReasonInput] = useState('')
  const [isCustomReason, setIsCustomReason] = useState(false)
  const [showThankYou, setShowThankYou] = useState(false)
  const lastMoveTimeRef = useRef(Date.now())

  // Traffic Notification
  const [trafficDelayMins, setTrafficDelayMins] = useState(0)
  const [showTrafficAlert, setShowTrafficAlert] = useState(false)

  useEffect(() => {
    if (!sharing) {
      setIdleMins(0)
      lastMoveTimeRef.current = Date.now()
      return
    }
    
    if (currentSpeed > 0) {
      setIdleMins(0)
      lastMoveTimeRef.current = Date.now()
      setShowReasonPrompt(false)
      // Automatically clear reason when moving
      if (bus.stopReason && busId) {
        setBusFor(busId, { stopReason: null }).catch(()=>{})
      }
    } else {
      const interval = setInterval(() => {
        const mins = Math.floor((Date.now() - lastMoveTimeRef.current) / 60000)
        setIdleMins(mins)
        if (mins >= 4 && !bus.stopReason && !showReasonPrompt) {
          setShowReasonPrompt(true)
        }
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [currentSpeed, sharing, bus.stopReason, busId, showReasonPrompt])

  const submitStopReason = async () => {
    if (!stopReasonInput.trim() || !busId) return
    try {
      await setBusFor(busId, { stopReason: stopReasonInput.trim() })
      setShowReasonPrompt(false)
      setShowThankYou(true)
      setTimeout(() => setShowThankYou(false), 3000)
    } catch (e) {
      console.error('Failed to submit stop reason', e)
    }
  }

  // Poll for TomTom traffic ETA every 2 minutes when moving
  useEffect(() => {
    if (!sharing || !busId) return
    let cancelled = false
    
    const checkTraffic = async () => {
      const currentPos = getLastPosition?.() || getLastGoodPosition()
      if (!currentPos || !currentPos.latitude || !currentPos.longitude) return
      
      const route = buildRouteForNow(busId)
      const ordered = route.orderedStops
      if (!ordered || ordered.length < 2) return
      
      const destination = ordered[ordered.length - 1].position
      
      const etaData = await getTrafficETA([currentPos.latitude, currentPos.longitude], destination)
      if (!cancelled && etaData) {
        const delayMins = Math.round(etaData.trafficDelaySeconds / 60)
        
        // Push the delay to Firebase so students can see updated ETAs without querying TomTom themselves
        setBusFor(busId, { trafficDelayMins: delayMins }).catch(()=>{})

        // Notify if traffic delay is 5 minutes or more
        if (delayMins >= 5) {
          setTrafficDelayMins(delayMins)
          setShowTrafficAlert(true)
          
          // Optionally auto-set stop reason if very slow
          if (currentSpeed < 10 && !bus.stopReason) {
            setBusFor(busId, { stopReason: 'Heavy Traffic' }).catch(()=>{})
          }
        } else {
          setShowTrafficAlert(false)
        }
      }
    }
    
    // Check immediately, then every 2 minutes
    checkTraffic()
    const id = setInterval(checkTraffic, 120000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [sharing, busId, currentSpeed, bus.stopReason])
  
  // Behavior Learning: Check for consistent deviations to update default route
  useEffect(() => {
    if (!busId) return
    let cancelled = false
    Promise.all([
      import('firebase/database'),
      import('../utils/firebase')
    ]).then(([ { get, ref, set }, { db } ]) => {
      if (cancelled) return
      get(ref(db, `deviations/${busId}`)).then(snapshot => {
        if (!snapshot.exists()) return
        const deviations = snapshot.val()
        const dates = Object.keys(deviations).sort().reverse() // Newest first
        if (dates.length >= 2) {
          const latestDev = deviations[dates[0]]?.position
          const prevDev = deviations[dates[1]]?.position
          if (latestDev && prevDev) {
            import('../utils/routeLogic').then(({ haversineKm }) => {
              // If deviation positions from the last 2 days are within 500m of each other
              if (haversineKm(latestDev, prevDev) < 0.5) {
                // Add it as a permanent waypoint if not already there
                const existingWps = bus.waypoints || []
                const isAlreadyWaypoint = existingWps.some(w => haversineKm(w.position, latestDev) < 0.5)
                if (!isAlreadyWaypoint) {
                  setBusFor(busId, { 
                    waypoints: [...existingWps, { position: latestDev, timestamp: Date.now() }] 
                  }).catch(()=>{})
                  // Clean up old deviations to avoid re-triggering
                  set(ref(db, `deviations/${busId}`), null)
                }
              }
            })
          }
        }
      })
    })
    return () => { cancelled = true }
  }, [busId, bus.waypoints])

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
        setGpsAccuracy(Math.round(position.coords.accuracy))
        
        // Convert from geolocation format to our array format [lat, lng]
        const busPosition = [position.coords.latitude, position.coords.longitude]
        
        console.log('📍 GPS:', position.coords.latitude.toFixed(6), position.coords.longitude.toFixed(6), '| Accuracy:', Math.round(position.coords.accuracy) + 'm')
        
        // Convert native speed (m/s) to km/h, default to 0 if not available
        const nativeSpeed = position?.coords?.speed
        const speedKmh = nativeSpeed != null ? (nativeSpeed * 3.6) : 0
        setCurrentSpeed(Math.round(speedKmh * 10) / 10)

        // Update driver position and metadata in database for this bus
        // Send actual GPS position - even if accuracy is poor
        // Only use fallback for minor accuracy degradation (50-500m), not extreme cases (>1000m)
        // Ignore positions with accuracy > 10km (completely broken GPS)
        try {
          const ts = Date.now()
          
          // Completely reject positions with extreme inaccuracy (> 10km)
          // These are GPS failures, not real positions
          if (position.coords.accuracy > 10000) {
            console.warn('⚠️ GPS accuracy extremely poor (>10km):', Math.round(position.coords.accuracy / 1000) + 'km', '- ignoring this position')
            return
          }
          
          // Determine which position to send: current or fallback
          let positionToSend = busPosition
          let usingFallback = false
          
          // Only use fallback for minor GPS degradation (50-500m range)
          // For extreme inaccuracy (>500m), send actual position to avoid jumping to wrong location
          if (position.coords.accuracy > 50 && position.coords.accuracy <= 500) {
            const lastGood = getLastGoodPosition()
            if (lastGood && lastGood.latitude && lastGood.longitude) {
              positionToSend = [lastGood.latitude, lastGood.longitude]
              usingFallback = true
              console.log('💾 Using fallback position (minor GPS degradation):', positionToSend, '| Accuracy:', Math.round(position.coords.accuracy) + 'm', '| Last good accuracy:', Math.round(lastGood.accuracy) + 'm')
            }
          }
          
          const patch = {
            position: positionToSend,
            lastUpdate: ts,
            gpsAccuracy: Math.round(position.coords.accuracy),
            heading: position.coords.heading ?? null,
            usingFallback // Flag to indicate if showing fallback position
          }
          const reportedSpeed = Math.round(speedKmh * 10) / 10
          if (reportedSpeed != null) {
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
            [position.coords.latitude, position.coords.longitude],
            finalDestination.position,
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
  const [showShareHint, setShowShareHint] = useState(false)
  const [showNudge, setShowNudge] = useState(false)

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
      
      return ns
    })
  }

  useEffect(() => {
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
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])
  return (
  <div className="space-y-4 w-full max-w-none mx-0 px-0 sm:px-3 md:px-4 relative">
      <div className="flex items-center justify-between px-3 sm:px-0">
        <h2 className="text-2xl font-semibold">{t('dashboard.driver')}</h2>
        <button
          onClick={() => { try { setSharingFor(busId, false); logout(); } catch {}; navigate('/account') }}
          className="px-3 py-2 bg-red-600 text-white rounded shadow text-sm"
        >
          {t('action.logout')}
        </button>
      </div>

      {/* Traffic Alert Banner */}
      {showTrafficAlert && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded shadow-sm flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="font-bold">Heavy Traffic Ahead</div>
            <div className="text-sm">Expect a delay of approximately {trafficDelayMins} minutes on your route to the destination.</div>
          </div>
          <button 
            onClick={() => setShowTrafficAlert(false)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stop Reason Prompt Modal */}
      {showReasonPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 overflow-hidden flex flex-col">
            <h3 className="text-xl font-bold mb-2">Bus is stopped</h3>
            <p className="text-gray-600 text-sm mb-4">
              The bus has been stopped for {idleMins} minutes. Please provide a quick reason for the students waiting.
            </p>
            
            <div className="space-y-2 mb-4">
              {['🚦 Heavy Traffic', '🛑 Route Blocked', '🔧 Engine Breakdown'].map(r => (
                <button 
                  key={r}
                  onClick={() => {
                    setIsCustomReason(false)
                    setStopReasonInput(r)
                  }}
                  className={`w-full text-left px-4 py-3 rounded border transition-colors ${stopReasonInput === r && !isCustomReason ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  {r}
                </button>
              ))}
              <button
                onClick={() => {
                  setIsCustomReason(true)
                  setStopReasonInput('')
                }}
                className={`w-full text-left px-4 py-3 rounded border transition-colors ${isCustomReason ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                ✍️ Other (Custom Reason)
              </button>
            </div>

            {isCustomReason && (
              <textarea 
                className="w-full border border-gray-300 rounded p-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none mb-4"
                rows="2"
                placeholder="Type reason here..."
                value={stopReasonInput}
                onChange={e => setStopReasonInput(e.target.value)}
              />
            )}
            
            <div className="flex justify-end gap-3 mt-auto">
              <button 
                onClick={() => setShowReasonPrompt(false)}
                className="px-4 py-2 rounded font-medium text-gray-600 hover:bg-gray-100"
              >
                Skip
              </button>
              <button 
                onClick={submitStopReason}
                disabled={!stopReasonInput.trim()}
                className="px-4 py-2 rounded font-medium bg-indigo-600 text-white disabled:opacity-50"
              >
                Submit Reason
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thank You Toast */}
      {showThankYou && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <span>✅</span>
          <span className="font-medium text-sm">Thank you for the update!</span>
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
        <MapView 
          role="driver" 
          sharing={sharing} 
          busId={busId} 
          onDeviation={(pos) => {
            if (!busId) return
            const dateStr = new Date().toISOString().split('T')[0]
            Promise.all([
              import('firebase/database'),
              import('../utils/firebase')
            ]).then(([ { ref, set }, { db } ]) => {
              set(ref(db, `deviations/${busId}/${dateStr}`), { position: pos, timestamp: Date.now() })
            })
          }}
        />
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
