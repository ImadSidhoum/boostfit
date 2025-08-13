// frontend/src/AuthGate.jsx
import { useEffect, useState } from "react"
import { supabase } from "./lib/supabase"
import Auth from "./pages/Auth"

export default function AuthGate({ children }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => { mounted = false; sub.subscription?.unsubscribe?.() }
  }, [])

  if (loading) return <div className="card">Initialisation…</div>
  if (!session) return <Auth />
  return children
}
