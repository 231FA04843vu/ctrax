import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { onBuses } from '../utils/busData'
import ApkScanner from '../shared/ApkScanner'

// Small inline component: shows logo and toggles scanner on click
function LogoScanner(){
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col items-center">
      {!open ? (
        <button onClick={() => setOpen(true)} className="w-40 h-40 bg-white rounded-lg flex items-center justify-center border hover:shadow transition" aria-label="Show APK scanner">
          <img src="/logo.svg" alt="CTraX logo" className="w-28 h-28" />
        </button>
      ) : (
        <div className="relative">
          <div className="absolute right-0 top-0 -mt-2 -mr-2">
            <button onClick={() => setOpen(false)} className="bg-white rounded-full p-1 shadow border" aria-label="Close scanner">✕</button>
          </div>
          <div className="bg-white p-2 rounded">
            <ApkScanner />
          </div>
        </div>
      )}
      <div className="mt-3 text-xs text-gray-500">Scan or tap to install</div>
    </div>
  )
}

export default function Landing() {
  const [busCount, setBusCount] = useState(3)
  const [lastUpdated, setLastUpdated] = useState(() => new Date())

  // Banner slider data
  const banners = useMemo(() => ([
    {
      title: 'Track your college bus live',
      subtitle: 'Accurate ETAs, clear maps, and smooth experience',
      img: 'https://source.unsplash.com/1600x700/?school-bus,students',
      fallback: '/banners/bus-live.svg',
    },
    {
      title: 'Parents stay informed',
      subtitle: 'Arrival alerts and delay notifications',
      img: 'https://source.unsplash.com/1600x700/?gps,smartphone,map',
      fallback: '/banners/parent-alerts.svg',
    },
    {
      title: 'Driver-friendly tools',
      subtitle: 'One tap to start sharing and follow the route',
      img: 'https://source.unsplash.com/1600x700/?bus,driver,cabin',
      fallback: '/banners/driver-tools.svg',
    },
    {
      title: 'Transit that scales',
      subtitle: 'City buses, campus shuttles, and intercity fleets',
      img: 'https://source.unsplash.com/1600x700/?city-bus,transit',
      fallback: '/banners/transit-scalable.svg',
    },
  ]), [])
  const [slide, setSlide] = useState(0)
  const autoRef = useRef(null)

  // subscribe to realtime buses list and compute active count
  useEffect(() => {
    const off = onBuses((list) => {
      try {
        const active = (list || []).filter(b => b && (b.sharing || (b.sim && b.sim.active))).length
        setBusCount(active)
        setLastUpdated(new Date())
      } catch {
        setBusCount(0)
      }
    })
    return off
  }, [])

  // autoplay for banners
  useEffect(() => {
    if (autoRef.current) clearInterval(autoRef.current)
    autoRef.current = setInterval(() => {
      setSlide(s => (s + 1) % banners.length)
    }, 4000)
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [banners.length])

  // Simple reusable animation preset
  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
  }

  return (
    <div className="w-full min-h-screen bg-gray-50 flex flex-col overflow-x-hidden">
  {/* Home page: center on mobile, full-bleed on desktop */}
  <div className="w-full max-w-none mx-auto px-4 sm:px-6 lg:px-0 py-10 space-y-14">
        {/* SLIDING BANNERS */}
        <section className="relative w-full">
          <div className="relative overflow-hidden rounded-2xl shadow bg-black/5">
            <div
              className="flex transition-transform duration-700 ease-out"
              style={{ width: `${banners.length * 100}%`, transform: `translateX(-${(slide * 100) / banners.length}%)` }}
            >
              {banners.map((b, i) => (
                <div key={i} className="w-full" style={{ width: `${100 / banners.length}%` }}>
                  <div className="relative w-full h-[220px] sm:h-[300px] md:h-[380px] lg:h-[460px]">
                    <img
                      src={b.img}
                      alt={b.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const el = e.currentTarget
                        if (el.dataset.fb !== '1' && b.fallback){
                          el.dataset.fb = '1'
                          el.src = b.fallback
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                      <div className="max-w-4xl">
                        <div className="inline-block bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-gray-800 mb-2">Campus transit</div>
                        <h3 className="text-white text-xl sm:text-2xl md:text-3xl font-bold drop-shadow">{b.title}</h3>
                        <p className="text-white/90 text-sm sm:text-base drop-shadow mt-1">{b.subtitle}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <button
              aria-label="Previous slide"
              onClick={() => setSlide(s => (s - 1 + banners.length) % banners.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button
              aria-label="Next slide"
              onClick={() => setSlide(s => (s + 1) % banners.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/70 backdrop-blur px-2 py-1 rounded-full shadow">
              {banners.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to slide ${i+1}`}
                  onClick={() => setSlide(i)}
                  className={`w-2 h-2 rounded-full ${i === slide ? 'bg-gray-900' : 'bg-gray-400'}`}
                />
              ))}
            </div>
          </div>
        </section>
        
        {/* HERO SECTION */}
        <motion.section
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center"
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.div className="space-y-6" variants={fadeInUp}>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900">
              CTraX — Live, Safe, Reliable
            </h1>
            <p className="text-base sm:text-lg text-gray-700">
              Real-time bus tracking for campuses. Parents follow vehicles live, students see ETAs, 
              and drivers receive route updates. Designed for mobile and desktop — easily integrates 
              a live WebSocket stream.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link to="/login/student" className="inline-flex items-center px-5 py-3 bg-blue-600 text-white rounded-lg shadow hover:scale-105 transform transition-all duration-300">
                Student Login
              </Link>
              <Link to="/login/parent" className="inline-flex items-center px-5 py-3 bg-indigo-600 text-white rounded-lg shadow hover:scale-105 transform transition-all duration-300">
                Parent Login
              </Link>
              <Link to="/driver" className="inline-flex items-center px-5 py-3 bg-green-600 text-white rounded-lg shadow hover:scale-105 transform transition-all duration-300">
                Driver Dashboard
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Real-time', value: 'Live locations' },
                { label: 'Safe', value: 'Secure routes' },
                { label: 'Reliable', value: 'Driver check-ins' },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="text-sm text-gray-500">{label}</div>
                  <div className="text-md font-semibold">{value}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.aside className="bg-white rounded-lg shadow p-6" variants={fadeInUp}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-gray-500">Buses Active</div>
                <div className="text-3xl font-bold">{busCount}</div>
                <div className="text-xs text-gray-400">Updated: {lastUpdated.toLocaleTimeString()}</div>
              </div>
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="3" width="8" height="14" rx="1" fill="#60A5FA" />
                  <rect x="14" y="7" width="8" height="10" rx="1" fill="#34D399" />
                </svg>
              </div>
            </div>

            <div className="mt-4 h-48 sm:h-56 lg:h-64 bg-gradient-to-br from-sky-50 to-green-50 rounded-md flex items-center justify-center text-gray-500">
              <div className="text-center px-4">
                <div className="font-medium">Map preview</div>
                <div className="text-sm mt-1">Interactive map available in dashboards</div>
              </div>
            </div>

            <p className="mt-4 text-sm text-gray-600">
              Demo feed — replace with WebSocket for production to stream vehicle positions.
            </p>
          </motion.aside>
        </motion.section>

        {/* FEATURES SECTION */}
        <motion.section
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {[
            { title: 'Live Tracking & ETA', desc: 'See vehicles on the map and accurate ETAs for every stop.' },
            { title: 'Driver Tools', desc: 'Routes, check-ins, and incident reporting for drivers.' },
            { title: 'Parent Alerts', desc: 'Push notifications for arrival, delays, or safety events.' },
          ].map(({ title, desc }) => (
            <motion.div
              key={title}
              className="p-5 bg-white rounded-lg border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
              variants={fadeInUp}
            >
              <h4 className="font-semibold">{title}</h4>
              <p className="text-sm text-gray-600 mt-2">{desc}</p>
            </motion.div>
          ))}
        </motion.section>

        {/* REGISTRATION & GUIDES — student / parent / driver */}
        <motion.section
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {/* Student registration steps */}
            <motion.div
              variants={fadeInUp}
              className="relative bg-white rounded-[28px] shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-sky-50/70 to-white pointer-events-none" />
              <div className="relative p-6 flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-inner mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.761 0 5-2.462 5-5.5S14.761 1 12 1 7 3.462 7 6.5 9.239 12 12 12zM4 22c0-3.315 3.582-6 8-6s8 2.685 8 6H4z"/></svg>
                </div>
                <h3 className="text-lg font-semibold">Student Registration</h3>
                <p className="text-sm text-gray-600">Create your account and connect to your bus.</p>
                {/* Vertical steps */}
                <div className="mt-4 relative">
                  <div className="absolute left-4 top-8 bottom-0 w-px bg-gray-200" />
                  {[
                    'Name and Roll number',
                    'Email, Phone, Parent phone',
                    'Bus ID → then choose your Stop',
                    'Password (Parent uses Roll no)'
                  ].map((text, i) => (
                    <div key={i} className="relative flex gap-4 items-start py-2">
                      <div className="z-10 flex-none w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white bg-blue-600 shadow">{i+1}</div>
                      <div className="text-sm text-gray-700 pt-1">{text}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex gap-3">
                  <Link to="/register/student" className="px-4 py-2 bg-blue-600 text-white rounded">Register</Link>
                  <Link to="/login/student" className="px-4 py-2 border rounded">Login</Link>
                </div>
              </div>
            </motion.div>

          {/* Parent tracking path */}
          <motion.div
            variants={fadeInUp}
            className="relative bg-white rounded-[28px] shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/70 to-white pointer-events-none" />
            <div className="relative p-6 flex flex-col h-full">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-inner mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm-7 9a7 7 0 0 1 14 0z"/></svg>
              </div>
              <h3 className="text-lg font-semibold">Parent Tracking</h3>
              <p className="text-sm text-gray-600">Login with parent phone and child’s Roll number.</p>
              <div className="mt-4 relative">
                <div className="absolute left-4 top-8 bottom-0 w-px bg-gray-200" />
                {[
                  'Open Parent Login',
                  'Enter Parent phone',
                  'Enter Roll number (password)',
                  'View bus on map + ETAs'
                ].map((text, i) => (
                  <div key={i} className="relative flex gap-4 items-start py-2">
                    <div className="z-10 flex-none w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white bg-indigo-600 shadow">{i+1}</div>
                    <div className="text-sm text-gray-700 pt-1">{text}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <Link to="/login/parent" className="px-4 py-2 bg-indigo-600 text-white rounded">Parent Login</Link>
              </div>
            </div>
          </motion.div>

          {/* Driver registration path */}
          <motion.div
            variants={fadeInUp}
            className="relative bg-white rounded-[28px] shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/70 to-white pointer-events-none" />
            <div className="relative p-6 flex flex-col h-full">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a2 2 0 0 1-2 2v2h-2v-2H8v2H6v-2a2 2 0 0 1-2-2zM7 5h10a1 1 0 0 1 1 1v6H6V6a1 1 0 0 1 1-1z"/></svg>
              </div>
              <h3 className="text-lg font-semibold">Driver Onboarding</h3>
              <p className="text-sm text-gray-600">Apply to join, get approved by admin, and start live updates.</p>
              <div className="mt-4 relative">
                <div className="absolute left-4 top-8 bottom-0 w-px bg-gray-200" />
                {[
                  'Apply with Name, Phone, Bus ID',
                  'Admin approval (no self-register)',
                  'Receive SMS with password',
                  'Driver Login → Start Sharing'
                ].map((text, i) => (
                  <div key={i} className="relative flex gap-4 items-start py-2">
                    <div className="z-10 flex-none w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white bg-emerald-600 shadow">{i+1}</div>
                    <div className="text-sm text-gray-700 pt-1">{text}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <Link to="/login/driver" className="px-4 py-2 bg-emerald-600 text-white rounded">Driver Login</Link>
              </div>
            </div>
          </motion.div>

          
        </motion.section>
        {/* ANDROID DOWNLOAD — simple install steps for mobile users */}
        <motion.section
          className="bg-white rounded-lg border p-6 shadow-sm"
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold">Get the CTraX Android app</h3>
              <p className="text-sm text-gray-600 mt-2">Install the mobile app to receive push alerts, quick access to your child’s bus, and offline map previews.</p>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                <a href="/download/ctrax-latest.apk" className="inline-flex items-center gap-3 px-5 py-3 bg-green-600 text-white rounded-lg shadow hover:bg-green-700">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="opacity-90"><path d="M12 2l3 6 6 1-4.5 4 1 6L12 17l-5.5 2 1-6L3 9l6-1 3-6z" fill="currentColor"/></svg>
                  Download APK (Android)
                </a>
                <a href="https://play.google.com/store/apps" target="_blank" rel="noreferrer" className="mt-3 sm:mt-0 inline-block text-sm text-gray-600">Or find on Google Play (coming soon)</a>
              </div>

              <ol className="mt-6 space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <div className="flex-none w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-semibold flex items-center justify-center">1</div>
                  <div>
                    <div className="font-medium">Download the APK</div>
                    <div className="text-gray-500">Tap the APK link above and save the file to your device.</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-none w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-semibold flex items-center justify-center">2</div>
                  <div>
                    <div className="font-medium">Enable installs</div>
                    <div className="text-gray-500">Go to Settings → Security and allow installs from unknown sources for your browser (temporary).</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-none w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-semibold flex items-center justify-center">3</div>
                  <div>
                    <div className="font-medium">Install & open</div>
                    <div className="text-gray-500">Open the downloaded APK and follow on-screen instructions. Grant location permissions for live tracking.</div>
                  </div>
                </li>
              </ol>

              <p className="mt-4 text-xs text-gray-500">Note: APK installs are manual. For the smoothest experience, install from Google Play when available.</p>
            </div>
            <div className="hidden md:flex flex-col items-center justify-center p-4 gap-3">
              {/* Clickable logo area: shows scanner when tapped */}
              <LogoScanner />
            </div>
          </div>
        </motion.section>

        <motion.footer
          className="text-center text-sm text-gray-600"
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          Connect to a live WebSocket for production real-time updates.
        </motion.footer>
      </div>
    </div>
  )
}
