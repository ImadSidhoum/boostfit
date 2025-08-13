import { useEffect, useState } from "react"
import { api } from "../api"

export default function LevelBadge(){
  const [s, setS] = useState(null)

  useEffect(()=>{
    api.get("/gamify/status").then(r=>setS(r.data)).catch(()=>{})
  }, [])

  if(!s) return null
  const pct = Math.round((s.progress_01 || 0) * 100)

  return (
    <div className="card flex items-center justify-between">
      <div>
        <div className="text-xs text-slate-500">Niveau</div>
        <div className="font-bold text-lg">{s.level} — {s.level_name}</div>
        <div className="text-sm text-slate-600">{s.total_xp} XP (→ {s.next_level_xp} XP)</div>
      </div>
      <div className="w-40">
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#e7d48d,#d4af37)" }}/>
        </div>
        <div className="text-right text-xs text-slate-500 mt-1">{pct}%</div>
      </div>
    </div>
  )
}
