// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import App from './App.jsx'
import Today from './pages/Today.jsx'
import Progress from './pages/Progress.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Coach from './pages/Coach.jsx'
import './index.css'
import AuthGate from './AuthGate.jsx'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth.jsx'
import { motion } from "framer-motion"
import { IconHome, IconChartBar, IconSparkles, IconUser, IconArrowRightOnRectangle } from './components/Icons'

function NavItem({ to, icon: Icon, label }) {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <NavLink to={to} className="nav-item flex-1 flex flex-col items-center justify-center gap-1 py-2 relative transition-colors">
            <Icon className={`w-6 h-6 transition-colors ${isActive ? 'text-brand-charcoal-dark' : 'text-brand-charcoal-light'}`} />
            <span className={`text-xs font-medium transition-colors ${isActive ? 'text-brand-charcoal-dark' : 'text-brand-charcoal-light'}`}>
                {label}
            </span>
            {isActive && (
                <motion.div
                    className="absolute bottom-1 w-2 h-2 rounded-full bg-brand-gold"
                    layoutId="active-nav-indicator"
                />
            )}
        </NavLink>
    );
}

function Shell() {
  const signOut = async () => { try { await supabase.auth.signOut() } catch {} }

  return (
    <BrowserRouter>
      <div className="app-container">
        <AuthGate>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/coach" element={<Coach />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<App />} />
          </Routes>
          
          <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 mobile-dock">
            <div className="mobile-dock-inner flex items-center justify-around">
                <NavItem to="/" icon={IconHome} label="Aujourd'hui" />
                <NavItem to="/progress" icon={IconChartBar} label="Suivi" />
                <NavItem to="/coach" icon={IconSparkles} label="Coach" />
                <NavItem to="/onboarding" icon={IconUser} label="Profil" />
                <button onClick={signOut} className="nav-item flex-1 flex flex-col items-center justify-center gap-1 py-2 text-brand-charcoal-light">
                    <IconArrowRightOnRectangle className="w-6 h-6" />
                    <span className="text-xs font-medium">Quitter</span>
                </button>
            </div>
          </nav>
        </AuthGate>
      </div>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Shell />
  </React.StrictMode>,
)