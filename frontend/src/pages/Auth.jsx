// frontend/src/pages/Auth.jsx
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Auth() {
  const [mode, setMode] = useState("signin") // 'signin' | 'signup' | 'magic'
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")

  // Auto-clear messages when the form changes
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
      // AuthGate will detect the session and render the app shell
    } catch (err) {
      setError(err.message || "Impossible de se connecter.")
    } finally {
      setLoading(false)
    }
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
          emailRedirectTo: window.location.origin, // returns to your app after email confirm (if enabled)
          data: { username: email.split("@")[0] }  // optional profile seed
        }
      })
      if (error) throw error
      setInfo("Vérifiez votre boîte mail pour confirmer votre compte ✉️")
    } catch (err) {
      setError(err.message || "Impossible de créer le compte.")
    } finally {
      setLoading(false)
    }
  }

  async function sendMagicLink(e) {
    e.preventDefault()
    if (!validEmail) return setError("Email invalide.")
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      })
      if (error) throw error
      setInfo("Lien magique envoyé. Consultez vos emails ✉️")
    } catch (err) {
      setError(err.message || "Envoi impossible.")
    } finally {
      setLoading(false)
    }
  }

  async function oauth(provider) {
    setLoading(true)
    setError("")
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin }
      })
      if (error) throw error
      // user is redirected by provider; on return, AuthGate picks up the session
    } catch (err) {
      setError(err.message || "Connexion OAuth impossible.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto card space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">
          {mode === "signup" ? "Créer un compte" : mode === "magic" ? "Lien magique" : "Se connecter"}
        </h1>
        <p className="text-slate-600">
          {mode === "signup"
            ? "Rejoignez l’app en quelques secondes."
            : mode === "magic"
            ? "Recevez un lien de connexion par email."
            : "Entrez vos identifiants pour continuer."}
        </p>
      </div>

      {/* Switcher */}
      <div className="flex gap-2">
        <button
          className={`btn ${mode === "signin" ? "btn-primary" : "bg-white shadow"}`}
          onClick={() => setMode("signin")}
          type="button"
        >Connexion</button>
        <button
          className={`btn ${mode === "signup" ? "btn-primary" : "bg-white shadow"}`}
          onClick={() => setMode("signup")}
          type="button"
        >Créer un compte</button>
        <button
          className={`btn ${mode === "magic" ? "btn-primary" : "bg-white shadow"}`}
          onClick={() => setMode("magic")}
          type="button"
        >Lien magique</button>
      </div>

      {/* OAuth */}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn bg-white shadow" onClick={() => oauth("google")} type="button" disabled={loading}>
          Continuer avec Google
        </button>
        <button className="btn bg-white shadow" onClick={() => oauth("github")} type="button" disabled={loading}>
          Continuer avec GitHub
        </button>
      </div>

      {/* Email forms */}
      <form
        onSubmit={mode === "signup" ? signUp : mode === "magic" ? sendMagicLink : signInWithPassword}
        className="space-y-3"
      >
        <div>
          <label className="text-sm text-slate-600">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            className="mt-1 border rounded-xl px-3 py-2 w-full"
            placeholder="vous@exemple.com"
          />
        </div>

        {mode !== "magic" && (
          <>
            <div>
              <label className="text-sm text-slate-600">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                className="mt-1 border rounded-xl px-3 py-2 w-full"
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
                  className="mt-1 border rounded-xl px-3 py-2 w-full"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
            )}
          </>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}
        {info && <div className="text-sm text-green-700 bg-green-50 rounded-xl p-2">{info}</div>}

        <button className="btn btn-primary w-full" disabled={loading}>
          {loading
            ? "Patientez…"
            : mode === "signup"
              ? "Créer mon compte"
              : mode === "magic"
                ? "Envoyer le lien"
                : "Se connecter"}
        </button>
      </form>

      {mode === "signin" && (
        <button
          className="text-sm underline text-slate-600"
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
  )
}
