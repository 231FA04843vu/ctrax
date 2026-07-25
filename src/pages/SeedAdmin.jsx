import React from 'react'

// SeedAdmin removed for production. If you need to create an initial admin account,
// use your Firebase console or a controlled migration script. This page was removed
// to avoid accidental creation of fake/test accounts in production deployments.

export default function SeedAdmin(){
  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow mt-10">
      <h2 className="text-2xl font-semibold mb-1">Seeder Disabled</h2>
      <p className="text-sm text-gray-600">The one-time seeder has been disabled for production. Create admin accounts via the Firebase console or a secure migration script.</p>
    </div>
  )
}
