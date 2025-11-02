import React from 'react'

// Simple QR code scanner block for APK download.
// Uses Google Charts QR generation (no extra deps). If you prefer an offline QR generator
// we can add a small library instead.
export default function ApkScanner({ url = '/download/ctrax-latest.apk', size = 160 }){
  const encoded = encodeURIComponent(typeof window !== 'undefined' ? (new URL(url, window.location.origin)).toString() : url)
  const qrSrc = `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encoded}&chld=L|1`

  return (
    <div className="flex flex-col items-center gap-3">
      <img src={qrSrc} alt="Scan to download CTraX APK" width={size} height={size} className="rounded-md border" />
      <div className="text-xs text-gray-500 text-center">Scan to download the APK directly to your Android device</div>
    </div>
  )
}
