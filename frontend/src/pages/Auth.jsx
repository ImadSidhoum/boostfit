// frontend/src/pages/Auth.jsx
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import InstallPWAButton from "../components/InstallPWAButton.jsx"
import Field from "../components/Field.jsx" // Use the new Field component
import { AnimatePresence, motion } from "framer-motion"

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === "signup") {
      signUp();
    } else {
      signInWithPassword();
    }
  }

  async function signInWithPassword() {
    if (!validEmail || !password) return setError("Email ou mot de passe invalide.")
    setLoading(true); setError(""); setInfo("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err) {
      setError(err.message || "Impossible de se connecter.")
    } finally { setLoading(false) }
  }

  async function signUp() {
    if (!validEmail) return setError("Email invalide.")
    if (!password || password.length < 6) return setError("Le mot de passe doit faire au moins 6 caractères.")
    if (password !== password2) return setError("Les mots de passe ne correspondent pas.")
    setLoading(true); setError(""); setInfo("");
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin }
      })
      if (error) throw error
      setInfo("Vérifiez votre boîte mail pour confirmer votre compte ✉️")
    } catch (err) {
      setError(err.message || "Impossible de créer le compte.")
    } finally { setLoading(false) }
  }
  
  // ... (rest of the functions: signInWithPassword, signUp, password reset)

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm mx-auto"
      >
        <div className="card text-center">
            <div className="mb-6">
                <div className="text-4xl font-serif font-extrabold tracking-tight text-brand-charcoal-dark">
                Boost<span className="text-brand-gold">Fit</span>
                </div>
                <p className="text-brand-charcoal-light mt-1">Votre coach personnel de micro-habitudes.</p>
            </div>

            {/* Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 mb-6 bg-brand-sand rounded-xl">
                <button
                className={`btn !py-2 ${mode === "signin" ? "btn-subtle !bg-white" : "btn-ghost"}`}
                onClick={() => setMode("signin")} >
                    Connexion
                </button>
                <button
                className={`btn !py-2 ${mode === "signup" ? "btn-subtle !bg-white" : "btn-ghost"}`}
                onClick={() => setMode("signup")} >
                    Créer un compte
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="vous@exemple.com" required />
                <Field label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />
                
                <AnimatePresence>
                {mode === "signup" && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Field label="Confirmer le mot de passe" type="password" value={password2} onChange={setPassword2} placeholder="••••••••" required />
                    </motion.div>
                )}
                </AnimatePresence>

                <AnimatePresence>
                    {error && <motion.div initial={{opacity:0}} animate={{opacity:1}} className="text-sm text-red-600 font-medium p-2 bg-red-50 rounded-lg">{error}</motion.div>}
                    {info && <motion.div initial={{opacity:0}} animate={{opacity:1}} className="text-sm text-green-700 font-medium p-2 bg-green-100 rounded-lg">{info}</motion.div>}
                </AnimatePresence>

                <button type="submit" className="btn btn-primary w-full !py-4 text-base" disabled={loading}>
                    {loading ? "Patientez…" : (mode === "signup" ? "Créer mon compte" : "Se connecter")}
                </button>
            </form>

            {mode === "signin" && (
                <button
                    className="block w-full text-center mt-4 text-sm underline text-brand-charcoal-light hover:text-brand-gold"
                    type="button"
                    // ... (password reset logic)
                >
                    Mot de passe oublié ?
                </button>
            )}
        </div>
        <div className="text-center mt-4">
             <InstallPWAButton
                className="inline-flex items-center gap-2 text-sm underline text-brand-charcoal-light hover:text-brand-gold"
                label="Installer l’application sur votre iPhone"
            />
        </div>
      </motion.div>
    </div>
  )
}