import { useEffect, useState } from "react"
import { api } from "../api"

export default function ProgressGarden(){
  const [g, setG] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async ()=>{
    setLoading(true)
    try { const r = await api.get("/garden/state"); setG(r.data) }
    finally { setLoading(false) }
  }

  useEffect(()=>{ load() }, [])

  if (loading && !g) return <div className="card">Jardin en cours…</div>

  const droop = g?.droopy && !g?.watered_today
  const waterPulse = g?.watered_today

  return (
    <div className="card flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <PlantSVG stage={g?.stage} droop={droop} waterPulse={waterPulse}/>
        <div>
          <div className="font-semibold">Jardin de progrès</div>
          <div className="text-slate-600 text-sm">
            Streak parfait: <b>{g?.perfect_streak}</b> j • {g?.hint}
          </div>
        </div>
      </div>
      <button className="btn bg-white shadow" onClick={load} title="Rafraîchir">↻</button>
    </div>
  )
}

function PlantSVG({ stage="seed", droop=false, waterPulse=false }){
  // Super simple SVG pot + plant; stages: seed|sprout|leafy|flower
  const tilt = droop ? -8 : 0
  return (
    <svg width="84" height="84" viewBox="0 0 84 84">
      {/* pot */}
      <rect x="22" y="56" width="40" height="18" rx="4" fill="#e5e7eb" stroke="#cbd5e1"/>
      <rect x="18" y="52" width="48" height="6" rx="3" fill="#d1d5db"/>
      {/* soil */}
      <ellipse cx="42" cy="52" rx="20" ry="4" fill="#a16207" opacity="0.5"/>
      {/* stem */}
      <g transform={`rotate(${tilt} 42 52)`}>
        <rect x="40.5" y="30" width="3" height="22" rx="1.5" fill="#16a34a"/>
        {stage !== "seed" && (
          <>
            {/* leaves */}
            <Leaf cx={36} cy={40} dir="left"/>
            {stage !== "sprout" && <Leaf cx={48} cy={38} dir="right"/>}
            {stage === "leafy" && <Leaf cx={37} cy={34} dir="left"/>}
            {stage === "flower" && (
              <>
                <Leaf cx={48} cy={34} dir="right"/>
                {/* flower */}
                <circle cx="42" cy="28" r="5" fill="#f59e0b"/>
                <circle cx="42" cy="28" r="2" fill="#fff"/>
              </>
            )}
          </>
        )}
        {stage === "seed" && <circle cx="42" cy="50" r="2" fill="#78350f"/>}
      </g>
      {/* water pulse when completed today */}
      {waterPulse && (
        <circle cx="42" cy="20" r="8">
          <animate attributeName="r" from="6" to="16" dur="1.2s" repeatCount="1" fill="freeze"/>
          <animate attributeName="opacity" from="0.6" to="0" dur="1.2s" repeatCount="1" fill="freeze"/>
        </circle>
      )}
    </svg>
  )
}

function Leaf({ cx, cy, dir }){
  const d = dir === "left" ? -1 : 1
  return (
    <ellipse cx={cx} cy={cy} rx="8" ry="4" fill="#22c55e" transform={`rotate(${15*d} ${cx} ${cy})`} />
  )
}
