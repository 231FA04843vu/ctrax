import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { COMPANY_NAME, TERMS_EFFECTIVE_DATE, PRINT_WATERMARK_TEXT, getSiteOrigin } from '../config/legal'

export default function Terms() {
  const origin = getSiteOrigin()
  const sections = useMemo(() => ([
    { id: 'acceptance', title: 'Acceptance', content: <p className="text-sm text-gray-700">By using the service you agree to these terms. If you disagree, do not use the service.</p> },
    { id: 'use-of-service', title: 'Use of Service', content: <p className="text-sm text-gray-700">Provide accurate information. Drivers must follow local laws and maintain valid credentials.</p> },
    { id: 'content-conduct', title: 'Content & Conduct', content: <p className="text-sm text-gray-700">Do not post illegal, harmful, or abusive content. Violations may result in suspension.</p> },
    { id: 'liability', title: 'Liability', content: <p className="text-sm text-gray-700">The service is provided “as is” without warranties. We are not liable for incidental or consequential damages to the extent permitted by law.</p> },
    { id: 'changes', title: 'Changes', content: <p className="text-sm text-gray-700">We may update these terms. Continued use after changes constitutes acceptance.</p> },
  ]), [])

  const [open, setOpen] = useState(() => Object.fromEntries(sections.map(s => [s.id, true])))
  const allOpen = Object.values(open).every(Boolean)
  const toggleAll = (val) => setOpen(Object.fromEntries(sections.map(s => [s.id, val ?? !allOpen])))
  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-white">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Terms of Service</h1>
              <p className="mt-2 text-white/90">Effective date: {TERMS_EFFECTIVE_DATE}</p>
            </div>
            <button onClick={() => window.print()} className="hidden md:inline-flex px-3 py-2 bg-white/20 hover:bg-white/25 rounded text-sm">Print</button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
        {/* TOC */}
        <aside className="lg:sticky lg:top-6 self-start bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Contents</h3>
            <button onClick={() => toggleAll()} className="text-xs text-indigo-700">{allOpen ? 'Collapse all' : 'Expand all'}</button>
          </div>
          <ul className="space-y-1 text-sm">
            {sections.map(s => (
              <li key={s.id}>
                <button onClick={() => scrollTo(s.id)} className="w-full text-left text-gray-700 hover:text-indigo-700">
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Link to="/" className="text-sm text-indigo-700 hover:underline">Back to Home</Link>
          </div>
        </aside>

        {/* Content */}
        <main className="space-y-4">
          {sections.map((s, idx) => (
            <section key={s.id} id={s.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <header className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => setOpen(o => ({ ...o, [s.id]: !o[s.id] }))}>
                <h2 className="text-base md:text-lg font-semibold">{idx+1}. {s.title}</h2>
                <span className="text-xs text-gray-500">{open[s.id] ? 'Hide' : 'Show'}</span>
              </header>
              {open[s.id] && (
                <div className="px-4 pb-4">
                  {s.content}
                </div>
              )}
            </section>
          ))}

          <div className="flex items-center justify-end pt-2">
            <Link to="/" className="px-4 py-2 bg-indigo-600 text-white rounded">Return home</Link>
          </div>
        </main>
      </div>

      {/* Back to top */}
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-6 right-6 px-3 py-2 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 print:hidden">
        Top
      </button>

      {/* Print watermark */}
      <div className="hidden print:flex fixed inset-0 items-center justify-center pointer-events-none">
        <span className="text-6xl md:text-8xl font-extrabold text-gray-400 opacity-10 -rotate-12 select-none">{PRINT_WATERMARK_TEXT}</span>
      </div>

      {/* Print footer */}
      <div className="hidden print:flex fixed bottom-4 inset-x-0 justify-center text-xs text-gray-600 select-none">
        <span>© {new Date().getFullYear()} {COMPANY_NAME}. {origin}</span>
      </div>
    </div>
  )
}
