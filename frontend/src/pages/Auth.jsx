// frontend/src/pages/Auth.jsx
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import InstallPWAButton from "../components/InstallPWAButton.jsx"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Auth() {
  const [mode, setMode] = useState("signin") // 'signin' | 'signup'
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")

  useEffect(() => { setError(""); setInfo("") }, [mode, email, password, password2])
  const validEmail = EMAIL_REGEX.test(email)

  async function signInWithPassword(e) {
    e.preventDefault()
    if (!validEmail || !password) return setError("Email ou mot de passe invalide.")
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setInfo("Connexion réussie 🎉")
    } catch (err) {
      setError(err.message || "Impossible de se connecter.")
    } finally { setLoading(false) }
  }

  async function signUp(e) {
    e.preventDefault()
    if (!validEmail) return setError("Email invalide.")
    if (!password || password.length < 6) return setError("Mot de passe ≥ 6 caractères.")
    if (password !== password2) return setError("Les mots de passe ne correspondent pas.")
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { username: email.split("@")[0] }
        }
      })
      if (error) throw error
      setInfo("Vérifiez votre boîte mail pour confirmer votre compte ✉️")
    } catch (err) {
      setError(err.message || "Impossible de créer le compte.")
    } finally { setLoading(false) }
  }

  return (
    <div
      className="min-h-[100svh] flex flex-col items-center
                 justify-start sm:justify-center px-4
                 pt-[calc(env(safe-area-inset-top)+12px)]
                 pb-[calc(env(safe-area-inset-bottom)+24px)]"
    >
      <div className="mx-auto max-w-sm sm:max-w-md rounded-3xl p-6 sm:p-8 bg-white/90 shadow-xl ring-1 ring-[#d4af37]/20 backdrop-blur">
        <div className="text-center mb-4">
          <div className="text-3xl font-serif font-extrabold tracking-tight text-[#1a1a1a]">
            Boost<span className="text-[#d4af37]">Fit</span>
          </div>
          <p className="text-slate-600 text-sm">Accès sécurisé — email & mot de passe</p>
        </div>

        {/* Switcher */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            className={`btn ${mode === "signin" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode("signin")}
            type="button"
          >Connexion</button>
          <button
            className={`btn ${mode === "signup" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode("signup")}
            type="button"
          >Créer un compte</button>
        </div>

        {/* Formulaire email/password uniquement */}
        <form
          onSubmit={mode === "signup" ? signUp : signInWithPassword}
          className="space-y-3"
        >
          <div>
            <label className="text-sm text-slate-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              className="mt-1 border rounded-2xl px-4 py-3 w-full"
              placeholder="vous@exemple.com"
              inputMode="email"
            />
          </div>

          <div>
            <label className="text-sm text-slate-600">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              className="mt-1 border rounded-2xl px-4 py-3 w-full"
              placeholder="••••••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="text-sm text-slate-600">Confirmer le mot de passe</label>
              <input
                type="password"
                required
                value={password2}
                onChange={(e)=>setPassword2(e.target.value)}
                className="mt-1 border rounded-2xl px-4 py-3 w-full"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}
          {info && <div className="text-sm text-green-700 bg-green-50 rounded-xl p-2">{info}</div>}

          <button className="btn btn-primary w-full h-12 text-base" disabled={loading}>
            {loading ? "Patientez…" : (mode === "signup" ? "Créer mon compte" : "Se connecter")}
          </button>
        </form>

        {mode === "signin" && (
          <button
            className="block w-full text-center mt-3 text-sm underline text-slate-600"
            type="button"
            onClick={async ()=>{
              if (!validEmail) return setError("Entrez votre email ci-dessus pour le reset.")
              try{
                setLoading(true); setError(""); setInfo("")
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: window.location.origin
                })
                if (error) throw error
                setInfo("Lien de réinitialisation envoyé ✉️")
              } catch(err) {
                setError(err.message || "Réinitialisation impossible.")
              } finally { setLoading(false) }
            }}
          >
            Mot de passe oublié ?
          </button>
        )}
      </div>

      {/* Bouton d'installation visible même avant connexion */}
      <InstallPWAButton
        className="mt-4 inline-flex items-center gap-2 text-sm underline text-slate-600 bg-transparent shadow-none"
        label="Installer l’app"
      />
    </div>
  )
}
