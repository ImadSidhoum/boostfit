import { useEffect, useState } from "react"
import { api } from "../api"
import TrendChart from "../components/TrendChart"

export default function Progress(){
  const [trend, setTrend] = useState([])
  const [kg, setKg] = useState("")
  const [saving, setSaving] = useState(false)

  const loadTrend = async ()=>{
    try{
      const res = await api.get("/trend")
      setTrend(res.data || [])
    }catch(e){ console.error(e) }
  }

  useEffect(()=>{ loadTrend() }, [])

  const submit = async (e)=>{
    e.preventDefault()
    if(!kg) return
    setSaving(true)
    try{
      await api.post("/weighins", { kg: parseFloat(kg) })
      setKg("")
      await loadTrend()
    }catch(e){ console.error(e) }
    finally{ setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="text-xl font-bold mb-2">Ajouter une pesée</h2>
        <form onSubmit={submit} className="flex items-end gap-3">
          <div>
            <label className="text-sm text-slate-600">Poids (kg)</label>
            <input
              type="number" step="0.1" min="20" max="300"
              value={kg} onChange={e=>setKg(e.target.value)}
              className="mt-1 border rounded-xl px-3 py-2 w-40"
              placeholder="81.6"
            />
          </div>
          <button className="btn btn-primary" disabled={saving}>{saving ? '...' : 'Enregistrer'}</button>
        </form>
      </div>
      <TrendChart data={trend}/>
    </div>
  )
}
