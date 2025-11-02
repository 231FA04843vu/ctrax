import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ApkScanner from './ApkScanner'

export default function LogoScannerFlip(){
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Close the scanner when the user scrolls, touches outside, or presses Escape.
    // Apply across device sizes (desktop and mobile).
    if (typeof window === 'undefined') return
    let mounted = true
    const onScroll = () => { if (mounted && open) setOpen(false) }
    const onTouchStart = () => { if (mounted && open) setOpen(false) }
    const onKey = (e) => { if (e && e.key === 'Escape' && mounted && open) setOpen(false) }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('keydown', onKey)

    return () => {
      mounted = false
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const containerStyle = {
    perspective: 900,
    width: 160,
    height: 160,
  }

  const cardVariants = {
    closed: { rotateY: 0 },
    open: { rotateY: 180 },
  }

  const faceStyle = {
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <div className="flex flex-col items-center">
      <div style={containerStyle} className="relative">
        <motion.div
          animate={open ? 'open' : 'closed'}
          variants={cardVariants}
          transition={{ duration: 0.6 }}
          style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', position: 'relative' }}
        >
          {/* Front: Logo */}
          <div style={{ ...faceStyle }}>
            {!open && (
              <button
                onClick={() => setOpen(true)}
                aria-label="Show APK scanner"
                className="w-40 h-40 bg-white rounded-lg flex items-center justify-center border hover:shadow transition"
                style={{ width: '160px', height: '160px' }}
              >
                <img src="/logo.svg" alt="CTraX logo" className="w-28 h-28" />
              </button>
            )}
          </div>

          {/* Back: Scanner (rotated) */}
          <div style={{ ...faceStyle, transform: 'rotateY(180deg)' }}>
            <div className="bg-white p-2 rounded" style={{ width: 160 }}>
              <div className="flex justify-end -mt-2 -mr-2">
                <button onClick={() => setOpen(false)} className="bg-white rounded-full p-1 shadow border" aria-label="Close scanner">✕</button>
              </div>
              <div className="flex justify-center">
                <div onClick={() => setOpen(false)} style={{ cursor: 'pointer' }}>
                  <ApkScanner />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      <div className="mt-3 text-xs text-gray-500">Scan or tap to install</div>
    </div>
  )
}
