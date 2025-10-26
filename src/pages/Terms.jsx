import React from 'react'
import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="w-full min-h-screen bg-gray-50 py-12 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">Terms of Service</h1>
          <Link to="/" className="text-sm text-blue-600 hover:underline">Back to Home</Link>
        </div>

        <p className="mt-4 text-gray-700">Effective date: October 26, 2025</p>

        <section className="mt-6 space-y-4 text-sm text-gray-600">
          <h2 className="text-lg font-semibold">1. Acceptance</h2>
          <p>By using College Bus Tracker you agree to these terms. Do not use the service if you do not agree.</p>

          <h2 className="text-lg font-semibold">2. Use of Service</h2>
          <p>Users must provide accurate information. Drivers agree to follow local laws and maintain valid credentials.</p>

          <h2 className="text-lg font-semibold">3. Content & Conduct</h2>
          <p>Users may not post or transmit illegal or harmful content. Violations may result in account suspension.</p>

          <h2 className="text-lg font-semibold">4. Liability</h2>
          <p>We provide the service "as is" and are not liable for incidental damages. See full legal section for details.</p>

          <h2 className="text-lg font-semibold">5. Changes</h2>
          <p>We may update these terms; continued use after changes constitutes acceptance.</p>
        </section>

        <div className="mt-8 flex justify-end">
          <Link to="/" className="px-4 py-2 bg-blue-600 text-white rounded">Return home</Link>
        </div>
      </div>
    </div>
  )
}
