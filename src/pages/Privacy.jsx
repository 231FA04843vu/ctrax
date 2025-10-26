import React from 'react'
import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="w-full min-h-screen bg-gray-50 py-12 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">Privacy Policy</h1>
          <Link to="/" className="text-sm text-blue-600 hover:underline">Back to Home</Link>
        </div>

        <p className="mt-4 text-gray-700">Last updated: October 26, 2025</p>

        <section className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">1. Overview</h2>
          <p className="text-sm text-gray-600">We collect minimal data required to provide our service: account email, route and student associations, and device identifiers for push notifications. We do not sell personal data.</p>

          <h2 className="text-lg font-semibold">2. Data We Collect</h2>
          <ul className="list-disc list-inside text-sm text-gray-600">
            <li>Account information (name, email)</li>
            <li>Student/route associations (for parents)</li>
            <li>Driver credentials and vehicle documents (securely stored)</li>
            <li>Device tokens for notifications</li>
          </ul>

          <h2 className="text-lg font-semibold">3. How We Use Data</h2>
          <p className="text-sm text-gray-600">Data is used to authenticate users, show live vehicle positions to linked accounts, send alerts, and operate the routing features of the application.</p>

          <h2 className="text-lg font-semibold">4. Sharing & Security</h2>
          <p className="text-sm text-gray-600">We only share data with authorized third-party services required to operate the platform (e.g., push notification providers). We store documents encrypted at rest and use HTTPS for network traffic.</p>

          <h2 className="text-lg font-semibold">5. Your Choices</h2>
          <p className="text-sm text-gray-600">You can request account deletion, change notification preferences, or download your data by contacting support.</p>
        </section>

        <div className="mt-8 flex justify-end">
          <Link to="/" className="px-4 py-2 bg-blue-600 text-white rounded">Return home</Link>
        </div>
      </div>
    </div>
  )
}
