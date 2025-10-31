import React, { useEffect, useRef, useState } from 'react'

// Google Translate widget wrapper with strict single-init and desktop-only display
export default function GoogleTranslate(){
  const containerRef = useRef(null)
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Desktop only
    let isDesktop = false
    try { isDesktop = window.matchMedia && window.matchMedia('(min-width: 768px)').matches } catch { isDesktop = true }
    if (!isDesktop) return

  setEnabled(true)

  // Auto-hide after 30 seconds (widget stays initialized, just hidden)
  const hideTimer = setTimeout(() => setVisible(false), 30000)

    // Guard: create widget only once even in React StrictMode double-mount
    const initOnce = () => {
      if (window.__gtWidgetCreated) return
      // If container already has content, assume it's initialized
      const el = document.getElementById('google_translate_element')
      if (el && el.childElementCount > 0) { window.__gtWidgetCreated = true; return }
      try {
        /* global google */
        new window.google.translate.TranslateElement({
          pageLanguage: 'en',
          includedLanguages: 'en,hi,te',
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false,
        }, 'google_translate_element')
        window.__gtWidgetCreated = true
      } catch { /* ignore */ }
    }

    // Expose callback for Google script
    window.googleTranslateElementInit = () => initOnce()

    // If script already loaded, init immediately
    if (window.google && window.google.translate && window.google.translate.TranslateElement) {
      initOnce()
      return
    }

    // Append script only once
    if (!window.__gtScriptAppended) {
      const existing = document.getElementById('google-translate-script')
      if (!existing) {
        const s = document.createElement('script')
        s.id = 'google-translate-script'
        s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
        s.async = true
        s.onload = () => { window.__gtLoaded = true; initOnce() }
        s.onerror = () => { /* ignore */ }
        document.body.appendChild(s)
      }
      window.__gtScriptAppended = true
    }

    // Cleanup timer only; keep script and widget persistent
    return () => { clearTimeout(hideTimer) }
  }, [])

  if (!enabled) return null

  return (
    <div
      ref={containerRef}
      className={`hidden ${visible ? 'md:block' : 'md:hidden'} fixed top-4 right-4 z-50 bg-white/90 backdrop-blur rounded-md shadow border px-2 py-1`}
    >
      {/* Optional minimal style tweaks without removing branding */}
      <style>{`
        .goog-te-gadget { font-family: inherit; }
        .goog-te-gadget .goog-te-combo { 
          padding: 4px 6px; border-radius: 6px; border: 1px solid #e5e7eb; 
          font-size: 0.875rem; background: white; color: #111827;
        }
      `}</style>
      <div id="google_translate_element" />
    </div>
  )
}
