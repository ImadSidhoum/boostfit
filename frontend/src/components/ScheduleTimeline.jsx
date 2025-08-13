import { useEffect, useMemo, useState } from "react"
import { api } from "../api"
import { downloadICS } from "../utils/calendar"

const SLOTS = [
  { id: "morning", label: "Matin", hour: 8, minute: 0 },
  { id: "lunch",   label: "Déjeuner", hour: 12, minute: 30 },
  { id: "evening", label: "Soir", hour: 18, minute: 30 }
]

export default function ScheduleTimeline({ habits=[] }){
  const [map, setMap] = useState({}) // habit_id -> slot
  const [loading, setLoading] = useState(true)

  const scheduled = useMemo(()=> new Set(Object.keys(map).map(Number)), [map])
  const unscheduled = habits.filter(h => !scheduled.has(h.id))

  const load = async ()=>{
    setLoading(true)
    try{
      const r = await api.get("/schedule/today")
      const next = {}
      for (const it of (r.data?.items || [])) next[it.habit_id] = it.slot
      setMap(next)
    } finally { setLoading(false) }
  }

  useEffect(()=>{ load() }, [])

  const save = async (nextMap)=>{
    setMap(nextMap)
    const items = Object.entries(nextMap).map(([habit_id, slot])=>({ habit_id: Number(habit_id), slot }))
    await api.post("/schedule/today", items)
  }

  const onDrop = (slotId, habit)=>{
    const next = { ...map, [habit.id]: slotId }
    save(next).catch(()=>setMap(map))
  }

  const card = (h)=>(
    <div
      key={h.id}
      draggable
      onDragStart={(e)=>e.dataTransfer.setData("text/plain", String(h.id))}
      className="cursor-grab active:cursor-grabbing bg-white rounded-xl shadow px-3 py-2 text-sm flex items-center justify-between"
      title="Glisser-déposer"
    >
      <span className="flex items-center gap-2"><span className="text-xl">{h.icon}</span>{h.name}</span>
      <AddToCalButton habit={h} slotId={map[h.id]} />
    </div>
  )

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold">Plan ta journée</h3>
        <div className="text-sm text-slate-600">Glisse chaque habitude dans un créneau</div>
      </div>

      {/* Unscheduled */}
      {unscheduled.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-slate-500 mb-1">À planifier</div>
          <div className="grid sm:grid-cols-3 gap-2">
            {unscheduled.map(card)}
          </div>
        </div>
      )}

      {/* Slots */}
      <div className="grid sm:grid-cols-3 gap-3">
        {SLOTS.map(s=>(
          <DropSlot key={s.id} slot={s}
            onDropHabit={(hid)=>{
              const h = habits.find(x => x.id === Number(hid))
              if (h) onDrop(s.id, h)
            }}>
            {(habits.filter(h => map[h.id]===s.id)).map(card)}
          </DropSlot>
        ))}
      </div>

      {loading && <div className="text-slate-500 text-sm mt-2">Chargement…</div>}
    </div>
  )
}

function DropSlot({ slot, onDropHabit, children }){
  const onDrop = (e)=>{
    e.preventDefault()
    const hid = e.dataTransfer.getData("text/plain")
    onDropHabit(hid)
  }
  return (
    <div
      onDragOver={(e)=>e.preventDefault()}
      onDrop={onDrop}
      className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50/40 p-3 min-h-[96px] border border-orange-100"
    >
      <div className="text-sm font-semibold mb-2">{slot.label}</div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function AddToCalButton({ habit, slotId }){
  if(!slotId) return null
  const slot = SLOTS.find(s => s.id === slotId)
  const create = ()=>{
    const start = new Date()
    start.setHours(slot.hour, slot.minute, 0, 0)
    if (start < new Date()) start.setDate(start.getDate()+1) // next occurrence if time passed
    downloadICS({
      title: `BoostFit — ${habit.name}`,
      description: "Petit rappel de tes micro-habitudes 💪",
      start,
      durationMin: 15
    })
  }
  return (
    <button className="btn bg-white shadow text-xs" onClick={create} title="Ajouter au calendrier">+ Calendrier</button>
  )
}
