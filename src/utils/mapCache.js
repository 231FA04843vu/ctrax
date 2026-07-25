/**
 * IndexedDB-based map tile caching for offline support
 * Caches OpenStreetMap tiles to improve performance and enable offline viewing
 */

const DB_NAME = 'MapTileCache'
const DB_VERSION = 1
const STORE_NAME = 'tiles'
const CACHE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const MAX_CACHE_SIZE_MB = 100 // Maximum cache size in MB

let db = null

/**
 * Initialize IndexedDB for tile caching
 */
export async function initMapCache() {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('Failed to open map cache database')
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      console.log('✅ Map cache database initialized')
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = event.target.result
      
      // Create object store for tiles if it doesn't exist
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'url' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        console.log('Created tile cache store')
      }
    }
  })
}

/**
 * Get a tile from cache or fetch from network
 */
export async function getCachedTile(url) {
  try {
    // Ensure database is initialized
    if (!db) {
      await initMapCache()
    }

    // Try to get from cache first
    const cached = await getTileFromCache(url)
    if (cached) {
      // Check if cache is still valid
      const age = Date.now() - cached.timestamp
      if (age < CACHE_EXPIRY_MS) {
        console.log('📦 Using cached tile:', url)
        return new Response(cached.blob, {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'image/png' }
        })
      } else {
        // Cache expired, remove it
        await removeTileFromCache(url)
      }
    }

    // Fetch from network
    console.log('🌐 Fetching tile from network:', url)
    const response = await fetch(url)
    
    if (response.ok) {
      const blob = await response.blob()
      
      // Cache the tile for future use
      await cacheTile(url, blob)
      
      return new Response(blob, {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'image/png' }
      })
    }

    return response
  } catch (error) {
    console.error('Error getting cached tile:', error)
    // Fallback to direct fetch
    return fetch(url)
  }
}

/**
 * Get tile from IndexedDB cache
 */
async function getTileFromCache(url) {
  if (!db) return null

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(url)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Cache a tile in IndexedDB
 */
async function cacheTile(url, blob) {
  if (!db) return

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      
      const tileData = {
        url,
        blob,
        timestamp: Date.now(),
        size: blob.size
      }

      const request = store.put(tileData)

      request.onsuccess = () => {
        // Check and manage cache size
        manageCacheSize()
        resolve()
      }
      request.onerror = () => reject(request.error)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Remove a tile from cache
 */
async function removeTileFromCache(url) {
  if (!db) return

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(url)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Manage cache size - remove old tiles if cache is too large
 */
async function manageCacheSize() {
  if (!db) return

  try {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = async () => {
      const tiles = request.result
      
      // Calculate total size
      const totalSize = tiles.reduce((sum, tile) => sum + (tile.size || 0), 0)
      const totalSizeMB = totalSize / (1024 * 1024)

      if (totalSizeMB > MAX_CACHE_SIZE_MB) {
        console.log(`🗑️ Cache size (${totalSizeMB.toFixed(2)}MB) exceeds limit, cleaning up...`)
        
        // Sort by timestamp (oldest first)
        tiles.sort((a, b) => a.timestamp - b.timestamp)
        
        // Remove oldest tiles until under limit
        let currentSize = totalSize
        for (const tile of tiles) {
          if (currentSize / (1024 * 1024) <= MAX_CACHE_SIZE_MB * 0.8) break
          
          await removeTileFromCache(tile.url)
          currentSize -= tile.size
        }
        
        console.log(`✅ Cache cleaned up to ${(currentSize / (1024 * 1024)).toFixed(2)}MB`)
      }
    }
  } catch (error) {
    console.error('Error managing cache size:', error)
  }
}

/**
 * Clear all cached tiles
 */
export async function clearMapCache() {
  if (!db) {
    await initMapCache()
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        console.log('✅ Map cache cleared')
        resolve()
      }
      request.onerror = () => reject(request.error)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  if (!db) {
    await initMapCache()
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const tiles = request.result
        const totalSize = tiles.reduce((sum, tile) => sum + (tile.size || 0), 0)
        
        resolve({
          tileCount: tiles.length,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
          oldestTile: tiles.length > 0 ? new Date(Math.min(...tiles.map(t => t.timestamp))) : null,
          newestTile: tiles.length > 0 ? new Date(Math.max(...tiles.map(t => t.timestamp))) : null
        })
      }
      request.onerror = () => reject(request.error)
    } catch (error) {
      reject(error)
    }
  })
}
