// src/components/InstallPWAButton.jsx
import { useEffect, useState } from "react"

export default function InstallPWAButton({
  className = "btn bg-white shadow",
  label = "＋ Installer"
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true
    setIsStandalone(!!standalone)

    const ua = (navigator.userAgent || "").toLowerCase()
    setIsIOS(/iphone|ipad|ipod/.test(ua))

    const onBIP = (e) => {
      // Prevent mini-infobar and store the event for the button
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const onInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
    }

    window.addEventListener("beforeinstallprompt", onBIP)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (isStandalone) return null

  const handleClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    try { await deferredPrompt.userChoice } finally { setDeferredPrompt(null) }
  }

  // iOS Safari: no beforeinstallprompt — show quick tip
  if (isIOS && !deferredPrompt) {
    return (
      <button
        type="button"
        className={className}
        onClick={() =>
          alert(
            "Sur iPhone/iPad :\n1) Ouvrez dans Safari\n2) Bouton Partager\n3) « Sur l’écran d’accueil »"
          )
        }
        title="Installer l’app"
      >
        {label}
      </button>
    )
  }

  // Android/Chromium: show only when prompt is ready
  if (!deferredPrompt) return null

  return (
    <button type="button" className={className} onClick={handleClick} title="Installer l’app">
      {label}
    </button>
  )
}
