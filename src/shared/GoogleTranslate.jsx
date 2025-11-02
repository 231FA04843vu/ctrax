import React, { useEffect, useRef, useState } from 'react'

// Google Translate widget wrapper with strict single-init and desktop-only display
export default function GoogleTranslate({ visible = false, onClose = () => {} }){
  const containerRef = useRef(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    // Enable the widget on all devices but keep it hidden until parent toggles `visible`.
    setEnabled(true)

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

    // Cleanup; keep script and widget persistent
    return () => { /* nothing to cleanup here */ }
  }, [])

  // After the widget is created, attach a change listener to auto-close when language changes.
  useEffect(() => {
    if (!enabled) return

    let mounted = true
    let poll = null

    const attach = () => {
      const select = document.querySelector('.goog-te-combo')
      if (!select) return false
      const onChange = () => {
        try { onClose() } catch {}
      }
      select.addEventListener('change', onChange)
      // cleanup helper
      poll = () => select.removeEventListener('change', onChange)
      return true
    }

    // Try attaching immediately, otherwise poll for the element
    if (!attach()) {
      const interval = setInterval(() => {
        if (!mounted) return
        if (attach()) { clearInterval(interval) }
      }, 600)
      return () => { mounted = false; clearInterval(interval); if (poll) poll() }
    }

    return () => { mounted = false; if (poll) poll() }
  }, [enabled, onClose])

  if (!enabled) return null

  // Always render the container so the Translate widget can be initialized even while hidden.
  return (
    <div ref={containerRef} className="fixed top-16 right-4 z-50" style={{ display: visible ? 'block' : 'none' }}>
      <div className="bg-white/90 backdrop-blur rounded-md shadow border px-3 py-2">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div id="google_translate_element" />
        </div>
        <style>{`
          .goog-te-gadget { font-family: inherit; }
          .goog-te-gadget .goog-te-combo { 
            padding: 6px 8px; border-radius: 6px; border: 1px solid #e5e7eb; 
            font-size: 0.95rem; background: white; color: #111827;
          }
        `}</style>
      </div>
    </div>
  )
}
