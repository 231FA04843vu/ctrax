import React, { useEffect, useState } from 'react'
import { useI18n, SUPPORTED_LANGS } from '../i18n/i18n.jsx'

export default function LanguagePrompt(){
  const { setLang } = useI18n()
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      const chosen = localStorage.getItem('langChosen') === '1'
      const isMobile = window.matchMedia && window.matchMedia('(max-width: 640px)').matches
      if (!chosen && isMobile) {
        // slight delay so initial layout paints
        const t = setTimeout(() => setShow(true), 250)
        return () => clearTimeout(t)
      }
    } catch {}
  }, [])

  const choose = (code) => {
    setLang(code)
    try { localStorage.setItem('langChosen', '1') } catch {}
    setShow(false)
  }

  const skip = () => {
    try { localStorage.setItem('langChosen', '1') } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={skip} />
      <div className="relative w-full sm:w-auto sm:min-w-[320px] bg-white rounded-t-2xl sm:rounded-xl shadow-lg border p-4 sm:p-5">
        <div className="text-base font-semibold mb-2">Choose your language</div>
        <div className="space-y-2">
          {SUPPORTED_LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => choose(l.code)}
              className="w-full text-left px-3 py-2 rounded border hover:bg-gray-50"
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="mt-3 text-right">
          <button onClick={skip} className="text-sm px-3 py-1.5 border rounded">Not now</button>
        </div>
      </div>
    </div>
  )
}
