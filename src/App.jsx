import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, User, Bus, Menu, X } from 'lucide-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import StudentDashboard from './pages/StudentDashboard';
import DriverDashboard from './pages/DriverDashboard';
import Landing from './pages/Landing';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Account from './pages/Account';
import Footer from './shared/Footer';
import StudentLogin from './pages/auth/StudentLogin';
import StudentRegister from './pages/auth/StudentRegister';
import DriverLogin from './pages/auth/DriverLogin';
import DriverRegister from './pages/auth/DriverRegister';
import ParentLogin from './pages/auth/ParentLogin';
import ParentDashboard from './pages/ParentDashboard';

export default function App() {
  const [loading, setLoading] = useState(true);

  // simulate initial loading (can later tie to API or connection state)
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <DotLottieReact
          src="https://lottie.host/8be934e7-af0b-4970-bdfb-2b832c861a45/kGTESI11CA.lottie"
          loop
          autoplay
          style={{ width: 160, height: 160 }}
        />
      </div>
    );
  }

  // InnerApp runs inside BrowserRouter so hooks like useLocation are available
  function InnerApp() {
    const [menuOpen, setMenuOpen] = useState(false);
    const location = useLocation();

    // hide global chrome (header/footer) for dashboard routes
    const hideChrome = (
      location.pathname.startsWith('/student') ||
      location.pathname.startsWith('/driver') ||
      location.pathname.startsWith('/parent')
    );

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Navbar */}
        {!hideChrome && (
          <header className="backdrop-blur-md bg-white/80 shadow-md sticky top-0 z-50 border-b border-gray-200">
            {/* full-bleed header container so navigation aligns with full-width pages */}
            <div className="w-full px-6 lg:px-0 py-5 flex items-center justify-between">
              {/* Brand */}
              <Link to="/" className="flex items-center pl-6 lg:pl-0">
                <img
                  src="/logo.svg"
                  alt="CollBus Logo"
                  className="h-10 w-auto select-none"
                />
              </Link>

              {/* Desktop Navigation shifted slightly left for better visual alignment */}
              <nav className="hidden md:flex items-center space-x-14 mr-8">
                <Link
                  to="/"
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors text-xl font-semibold"
                >
                  <Home className="w-6 h-6" />
                  Home
                </Link>
                <Link
                  to="/login/student"
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors text-xl font-semibold"
                >
                  <User className="w-6 h-6" />
                  Student
                </Link>
                <Link
                  to="/login/parent"
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors text-xl font-semibold"
                >
                  <User className="w-6 h-6" />
                  Parent
                </Link>
                <Link
                  to="/driver"
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors text-xl font-semibold"
                >
                  <img
                    src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWxpZmUtYnVveS1pY29uIGx1Y2lkZS1saWZlLWJ1b3kiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PHBhdGggZD0ibTQuOTMgNC45MyA0LjI0IDQuMjQiLz48cGF0aCBkPSJtMTQuODMgOS4xNyA0LjI0LTQuMjQiLz48cGF0aCBkPSJtMTQuODMgMTQuODMgNC4yNCA0LjI0Ii8+PHBhdGggZD0ibTkuMTcgMTQuODMtNC4yNCA0LjI0Ii8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNCIvPjwvc3ZnPg=="
                    alt="Driver"
                    className="w-6 h-6 object-contain"
                  />
                  Driver
                </Link>
                <Link
                  to="/account"
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors text-xl font-semibold"
                >
                  <User className="w-6 h-6" />
                  Account
                </Link>
              </nav>

              {/* Mobile menu toggle */}
              <button
                className="md:hidden text-gray-700"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
              </button>
            </div>

            {/* Mobile Navigation */}
            {menuOpen && (
              <nav className="md:hidden bg-white/90 backdrop-blur-lg border-t border-gray-200 shadow-sm">
                <div className="flex flex-col items-start px-6 py-5 space-y-5">
                  <Link
                    to="/"
                    className="flex items-center gap-3 text-gray-700 hover:text-blue-600 text-xl font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Home className="w-6 h-6" />
                    Home
                  </Link>
                  <Link
                    to="/login/student"
                    className="flex items-center gap-3 text-gray-700 hover:text-blue-600 text-xl font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User className="w-6 h-6" />
                    Student Login
                  </Link>
                  <Link
                    to="/login/parent"
                    className="flex items-center gap-3 text-gray-700 hover:text-blue-600 text-xl font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User className="w-6 h-6" />
                    Parent Login
                  </Link>
                  <Link
                    to="/driver"
                    className="flex items-center gap-3 text-gray-700 hover:text-blue-600 text-xl font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    <img
                      src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWxpZmUtYnVveS1pY29uIGx1Y2lkZS1saWZlLWJ1b3kiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PHBhdGggZD0ibTQuOTMgNC45MyA0LjI0IDQuMjQiLz48cGF0aCBkPSJtMTQuODMgOS4xNyA0LjI0LTQuMjQiLz48cGF0aCBkPSJtMTQuODMgMTQuODMgNC4yNCA0LjI0Ii8+PHBhdGggZD0ibTkuMTcgMTQuODMtNC4yNCA0LjI0Ii8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNCIvPjwvc3ZnPg=="
                      alt="Driver"
                      className="w-6 h-6 object-contain"
                    />
                    Driver
                  </Link>
                  <Link
                    to="/account"
                    className="flex items-center gap-3 text-gray-700 hover:text-blue-600 text-xl font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User className="w-6 h-6" />
                    Account
                  </Link>
                </div>
              </nav>
            )}
          </header>
        )}

        {/* Page Content */}
        {/* make main full-width; internal pages can control their own max-widths */}
        <main className="w-full p-6">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/driver" element={<DriverDashboard />} />
            <Route path="/parent" element={<ParentDashboard />} />
            <Route path="/login/student" element={<StudentLogin />} />
            <Route path="/register/student" element={<StudentRegister />} />
            <Route path="/login/driver" element={<DriverLogin />} />
            <Route path="/register/driver" element={<DriverRegister />} />
            <Route path="/login/parent" element={<ParentLogin />} />
            <Route path="/account" element={<Account />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
          </Routes>
        </main>

        {/* Global Footer */}
        {!hideChrome && <Footer />}
      </div>
    );
  }

  return (
    <BrowserRouter>
      <InnerApp />
    </BrowserRouter>
  );
}
