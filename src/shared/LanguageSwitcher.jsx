import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n, SUPPORTED_LANGS } from '../i18n/i18n.jsx'

export default function LanguageSwitcher(){
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(true)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const isMobile = useMemo(() => {
    try { return window.matchMedia && window.matchMedia('(max-width: 767px)').matches } catch { return true }
  }, [])

  const current = SUPPORTED_LANGS.find(l => l.code === lang) || SUPPORTED_LANGS[0]

  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return
      const t = e.target
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [open])

  const choose = (code) => {
    setLang(code)
    try { localStorage.setItem('langChosen', '1') } catch {}
    setOpen(false)
  }

  // Auto-hide on mobile after a few seconds; desktop uses Google Translate widget instead
  useEffect(() => {
    if (!isMobile) { setVisible(false); return }
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 4500)
    return () => clearTimeout(t)
  }, [isMobile])

  if (!isMobile || !visible) return null

  return (
    <div className="fixed top-5 right-4 z-50">
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow border text-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Language: ${current.label}`}
      >
        {current.label}
      </button>
      {open && (
        <div ref={popRef} className="absolute mt-2 right-0 bg-white rounded-md shadow-lg border w-40 overflow-hidden">
          {SUPPORTED_LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => choose(l.code)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${l.code===lang ? 'bg-gray-50 font-medium' : ''}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
