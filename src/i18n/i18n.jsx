import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const I18nContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key, params) => key,
})

const TRANSLATIONS = {
  en: {
    nav: {
      home: 'Home',
      student: 'Student',
      parent: 'Parent',
      driver: 'Driver',
      account: 'Account',
    },
    dashboard: {
      student: 'Student Dashboard',
      driver: 'Driver Dashboard',
      parent: 'Parent Dashboard',
      admin: 'Admin Dashboard',
    },
    action: {
      logout: 'Logout',
      signOut: 'Sign out',
      startSharing: 'Start Sharing',
      stopSharing: 'Stop Sharing',
    },
  },
  hi: {
    nav: {
      home: 'होम',
      student: 'विद्यार्थी',
      parent: 'अभिभावक',
      driver: 'ड्राइवर',
      account: 'खाता',
    },
    dashboard: {
      student: 'विद्यार्थी डैशबोर्ड',
      driver: 'ड्राइवर डैशबोर्ड',
      parent: 'अभिभावक डैशबोर्ड',
      admin: 'एडमिन डैशबोर्ड',
    },
    action: {
      logout: 'लॉगआउट',
      signOut: 'साइन आउट',
      startSharing: 'शेयरिंग शुरू करें',
      stopSharing: 'शेयरिंग रोकें',
    },
  },
  te: {
    nav: {
      home: 'హోమ్',
      student: 'విద్యార్థి',
      parent: 'తల్లి దండ్రులు',
      driver: 'డ్రైవర్',
      account: 'ఖాతా',
    },
    dashboard: {
      student: 'విద్యార్థి డ్యాష్‌బోర్డ్',
      driver: 'డ్రైవర్ డ్యాష్‌బోర్డ్',
      parent: 'తల్లి దండ్రుల డ్యాష్‌బోర్డ్',
      admin: 'అడ్మిన్ డ్యాష్‌బోర్డ్',
    },
    action: {
      logout: 'లాగ్ అవుట్',
      signOut: 'సైన్ అవుట్',
      startSharing: 'షేరింగ్ ప్రారంభించండి',
      stopSharing: 'షేరింగ్ ఆపండి',
    },
  },
}

function getNested(obj, path){
  return path.split('.').reduce((acc, k) => (acc && k in acc ? acc[k] : undefined), obj)
}

export function I18nProvider({ children }){
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('lang') || 'en' } catch { return 'en' }
  })

  useEffect(() => {
    try { document.documentElement.lang = lang } catch {}
    try { localStorage.setItem('lang', lang) } catch {}
  }, [lang])

  const t = useMemo(() => {
    return (key, params) => {
      const table = TRANSLATIONS[lang] || TRANSLATIONS.en
      const val = getNested(table, key)
      if (typeof val === 'string') return val
      // fallback: return last segment of key capitalized
      const seg = key.split('.').pop()
      return seg ? seg.replace(/\b\w/g, c => c.toUpperCase()).replace(/([A-Z])/g, ' $1').trim() : key
    }
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t])
  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(){
  return useContext(I18nContext)
}

export const SUPPORTED_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'te', label: 'తెలుగు' },
]
