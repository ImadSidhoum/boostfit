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

function Shell() {
  const signOut = async ()=> { try { await supabase.auth.signOut() } catch {} }

  const LinkBtn = ({to, children}) => (
    <NavLink to={to} className={({isActive}) =>
      `flex-1 text-center py-2 ${isActive ? 'text-brand-500' : 'text-slate-400'}`
    }>
      {children}
    </NavLink>
  )

  return (
    <BrowserRouter>
      <div className="app-container">
        <AuthGate>
          {/* Top brand (desktop) */}
          <div className="hidden sm:flex items-center justify-between mb-6">
            <div className="font-serif text-3xl font-extrabold tracking-tight">
              Boost<span className="text-brand-500">Fit</span>
            </div>
            <div className="flex gap-2 items-center">
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
          <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50">
            <div className="mx-auto max-w-3xl px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
              <div className="bg-white/90 backdrop-blur rounded-3xl shadow-2xl ring-1 ring-brand-500/15 flex items-center justify-between">
                <LinkBtn to="/">🏠<div className="text-xs">Aujourd’hui</div></LinkBtn>
                <LinkBtn to="/progress">📈<div className="text-xs">Suivi</div></LinkBtn>
                <LinkBtn to="/coach">🎯<div className="text-xs">Coach</div></LinkBtn>
                <LinkBtn to="/onboarding">⚙️<div className="text-xs">Profil</div></LinkBtn>
                <button onClick={signOut} className="flex-1 text-center py-2 text-slate-400">⏏︎<div className="text-xs">Quitter</div></button>
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
