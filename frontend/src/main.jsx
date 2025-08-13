import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import App from './App.jsx'
import Today from './pages/Today.jsx'
import Progress from './pages/Progress.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Coach from './pages/Coach.jsx'
import './index.css'
import AuthGate from './AuthGate.jsx'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth.jsx'
import InstallPWAButton from './components/InstallPWAButton.jsx'

import { useEffect, useState } from 'react'

function Shell() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const InstallBtn = () => !deferredPrompt ? null : (
    <button
      className="btn btn-primary"
      onClick={async () => { deferredPrompt.prompt(); setDeferredPrompt(null) }}
    >
      Installer
    </button>
  )
  const signOut = async ()=> { try { await supabase.auth.signOut() } catch {} }

  const LinkBtn = ({to, children}) => (
   <NavLink
     to={to}
     className={({isActive}) =>
       `relative item flex-1 flex flex-col items-center justify-center gap-0.5 py-3
        ${isActive ? 'text-[var(--gold)]' : 'text-slate-500'}`
     }
   >
    {({isActive}) => (
      <>
        {children}
        {isActive && <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-8 h-1 rounded-full" style={{background:'linear-gradient(90deg,#e7d48d,#d4af37)'}}/>}
      </>
    )}
  </NavLink>
);

  return (
    <BrowserRouter>
    <InstallBtn/>
      <div className="app-container">
        <AuthGate>
          {/* Top brand (desktop) */}
          <div className="hidden sm:flex items-center justify-between mb-6">
            <div className="font-serif text-3xl font-extrabold tracking-tight">
              Boost<span className="text-brand-500">Fit</span>
            </div>
            <div className="flex gap-2 items-center">
              <InstallPWAButton className="btn btn-ghost" label="Installer l’app" />
              <NavLink to="/"        className={({isActive}) => `btn ${isActive ? 'btn-primary' : 'btn-ghost'}`}>Aujourd’hui</NavLink>
              <NavLink to="/progress" className={({isActive}) => `btn ${isActive ? 'btn-primary' : 'btn-ghost'}`}>Suivi</NavLink>
              <NavLink to="/coach"    className={({isActive}) => `btn ${isActive ? 'btn-primary' : 'btn-ghost'}`}>Coach</NavLink>
              <NavLink to="/onboarding" className={({isActive}) => `btn ${isActive ? 'btn-primary' : 'btn-ghost'}`}>Profil</NavLink>
              <button className="btn btn-ghost" onClick={signOut} title="Se déconnecter">Quitter</button>
            </div>
          </div>

          {/* Routes */}
          <Routes>
            <Route path="/" element={<Today/>}/>
            <Route path="/progress" element={<Progress/>}/>
            <Route path="/coach" element={<Coach/>}/>
            <Route path="/onboarding" element={<Onboarding/>}/>
            <Route path="/auth" element={<Auth/>}/>
            <Route path="*" element={<App/>}/>
          </Routes>

          {/* Bottom dock (mobile) */}
          <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 mobile-dock">
            <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl ring-1 ring-[rgba(212,175,55,.14)] flex items-center justify-between">
              <div className="bg-white/90 backdrop-blur rounded-3xl shadow-2xl ring-1 ring-brand-500/15 flex items-center justify-between">
                <LinkBtn to="/">🏠<div className="text-xs">Aujourd’hui</div></LinkBtn>
                <LinkBtn to="/progress">📈<div className="text-xs">Suivi</div></LinkBtn>
                <LinkBtn to="/coach">🎯<div className="text-xs">Coach</div></LinkBtn>
                <LinkBtn to="/onboarding">⚙️<div className="text-xs">Profil</div></LinkBtn>
                <button onClick={signOut} className="item flex-1 flex flex-col items-center justify-center py-3 text-slate-500">⏏︎<div className="text-xs">Quitter</div></button>
              </div>
            </div>
          </nav>
        </AuthGate>
      </div>
    </BrowserRouter>
  )
}


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Shell/>
  </React.StrictMode>,
)
