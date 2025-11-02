import React, { useMemo, useState, useEffect } from 'react'

// Simple QR code scanner block for APK download using Google Charts (no extra deps).
// This component prefers rendering a direct <img> for the QR so it works reliably in dev and prod.
export default function ApkScanner({ url = '/assets/ctrax-latest.apk', size = 160 }){
  const [qrData, setQrData] = useState('')
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    let mounted = true
    async function gen(){
      try {
        const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : ''
        const target = new URL(url, origin).toString()
        // dynamic import of lightweight qrcode lib to avoid adding sync dependency cost to main bundle
        const QR = (await import('qrcode')).default
        const data = await QR.toDataURL(target, { margin: 1, width: size })
        if (mounted) setQrData(data)
      } catch (e) {
        if (mounted) setErrored(true)
      }
    }
    gen()
    return () => { mounted = false }
  }, [url, size])

  const placeholder = '/logo.svg'

  return (
    <div className="flex flex-col items-center gap-3">
      {qrData && !errored ? (
        <img src={qrData} alt="Scan to download CTraX APK" width={size} height={size} className="rounded-md border" />
      ) : (
        <div className="w-40 h-40 flex items-center justify-center rounded-md border bg-white">
          <img src={placeholder} alt="CTraX" className="w-24 h-24" />
        </div>
      )}
      <div className="text-xs text-gray-500 text-center">Scan to download the APK directly to your Android device</div>
    </div>
  )
}
