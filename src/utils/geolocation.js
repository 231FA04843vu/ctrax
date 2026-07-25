/**
 * Geolocation tracking utility for bus location sharing
 * Handles GPS permission, tracking, and persistence
 */

import { setPosition, setPositionFor } from './busData'

let watchId = null
let isTracking = false
let currentBusId = null
let lastUpdateTime = 0
let persistenceInterval = null

// Track last known good position
let lastGoodPosition = null

// GPS quality tracking
let gpsQualityListeners = []

/**
 * Persist the last good GPS position to localStorage for recovery after refresh
 */
function persistLastGoodPosition(position) {
  try {
    const data = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    }
    localStorage.setItem('lastGoodGpsPosition', JSON.stringify(data))
    console.log('💾 Persisted GPS position:', data)
  } catch (e) {
    console.warn('Failed to persist GPS position:', e)
  }
}

/**
 * Get the last persisted GPS position from localStorage
 */
export function getLastGoodPosition() {
  try {
    const stored = localStorage.getItem('lastGoodGpsPosition')
    if (stored) {
      const data = JSON.parse(stored)
      console.log('📍 Retrieved last good position:', data)
      return data
    }
  } catch (e) {
    console.warn('Failed to retrieve last good position:', e)
  }
  return null
}

/**
 * Clear persisted position (e.g., on logout)
 */
export function clearLastGoodPosition() {
  try {
    localStorage.removeItem('lastGoodGpsPosition')
    console.log('🗑️ Cleared last good position')
  } catch (e) {
    console.warn('Failed to clear last good position:', e)
  }
}

/**
 * Subscribe to GPS quality changes
 */
export function onGpsQualityChange(callback) {
  gpsQualityListeners.push(callback)
  return () => {
    gpsQualityListeners = gpsQualityListeners.filter(cb => cb !== callback)
  }
}

/**
 * Notify all GPS quality listeners
 */
function notifyGpsQuality(accuracy) {
  gpsQualityListeners.forEach(cb => {
    try {
      cb(accuracy)
    } catch (e) {
      console.warn('GPS quality listener error:', e)
    }
  })
}

/**
 * Start tracking user's location and update Firebase
 * @param {Object} options - Geolocation options
 * @param {string} busId - Optional bus ID for per-bus tracking
 * @returns {boolean} - Whether tracking started successfully
 */
export function startLocationTracking(options = {}, busId = null) {
  if (isTracking) {
    console.log('📍 Location tracking already active')
    return true
  }

  const {
    enableHighAccuracy = true,
    timeout = 30000,
    maximumAge = 0,
    updateInterval = 500 // minimum interval between updates in ms
  } = options

  // Store busId for persistence
  if (busId) {
    currentBusId = busId
    try {
      sessionStorage.setItem('trackingBusId', busId)
    } catch (e) {}
  }

  if (!navigator.geolocation) {
    console.error('❌ Geolocation not supported')
    return false
  }

  console.log('🎯 Starting location tracking...', { busId: busId || 'global', updateInterval })

  const geoOptions = {
    enableHighAccuracy,
    timeout,
    maximumAge
  }

  const handleSuccess = (position) => {
    const now = Date.now()
    
    // Throttle updates to avoid excessive Firebase writes
    if (now - lastUpdateTime < updateInterval) {
      return
    }
    
    lastUpdateTime = now
    
    const coords = [position.coords.latitude, position.coords.longitude]
    const accuracy = position.coords.accuracy
    
    console.log('📍 GPS update:', {
      coords,
      accuracy: `${accuracy.toFixed(1)}m`,
      busId: busId || 'global'
    })

    // Store last good position
    lastGoodPosition = position
    persistLastGoodPosition(position)

    // Notify quality listeners
    notifyGpsQuality(accuracy)

    // Notify location listeners
    notifyLocationUpdate(position)

    // Update Firebase with position and accuracy
    try {
      if (busId) {
        setPositionFor(busId, coords, accuracy)
      } else {
        setPosition(coords, accuracy)
      }
    } catch (error) {
      console.error('❌ Failed to update position:', error)
    }
  }

  const handleError = (error) => {
    console.error('❌ Geolocation error:', {
      code: error.code,
      message: error.message
    })

    // Notify about poor quality
    notifyGpsQuality(9999)

    switch (error.code) {
      case error.PERMISSION_DENIED:
        console.error('Location permission denied')
        break
      case error.POSITION_UNAVAILABLE:
        console.error('Location information unavailable')
        break
      case error.TIMEOUT:
        console.error('Location request timeout')
        break
    }
  }

  try {
    watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      geoOptions
    )
    
    isTracking = true
    console.log('✅ Location tracking started')

    // Start persistence interval to keep position fresh
    if (!persistenceInterval) {
      persistenceInterval = setInterval(() => {
        if (lastGoodPosition) {
          persistLastGoodPosition(lastGoodPosition)
        }
      }, 30000) // Save every 30 seconds
    }

    return true
  } catch (error) {
    console.error('❌ Failed to start tracking:', error)
    return false
  }
}

/**
 * Stop tracking user's location
 */
export function stopLocationTracking() {
  if (!isTracking) {
    console.log('📍 Location tracking not active')
    return
  }

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }

  isTracking = false
  currentBusId = null
  lastUpdateTime = 0

  // Clear persistence
  if (persistenceInterval) {
    clearInterval(persistenceInterval)
    persistenceInterval = null
  }

  // Clear session storage
  try {
    sessionStorage.removeItem('trackingBusId')
  } catch (e) {}

  console.log('⏹️ Location tracking stopped')
}

/**
 * Check if location tracking is currently active
 */
export function isLocationTracking() {
  return isTracking
}

/**
 * Get current position once (not continuous tracking)
 */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      ...options
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = [position.coords.latitude, position.coords.longitude]
        console.log('📍 Current position:', coords)
        resolve(coords)
      },
      (error) => {
        console.error('❌ Failed to get position:', error)
        reject(error)
      },
      geoOptions
    )
  })
}

/**
 * Resume tracking if it was active before page refresh
 */
export function resumeTracking() {
  try {
    const busId = sessionStorage.getItem('trackingBusId')
    if (busId) {
      console.log('🔄 Resuming location tracking for bus:', busId)
      return startLocationTracking({
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
        updateInterval: 5000
      }, busId)
    }
  } catch (e) {
    console.warn('Failed to resume tracking:', e)
  }
  return false
}

/**
 * Request location permission from the user
 */
export async function requestLocationPermission() {
  if (!navigator.permissions || !navigator.permissions.query) {
    // Try to get current position to trigger permission prompt
    try {
      await getCurrentPosition({ timeout: 5000 })
      return 'granted'
    } catch (e) {
      return 'denied'
    }
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' })
    return result.state
  } catch (e) {
    console.warn('Permission query failed:', e)
    return 'prompt'
  }
}

/**
 * Location update listeners
 */
let locationListeners = []

export function onLocationUpdate(callback) {
  locationListeners.push(callback)
  return () => {
    locationListeners = locationListeners.filter(cb => cb !== callback)
  }
}

function notifyLocationUpdate(position) {
  locationListeners.forEach(cb => {
    try {
      cb(position)
    } catch (e) {
      console.warn('Location listener error:', e)
    }
  })
}

/**
 * Check if current position is within range of a stop
 */
export function isWithinRange(currentPos, stopPos, rangeMeters = 100) {
  if (!currentPos || !stopPos) return false
  
  const R = 6371000 // Earth radius in meters
  const lat1 = currentPos[0] * Math.PI / 180
  const lat2 = stopPos[0] * Math.PI / 180
  const dLat = (stopPos[0] - currentPos[0]) * Math.PI / 180
  const dLon = (stopPos[1] - currentPos[1]) * Math.PI / 180
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const distance = R * c
  
  return distance <= rangeMeters
}

/**
 * Calculate speed in km/h between two positions
 */
export function calculateSpeedKmh(pos1, pos2, timeMs) {
  if (!pos1 || !pos2 || !timeMs) return 0
  
  const R = 6371 // Earth radius in km
  const lat1 = pos1[0] * Math.PI / 180
  const lat2 = pos2[0] * Math.PI / 180
  const dLat = (pos2[0] - pos1[0]) * Math.PI / 180
  const dLon = (pos2[1] - pos1[1]) * Math.PI / 180
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const distanceKm = R * c
  
  const timeHours = timeMs / (1000 * 60 * 60)
  return distanceKm / timeHours
}

/**
 * Mark a stop as completed (for stop tracking)
 */
export function completeStopTracking(stopId) {
  try {
    const completed = JSON.parse(localStorage.getItem('completedStops') || '[]')
    if (!completed.includes(stopId)) {
      completed.push(stopId)
      localStorage.setItem('completedStops', JSON.stringify(completed))
    }
  } catch (e) {
    console.warn('Failed to save completed stop:', e)
  }
}

/**
 * Load tracking state from storage
 */
export function loadTrackingState() {
  try {
    const busId = sessionStorage.getItem('trackingBusId')
    return {
      isTracking,
      busId,
      lastGoodPosition: getLastGoodPosition()
    }
  } catch (e) {
    return { isTracking: false, busId: null, lastGoodPosition: null }
  }
}

/**
 * Get last known position (alias for getLastGoodPosition)
 */
export function getLastPosition() {
  return getLastGoodPosition()
}

/**
 * Check if GPS quality is good (accuracy < 100m)
 */
export function isGpsQualityGood(accuracy) {
  return accuracy && accuracy < 100
}

// Start persisting state
if (!persistenceInterval) {
  persistenceInterval = setInterval(() => {
    if (isTracking && currentBusId) {
      try {
        sessionStorage.setItem('trackingBusId', currentBusId)
      } catch (e) {}
    }
  }, 5000)
}
