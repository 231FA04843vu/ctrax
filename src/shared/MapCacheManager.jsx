import React, { useEffect, useState } from 'react'
import { getCacheStats, clearMapCache } from '../utils/mapCache'

export default function MapCacheManager() {
  const [stats, setStats] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    loadStats()
  }, [cleared])

  async function loadStats() {
    try {
      const data = await getCacheStats()
      setStats(data)
    } catch (e) {
      console.warn('Failed to load cache stats:', e)
      setStats({ tiles: 0, sizeMB: 0, oldestDays: 0 })
    }
  }

  async function handleClear() {
    if (!window.confirm('Clear all cached map tiles? They will be re-downloaded as needed.')) {
      return
    }
    setClearing(true)
    try {
      await clearMapCache()
      setCleared(!cleared)
    } catch (e) {
      console.error('Failed to clear cache:', e)
    } finally {
      setClearing(false)
    }
  }

  if (!stats) {
    return (
      <div className="p-4 bg-gray-50 rounded border border-gray-200">
        <div className="text-sm text-gray-500">Loading cache info...</div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">📍 Map Cache Manager</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 mb-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-gray-600">Cached Tiles</div>
            <div className="text-2xl font-bold text-blue-600">{stats.tiles}</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-gray-600">Cache Size</div>
            <div className="text-2xl font-bold text-green-600">{stats.sizeMB} MB</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="text-xs text-gray-600">Oldest Cache</div>
            <div className="text-2xl font-bold text-purple-600">{stats.oldestDays}d</div>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          {stats.tiles > 0 
            ? `You have ${stats.tiles} map tiles cached locally for faster offline loading. Tiles auto-expire after 30 days.`
            : 'No cached map tiles yet. They will be downloaded and cached as you use the map.'}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleClear}
          disabled={clearing || stats.tiles === 0}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
        >
          {clearing ? 'Clearing...' : 'Clear Cache'}
        </button>
        <button
          onClick={loadStats}
          disabled={clearing}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="text-xs text-gray-500 border-t pt-3">
        💡 <strong>Tip:</strong> Clear cache if maps load too slowly or to free up storage space. Maps are automatically re-cached as you browse.
      </div>
    </div>
  )
}
