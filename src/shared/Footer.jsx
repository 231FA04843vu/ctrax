import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <h3 className="text-2xl font-extrabold text-gray-800">About Us</h3>
          <p className="mt-3 text-gray-600 max-w-2xl">
            CTrax is a lightweight, privacy-first service that
            helps parents, students, and drivers coordinate daily campus
            transportation. We provide live-ish tracking, driver tools for route
            management, and timely alerts so families have peace of mind.
          </p>

          <div className="mt-6 flex items-start space-x-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700">Quick links</h4>
              <ul className="mt-3 space-y-2 text-gray-600">
                <li>
                  <Link to="/" className="hover:text-blue-600">Home</Link>
                </li>
                <li>
                  <Link to="/student" className="hover:text-blue-600">Student Dashboard</Link>
                </li>
                <li>
                  <Link to="/driver" className="hover:text-blue-600">Driver Dashboard</Link>
                </li>
                <li>
                  <Link to="/login/admin" className="hover:text-blue-600">Admin</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-extrabold text-gray-800">Contact Us</h3>
          <p className="mt-3 text-gray-600">Have questions or need help? Reach out:</p>

          <div className="mt-4 space-y-3 text-gray-700">
            <div className="flex items-center gap-3">
              <span className="font-semibold">Email:</span>
              <a href="mailto:231fa04843@vignan.ac.in" className="text-blue-600 hover:underline">231fa04843@vignan.ac.in</a>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">Phone:</span>
              <a href="tel:+1234567890" className="hover:underline">+91 8520004688</a>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">We aim to reply within 1 business day.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-600">
          <div>© {new Date().getFullYear()} CTrax. All rights reserved.</div>
          <div className="mt-3 sm:mt-0 space-x-4">
            <Link to="/privacy" className="hover:text-blue-600">Privacy</Link>
            <Link to="/terms" className="hover:text-blue-600">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
