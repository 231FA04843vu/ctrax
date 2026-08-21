import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, User, Bus, Menu, X } from 'lucide-react';
import { useI18n } from './i18n/i18n.jsx';
import LanguageSwitcher from './shared/LanguageSwitcher';
import LanguagePrompt from './shared/LanguagePrompt';
import GoogleTranslate from './shared/GoogleTranslate';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import StudentDashboard from './pages/StudentDashboard';
import DriverDashboard from './pages/DriverDashboard';
import Landing from './pages/Landing';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Download from './pages/Download';
import Account from './pages/Account';
import Footer from './shared/Footer';
import StudentLogin from './pages/auth/StudentLogin';
import StudentRegister from './pages/auth/StudentRegister';
import DriverLogin from './pages/auth/DriverLogin';
import DriverRegister from './pages/auth/DriverRegister';
import ParentLogin from './pages/auth/ParentLogin';
import ParentDashboard from './pages/ParentDashboard';
import AdminLogin from './pages/auth/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import DriverResetPassword from './pages/auth/DriverResetPassword';
import StudentResetPassword from './pages/auth/StudentResetPassword';
import AdminResetPassword from './pages/auth/AdminResetPassword';
import SeedAdmin from './pages/SeedAdmin';

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
    const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  // translateOpen controls the pull-tab visibility + nav shift
  const [translateOpen, setTranslateOpen] = useState(false);
  // translateWidget controls the Google Translate language widget visibility
  const [translateWidget, setTranslateWidget] = useState(false);
    const location = useLocation();

    // hide global chrome (header/footer) for dashboard routes
    const hideChrome = (
      location.pathname.startsWith('/student') ||
      location.pathname.startsWith('/driver') ||
      location.pathname.startsWith('/parent') ||
      location.pathname.startsWith('/privacy') ||
      location.pathname.startsWith('/terms')
    );

    // Always scroll to top on route changes so login/register pages are visible immediately
    useEffect(() => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      } catch {
        window.scrollTo(0, 0);
      }
    }, [location.pathname]);

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
                  alt="CTrax Logo"
                  className="h-10 w-auto select-none"
                />
              </Link>

              {/* Desktop Navigation - shifts left when translate pill pulls out */}
              <nav
                className="hidden md:flex items-center space-x-12 mr-6"
                style={{ transform: translateOpen ? 'translateX(-140px)' : 'translateX(0)', transition: 'transform .28s ease' }}
              >
                <Link
                  to="/"
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors text-xl font-semibold"
                >
                  <Home className="w-6 h-6" />
                  {t('nav.home')}
                </Link>
                <Link
                  to="/login/student"
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors text-xl font-semibold"
                >
                  <User className="w-6 h-6" />
                  {t('nav.student')}
                </Link>
                <Link
                  to="/login/parent"
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors text-xl font-semibold"
                >
                  <User className="w-6 h-6" />
                  {t('nav.parent')}
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
                  {t('nav.driver')}
                </Link>
                <Link
                  to="/account"
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors text-xl font-semibold"
                >
                  <User className="w-6 h-6" />
                  {t('nav.account')}
                </Link>
                {/* Inline translate dot placed after Account */}
                <button
                  type="button"
                  onClick={() =>
                    setTranslateOpen(prev => {
                      const next = !prev;
                      if (!next) { setTranslateWidget(false); }
                      return next;
                    })
                  }
                  aria-label="Open translate"
                  aria-pressed={translateOpen}
                  className="inline-flex items-center justify-center p-1 rounded-full hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <span className="block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </button>

              </nav>

              {/* translate toggle removed from header — floating pull-tab will be used instead */}

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
                    {t('nav.home')}
                  </Link>
                  <Link
                    to="/login/student"
                    className="flex items-center gap-3 text-gray-700 hover:text-blue-600 text-xl font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User className="w-6 h-6" />
                    {t('nav.student')}
                  </Link>
                  <Link
                    to="/login/parent"
                    className="flex items-center gap-3 text-gray-700 hover:text-blue-600 text-xl font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User className="w-6 h-6" />
                    {t('nav.parent')}
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
                    {t('nav.driver')}
                  </Link>
                  <Link
                    to="/account"
                    className="flex items-center gap-3 text-gray-700 hover:text-blue-600 text-xl font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User className="w-6 h-6" />
                    {t('nav.account')}
                  </Link>
                </div>
              </nav>
            )}
          </header>
        )}

        {/* Page Content */}
        {/* make main full-width; internal pages can control their own max-widths */}
  <main className="w-full px-0 py-4 sm:px-4 sm:py-6">
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
            <Route path="/login/admin" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/reset/driver" element={<DriverResetPassword />} />
            <Route path="/reset/student" element={<StudentResetPassword />} />
            <Route path="/reset/admin" element={<AdminResetPassword />} />
            {/* One-time seed route — remove after use */}
            <Route path="/__seed_admin" element={<SeedAdmin />} />
            <Route path="/account" element={<Account />} />
            <Route path="/download" element={<Download />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
          </Routes>
        </main>

        {/* Global Footer */}
        {!hideChrome && <Footer />}
  {/* Global language selector (mobile) & Google Translate (desktop), plus first-run prompt */}
  {/* Floating translate pull-tab (top-right). Dot toggles pull, button shows languages */}
  <div className="fixed top-4 right-4 z-[60]" style={{ pointerEvents: translateOpen ? 'auto' : 'none' }}>
    <div
      style={{ transform: translateOpen ? 'translateX(0)' : 'translateX(120%)', transition: 'transform .28s ease', opacity: translateOpen ? 1 : 0 }}
      className="bg-white/90 border rounded-l-full shadow px-3 py-1"
    >
      <button
        onClick={() => setTranslateWidget(true)}
        aria-expanded={translateWidget}
        className="text-sm text-gray-700"
      >
        Translate
      </button>
    </div>
  </div>

  <LanguageSwitcher />
  <GoogleTranslate visible={translateWidget} onClose={() => setTranslateWidget(false)} />
  <LanguagePrompt />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <InnerApp />
    </BrowserRouter>
  );
}
