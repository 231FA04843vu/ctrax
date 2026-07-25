import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { onBuses } from '../utils/busData'
import LogoScannerFlip from '../shared/LogoScannerFlip'
import EnableNotifications from '../shared/EnableNotifications'
import { Bus, Users, ShieldCheck, Map, Bell, Compass } from 'lucide-react'
import PremiumIcon from '../shared/PremiumIcon'

export default function Landing() {
  const [busCount, setBusCount] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(() => new Date())
  const [activeTab, setActiveTab] = useState('student')

  // Banner slider data
  const banners = useMemo(() => ([
    {
      title: 'Next-Generation Transit',
      subtitle: 'Accurate ETAs, dynamic maps, and a seamless commute.',
      img: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=2000&auto=format&fit=crop',
      fallback: '/banners/bus-live.svg',
    },
    {
      title: 'Peace of Mind for Parents',
      subtitle: 'Instant arrival alerts and live monitoring.',
      img: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?q=80&w=2000&auto=format&fit=crop',
      fallback: '/banners/parent-alerts.svg',
    },
    {
      title: 'Empowering Drivers',
      subtitle: 'Intuitive routing and live updates at your fingertips.',
      img: 'https://images.unsplash.com/photo-1626305011746-13a6df7a0082?q=80&w=2000&auto=format&fit=crop',
      fallback: '/banners/driver-tools.svg',
    }
  ]), [])
  
  const [slide, setSlide] = useState(0)
  const autoRef = useRef(null)

  useEffect(() => {
    const off = onBuses((list) => {
      try {
        const active = (list || []).filter(b => b && b.sharing).length
        setBusCount(active)
        setLastUpdated(new Date())
      } catch {
        setBusCount(0)
      }
    })
    return off
  }, [])

  useEffect(() => {
    if (autoRef.current) clearInterval(autoRef.current)
    autoRef.current = setInterval(() => {
      setSlide(s => (s + 1) % banners.length)
    }, 5000)
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [banners.length])

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  }

  const [isInApp, setIsInApp] = useState(false)
  useEffect(() => {
    try {
      const ua = navigator.userAgent || ''
      const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator && (window.navigator).standalone)
      const isAndroidWebView = /; wv\)|Android.*Version\//i.test(ua) || /\bwv\b/i.test(ua)
      const isInAppBrowser = /FBAN|FBAV|Instagram|Line|UCBrowserMini/i.test(ua)
      setIsInApp(Boolean(isStandalone || isAndroidWebView || isInAppBrowser))
    } catch (e) {
      setIsInApp(false)
    }
  }, [])

  const roleContent = {
    student: {
      icon: <PremiumIcon icon={Users} size={24} color="blue" variant="solid" glow />,
      title: "For Students",
      color: "from-blue-500 to-indigo-600",
      bg: "bg-blue-50",
      steps: [
        "Connect with your assigned bus route.",
        "Check accurate real-time ETAs.",
        "View the bus approaching your stop on a live map.",
        "Never wait in the rain or cold again."
      ]
    },
    parent: {
      icon: <PremiumIcon icon={ShieldCheck} size={24} color="purple" variant="solid" glow />,
      title: "For Parents",
      color: "from-purple-500 to-pink-500",
      bg: "bg-purple-50",
      steps: [
        "Secure access using your child's credentials.",
        "Monitor the vehicle's progress in real-time.",
        "Receive push notifications for delays or arrivals.",
        "Complete peace of mind."
      ]
    },
    driver: {
      icon: <PremiumIcon icon={Bus} size={24} color="emerald" variant="solid" glow />,
      title: "For Drivers",
      color: "from-emerald-400 to-teal-500",
      bg: "bg-emerald-50",
      steps: [
        "Securely authenticated access to your route.",
        "Start sharing your location with a single tap.",
        "View passenger counts and upcoming stops.",
        "Focus on driving while the app keeps everyone informed."
      ]
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#fafcff] flex flex-col overflow-x-hidden font-sans">
      
      {/* BACKGROUND ELEMENTS FOR AESTHETICS */}
      <div className="absolute top-0 inset-x-0 h-[600px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[80%] rounded-full bg-blue-100/50 blur-3xl opacity-60 mix-blend-multiply" />
        <div className="absolute top-[10%] -left-[10%] w-[50%] h-[70%] rounded-full bg-indigo-100/40 blur-3xl opacity-60 mix-blend-multiply" />
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-24">
        
        {/* HERO SECTION */}
        <motion.section 
          className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20 pt-8"
          initial="hidden" animate="visible" variants={fadeInUp}
        >
          <div className="flex-1 space-y-8 text-center lg:text-left z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-md border border-white/40 shadow-sm text-sm font-medium text-blue-700">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
              Smart Campus Transit
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.1]">
              Live, Safe, <br className="hidden lg:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Reliable Transit
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Experience the future of campus mobility. Real-time vehicle tracking, predictive ETAs, and a seamless interface designed for everyone.
            </p>
          </div>

          <div className="flex-1 w-full max-w-md relative z-10">
             {/* FLOATING GLASS PANEL */}
             <motion.div 
               className="relative rounded-3xl bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-8 overflow-hidden"
               whileHover={{ y: -5, boxShadow: "0 15px 40px -10px rgba(0,0,0,0.1)" }}
             >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
               <div className="flex items-start justify-between">
                 <div>
                   <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">System Status</p>
                   <h3 className="text-4xl font-bold text-gray-900 mt-2 flex items-baseline gap-2">
                     {busCount}
                     <span className="text-lg font-medium text-gray-500">Active Buses</span>
                   </h3>
                 </div>
                 <PremiumIcon icon={Bus} size={24} color="blue" variant="glass" glow />
               </div>
               
               <div className="mt-8 pt-6 border-t border-gray-200/50">
                 <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <p className="text-sm text-gray-600">Last heartbeat: <span className="font-medium">{lastUpdated.toLocaleTimeString()}</span></p>
                 </div>
                 <p className="text-xs text-gray-400 mt-2">
                   Data streamed in real-time via WebSocket.
                 </p>
               </div>
             </motion.div>
          </div>
        </motion.section>

        {/* CAROUSEL SECTION */}
        <motion.section 
          className="relative w-full rounded-[2rem] overflow-hidden shadow-2xl"
          variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
        >
          <div
            className="flex transition-transform duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)]"
            style={{ width: `${banners.length * 100}%`, transform: `translateX(-${(slide * 100) / banners.length}%)` }}
          >
            {banners.map((b, i) => (
              <div key={i} className="w-full relative h-[300px] sm:h-[400px] lg:h-[500px]" style={{ width: `${100 / banners.length}%` }}>
                <img
                  src={b.img}
                  alt={b.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    if (e.currentTarget.dataset.fb !== '1' && b.fallback){
                      e.currentTarget.dataset.fb = '1'
                      e.currentTarget.src = b.fallback
                    }
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full p-8 sm:p-12">
                  <div className="max-w-3xl">
                    <h3 className="text-white text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">{b.title}</h3>
                    <p className="text-white/80 text-lg sm:text-xl font-medium">{b.subtitle}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Custom Dots */}
          <div className="absolute bottom-8 right-8 flex items-center gap-3">
            {banners.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to slide ${i+1}`}
                onClick={() => setSlide(i)}
                className={`transition-all duration-300 rounded-full h-2 ${
                  i === slide ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </motion.section>

        {/* FEATURES GRID */}
        <motion.section
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
        >
          {[
            { icon: <PremiumIcon icon={Map} size={28} color="blue" variant="glass" glow />, title: 'Live Map & ETAs', desc: 'Watch your vehicle move on a high-performance interactive map with accurate predictive arrival times.' },
            { icon: <PremiumIcon icon={Compass} size={28} color="emerald" variant="glass" glow />, title: 'Driver Telemetry', desc: 'Seamless routing, stop management, and live location broadcasting crafted for driver safety and focus.' },
            { icon: <PremiumIcon icon={Bell} size={28} color="purple" variant="glass" glow />, title: 'Instant Alerts', desc: 'Stay ahead with smart push notifications for arrivals, delays, and critical system updates.' },
          ].map((feat, idx) => (
            <motion.div
              key={idx}
              className="group relative p-8 bg-white rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-gray-100 hover:shadow-xl transition-all duration-300 overflow-hidden"
              whileHover={{ y: -8 }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700 ease-out" />
              <div className="relative z-10">
                <div className="mb-6">
                  {feat.icon}
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-3">{feat.title}</h4>
                <p className="text-gray-600 leading-relaxed">{feat.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.section>

        {/* INTERACTIVE ROLES SHOWCASE (No action buttons) */}
        <motion.section
          className="bg-white rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 sm:p-12 overflow-hidden relative"
          variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
        >
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-blue-50/50 to-transparent rounded-full blur-3xl pointer-events-none" />
          
          <div className="text-center max-w-2xl mx-auto mb-12 relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Tailored Experiences</h2>
            <p className="text-gray-600 mt-4 text-lg">Select your role to explore how the platform adapts to your needs.</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-12 relative z-10">
            {/* Tabs */}
            <div className="flex lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 lg:w-64 flex-shrink-0 scrollbar-hide">
              {Object.entries(roleContent).map(([key, data]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-left transition-all duration-300 whitespace-nowrap lg:whitespace-normal ${
                    activeTab === key 
                      ? `bg-white shadow-md border border-gray-100 transform scale-[1.02]` 
                      : 'hover:bg-gray-50 text-gray-500'
                  }`}
                >
                  <div className={`transform scale-75 lg:scale-100 ${activeTab === key ? '' : 'opacity-60 grayscale hover:grayscale-0 transition-all'}`}>
                    {data.icon}
                  </div>
                  <span className={`font-semibold text-lg ${activeTab === key ? 'text-gray-900' : ''}`}>
                    {data.title}
                  </span>
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-gray-50 rounded-3xl p-8 sm:p-12 relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="relative z-10"
                >
                  <div className={`inline-block px-4 py-1.5 rounded-full bg-gradient-to-r ${roleContent[activeTab].color} text-white text-sm font-medium mb-6`}>
                    Workflow Highlights
                  </div>
                  <div className="space-y-6">
                    {roleContent[activeTab].steps.map((step, idx) => (
                      <div key={idx} className="flex gap-5 items-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-gray-900 font-bold text-sm">
                          {idx + 1}
                        </div>
                        <p className="text-gray-700 text-lg pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
              
              {/* Decorative graphic based on tab */}
              <div className="absolute -bottom-10 -right-10 opacity-5 pointer-events-none transform scale-150">
                {roleContent[activeTab].icon}
              </div>
            </div>
          </div>
        </motion.section>

        {/* NOTIFICATIONS / PUSH */}
        <motion.section variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
          <EnableNotifications />
        </motion.section>

        {/* ANDROID DOWNLOAD (Cleaned up) */}
        {!isInApp && (
          <motion.section
            className="relative bg-gray-900 rounded-[2.5rem] overflow-hidden shadow-2xl"
            variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
          >
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay" />
            <div className="relative z-10 p-10 sm:p-16 flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="text-center md:text-left">
                <h3 className="text-3xl font-bold text-white mb-4">Take Transit With You</h3>
                <p className="text-gray-300 text-lg max-w-xl">
                  Install the mobile app for a native experience, background tracking, and rich push notifications tailored for your journey.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start">
                  <Link to="/download" className="inline-flex items-center gap-3 px-6 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-2xl shadow-lg transition-all cursor-pointer">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2l3 6 6 1-4.5 4 1 6L12 17l-5.5 2 1-6L3 9l6-1 3-6z" fill="currentColor"/></svg>
                    <div className="text-left">
                      <div className="text-xs text-gray-300 uppercase font-semibold tracking-wider">Download</div>
                      <div className="font-bold">Android APK</div>
                    </div>
                  </Link>
                </div>
              </div>
              
              <div className="flex-shrink-0 bg-white/5 p-6 rounded-3xl backdrop-blur-sm border border-white/10">
                <LogoScannerFlip />
              </div>
            </div>
          </motion.section>
        )}

      </div>
    </div>
  )
}
