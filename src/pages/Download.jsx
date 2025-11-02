import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { onAppConfig } from '../utils/appConfig'
// load DotLottieReact dynamically to avoid runtime errors on constrained mobile browsers

export default function Download() {
  const anchorRef = useRef(null)
  const [started, setStarted] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0) // 0-100, 0 means not started or unknown
  const [animPlaying, setAnimPlaying] = useState(false)
  const animTimeoutRef = useRef(null)
  const ANIM_PLAY_MS = 3500 // duration to show the attention animation so it can finish playing

  // Use assets path to avoid accidental direct access under /download which may expose raw APK bytes
  const apkPath = '/assets/ctrax-latest.apk'
  const [DotLottieComp, setDotLottieComp] = useState(null)
  const [appCfg, setAppCfg] = useState({ version: 'v1.0.0', size: '~12 MB', directUrl: 'https://www.upload-apk.com/en/T1VCNGKtl3b4MYy' })

  useEffect(() => {
    // nothing automatic on mount; user must click the button to start download
  }, [])

  // subscribe to admin-configurable app details
  useEffect(() => {
    const off = onAppConfig((cfg) => setAppCfg(cfg))
    return () => { try { off && off() } catch {} }
  }, [])

  async function startDownload() {
  setStarted(true)
  setDownloadProgress(0)
  // start the attention animation when user initiates download and ensure it plays fully
  if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current)
  setAnimPlaying(true)
  animTimeoutRef.current = setTimeout(() => setAnimPlaying(false), ANIM_PLAY_MS)
    try {
      const res = await fetch(apkPath, { cache: 'no-cache' })
      if (!res.ok) throw new Error('Failed to fetch')

      // stream the response so we can show progress
      const contentLength = res.headers.get('content-length')
      if (!res.body || !contentLength) {
        // fallback to blob if streaming unsupported or length unknown
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'ctrax-latest.apk'
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        setDownloadProgress(100)
        return
      }

      const total = parseInt(contentLength, 10)
      const reader = res.body.getReader()
      const chunks = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        const pct = Math.round((received / total) * 100)
        setDownloadProgress(pct)
      }

      const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ctrax-latest.apk'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setDownloadProgress(100)
    } catch (e) {
      // fallback navigation
      window.location.href = apkPath
    } finally {
      // give the user a second to see 100% then reset
      setTimeout(() => {
        setStarted(false)
        setTimeout(() => setDownloadProgress(0), 300)
      }, 600)
      // don't forcibly stop anim here — animTimeoutRef will allow the animation to finish
    }
  }

  function handleGetAppClick(e){
    // scroll to the main Download APK button; do not start download here
    if (anchorRef && anchorRef.current) {
      anchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      try { anchorRef.current.focus({ preventScroll: true }) } catch (err) { anchorRef.current.focus() }
    }
  }

  // dynamically import dotlottie component only when needed
  useEffect(() => {
    let mounted = true
    if (animPlaying && !DotLottieComp) {
      import('@lottiefiles/dotlottie-react').then(mod => {
        if (mounted) setDotLottieComp(() => mod.DotLottieReact)
      }).catch(() => {
        /* ignore import failure on older browsers */
      })
    }
    return () => { mounted = false }
  }, [animPlaying, DotLottieComp])

    // cleanup anim timeout on unmount
    useEffect(() => {
      return () => {
        if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current)
      }
    }, [])
  
  const screenshots = [
    { src: '/screenshots/s1.jpg', title: 'Home map & live buses', desc: 'See live vehicle locations, stop ETAs, and quick route previews from the map — updated in realtime.' },
    { src: '/screenshots/s2.jpg', title: 'Stop details & ETA', desc: 'Tap any stop to view scheduled arrivals, live ETA, and nearby bus info. Helpful for quick planning.' },
    { src: '/screenshots/s3.jpg', title: 'Student timeline', desc: 'Track a student’s assigned bus and stops, with arrival notifications and safety checks.' },
    { src: '/screenshots/s4.jpg', title: 'Driver tools', desc: 'Driver-facing screen for route updates, check-ins, and incident reporting — optimized for quick use.' },
  ]

  function Carousel({ images, autoMs = 6000 }){
    const [index, setIndex] = useState(0)
    const total = images.length
    const timerRef = useRef(null)

    useEffect(() => {
      if (autoMs > 0) {
        timerRef.current = setInterval(() => setIndex(i => (i + 1) % total), autoMs)
      }
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [autoMs, total])

    function resetTimer(){
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = setInterval(() => setIndex(i => (i + 1) % total), autoMs) }
    }
    function prev(){ setIndex(i => (i - 1 + total) % total); resetTimer() }
    function next(){ setIndex(i => (i + 1) % total); resetTimer() }

    return (
      <div className="relative md:grid md:grid-cols-2 gap-6 items-center">
        {/* LEFT: fade-based image area */}
        <div className="relative overflow-hidden rounded-lg h-[64vh] md:h-[72vh] flex items-center justify-center bg-white">
          {images.map((img, i) => (
              <motion.img
              key={img.src}
              src={img.src}
              alt={`screenshot-${i+1}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={i === index ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.9 }}
              // increase the image's own width (percent-based) while keeping the container layout
              className={`absolute max-h-[64vh] md:max-h-[72vh] w-auto object-contain rounded shadow-sm ${i === index ? '' : 'pointer-events-none'}`}
              loading={i === index ? 'eager' : 'lazy'}
            />
          ))}

          {/* Controls overlayed on the image column */}
          <button aria-label="Previous" onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow">‹</button>
          <button aria-label="Next" onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow">›</button>
        </div>

  {/* RIGHT: highlighted info panel for the active image */}
  <div className="p-6 bg-white rounded-lg shadow border border-gray-100">
          <h4 className="text-xl font-extrabold text-gray-900">{images[index].title}</h4>
          <p className="mt-3 text-gray-600">{images[index].desc}</p>

          {/* small CTA under info */}
          <div className="mt-5">
            <button onClick={handleGetAppClick} disabled={started} className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 disabled:opacity-60">
              {started ? (downloadProgress > 0 ? `${downloadProgress}%` : 'Downloading…') : 'Get the App'}
            </button>
            {/* Direct APK link removed — use the Download button above to stream the APK with progress */}
          </div>
          {started && (
            <div className="mt-3">
              {downloadProgress > 0 ? (
                <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                  <div className="bg-green-600 h-2 transition-all" style={{ width: `${downloadProgress}%` }} />
                </div>
              ) : (
                <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-green-400 via-green-600 to-green-400 animate-[progress_1.2s_linear_infinite]" style={{ width: '40%' }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dots (span full width under the grid on small screens) */}
        <div className="col-span-full flex items-center justify-center gap-2 mt-3">
          {images.map((_, i) => (
            <button key={i} aria-label={`Go to slide ${i+1}`} onClick={() => { setIndex(i); resetTimer() }} className={`w-2 h-2 rounded-full ${i === index ? 'bg-gray-900' : 'bg-gray-300'}`} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full">
        {/* HERO */}
  <div className="bg-white w-full shadow p-6 md:p-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <h1 className="text-3xl font-extrabold text-gray-900">CTraX — Campus Bus Tracker</h1>
            <p className="mt-3 text-gray-600">Fast, reliable, and private live bus tracking for campuses. Install the Android app to get push alerts, offline map previews, and an optimized student &amp; parent experience.</p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-sm text-gray-500">Latest</div>
                <div className="font-semibold">{appCfg.version}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-sm text-gray-500">Size</div>
                <div className="font-semibold">{appCfg.size}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-sm text-gray-500">Android</div>
                <div className="font-semibold">Android 6.0+</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <img src="/logo.svg" alt="CTraX logo" className="w-24 h-24 mb-3" />
            {/* small Lottie animation — only play while downloading */}
            {animPlaying && DotLottieComp ? (
              <div className="w-20 h-20 mb-3">
                <DotLottieComp src="https://lottie.host/ed5c6f14-15f8-4624-832e-5e1a860aacfb/owBcSEwXwA.lottie" loop={false} autoplay />
              </div>
            ) : null}
            <button ref={anchorRef} onClick={startDownload} disabled={started} className="w-full inline-flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 disabled:opacity-60">
              {started ? (downloadProgress > 0 ? `${downloadProgress}%` : 'Downloading…') : 'Download APK'}
            </button>
            {/* progress bar under the main button */}
            {started && (
              <div className="w-full mt-2">
                {downloadProgress > 0 ? (
                  <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                    <div className="bg-green-600 h-2 transition-all" style={{ width: `${downloadProgress}%` }} />
                  </div>
                ) : (
                  <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-green-400 via-green-600 to-green-400 animate-[progress_1.2s_linear_infinite]" style={{ width: '40%' }} />
                  </div>
                )}
              </div>
            )}
            {/* Direct APK link removed — use the Download button above to stream the APK with progress */}
            <a href="#play" className="mt-2 text-xs text-gray-500">Or find on Google Play (coming soon)</a>
            {/* Mobile fallback direct link when button doesn't work */}
            <div className="mt-2 text-xs text-gray-600 sm:hidden">
              Having trouble on mobile? Try the direct link:
              <a
                href={appCfg.directUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-green-700 underline"
              >
                Download via upload-apk.com
              </a>
            </div>
          </div>
        </div>

        {/* FEATURES */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold">Real-time Tracking</h3>
            <p className="text-sm text-gray-600 mt-2">Live vehicle locations and accurate ETAs for every stop. See the vehicle move on the map in real-time.</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold">Parent Alerts</h3>
            <p className="text-sm text-gray-600 mt-2">Push notifications for arrival, delay, and safety events (requires app install).</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold">Driver Tools</h3>
            <p className="text-sm text-gray-600 mt-2">Driver check-ins, route updates, and incident reporting for safer operations.</p>
          </div>
        </section>

        {/* SCREENSHOTS */}
        <section className="mt-8 bg-white w-full shadow p-6">
          <h3 className="font-semibold">App screenshots</h3>
          <p className="text-sm text-gray-500 mt-1">Swipe or use controls to browse screenshots.</p>
          <div className="mt-4 w-full">
            <Carousel images={screenshots} autoMs={6000} />
          </div>
        </section>

        {/* CHANGES & PERMISSIONS */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="font-semibold">What's new</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 mt-3">
              <li>Stable live tracking and ETA improvements</li>
              <li>Reduced battery usage during background tracking</li>
              <li>Bug fixes and UI polish</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="font-semibold">Permissions</h4>
            <p className="text-sm text-gray-600 mt-2">The app requests location permission for live tracking and optional push notifications for alerts. Location data is used to show vehicles and ETAs; it is not shared publicly.</p>
          </div>
        </section>

        <div className="mt-8 text-center text-sm text-gray-500">Questions or need help installing? Contact support@ctrax.example or visit the Help section after installing the app.</div>
      </div>
    </div>
  )
}
