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

  return (
    <BrowserRouter>
      <div className="app-container">
        <AuthGate>
          <nav className="flex items-center justify-between mb-6">
            <div className="font-extrabold text-2xl tracking-tight">
              Boost<span className="text-brand-600">Fit</span>
            </div>
            <div className="flex gap-2 items-center">
              <NavLink to="/" className={({isActive}) => `btn ${isActive ? 'btn-primary' : 'bg-white shadow'}`}>Aujourd’hui</NavLink>
              <NavLink to="/progress" className={({isActive}) => `btn ${isActive ? 'btn-primary' : 'bg-white shadow'}`}>Suivi</NavLink>
              <NavLink to="/coach" className={({isActive}) => `btn ${isActive ? 'btn-primary' : 'bg-white shadow'}`}>Coach</NavLink>
              <NavLink to="/onboarding" className={({isActive}) => `btn ${isActive ? 'btn-primary' : 'bg-white shadow'}`}>Profil</NavLink>
              <button className="btn bg-white shadow" onClick={signOut} title="Se déconnecter">Quitter</button>
            </div>
          </nav>
          <Routes>
            <Route path="/" element={<Today/>}/>
            <Route path="/progress" element={<Progress/>}/>
            <Route path="/coach" element={<Coach/>}/>
            <Route path="/onboarding" element={<Onboarding/>}/>
            <Route path="/auth" element={<Auth/>}/>
            <Route path="*" element={<App/>}/>
          </Routes>
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
