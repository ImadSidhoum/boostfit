import { useEffect, useState } from "react"
import { api } from "../api"

export default function CoachChat({ compact=false }){
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async ()=>{
    setLoading(true)
    try{
      const r = await api.get("/coach/message")
      setMsg(r.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])

  if(loading && !msg) return <div className="card">Le coach réfléchit…</div>

  return (
    <div className={`card ${compact ? 'p-4' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-lg">{msg?.title || "Coach"}</div>
          <p className="text-slate-700 mt-1">{msg?.message}</p>
          <ul className="mt-2 list-disc list-inside text-slate-700">
            {(msg?.actions || []).map((a,i)=>(<li key={i}>{a}</li>))}
          </ul>
        </div>
        <button className="btn bg-white shadow" onClick={load} title="Nouveau nudge">↻</button>
      </div>
    </div>
  )
}
