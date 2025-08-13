import { useEffect, useMemo, useState } from "react"
import { api } from "../api"
import { enableDailyNudge } from "../utils/notify"

// New component for managing habits
function HabitManager() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: "", icon: "🎯", category: "lifestyle", difficulty: 1 });

  const loadHabits = async () => {
    setLoading(true);
    try {
      const res = await api.get("/habits/manage");
      setHabits(res.data || []);
    } catch (e) {
      console.error("Failed to load habits", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHabits();
  }, []);

  const handleDelete = async (habitId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette habitude ?")) return;
    try {
      await api.delete(`/habits/manage/${habitId}`);
      setHabits(prev => prev.filter(h => h.id !== habitId));
    } catch (e) {
      alert("Erreur lors de la suppression.");
    }
  };
  
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newHabit.name) return alert("Le nom est requis.");
    try {
        const res = await api.post("/habits/manage", newHabit);
        setHabits(prev => [...prev, res.data]);
        setShowForm(false);
        setNewHabit({ name: "", icon: "🎯", category: "lifestyle", difficulty: 1 });
    } catch(e) {
        alert("Erreur lors de l'ajout.");
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Mes Habitudes Personnalisées</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(p => !p)}>{showForm ? 'Annuler' : '+ Ajouter'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-4 p-4 bg-orange-50 rounded-xl">
            <Field label="Nom de l'habitude" type="text" value={newHabit.name} onChange={v => setNewHabit(p => ({...p, name: v}))} placeholder="Ex: Lire 10 pages"/>
            <Field label="Icône (Emoji)" type="text" value={newHabit.icon} onChange={v => setNewHabit(p => ({...p, icon: v}))}/>
            <div>
              <label className="text-sm text-slate-600">Catégorie</label>
              <select className="mt-1 border rounded-xl px-3 py-2 w-full" value={newHabit.category} onChange={e=>setNewHabit(p=>({...p, category: e.target.value}))}>
                  <option value="nutrition">Nutrition</option>
                  <option value="movement">Mouvement</option>
                  <option value="hydration">Hydratation</option>
                  <option value="lifestyle">Lifestyle</option>
              </select>
            </div>
             <div>
              <label className="text-sm text-slate-600">Difficulté</label>
              <select className="mt-1 border rounded-xl px-3 py-2 w-full" value={newHabit.difficulty} onChange={e=>setNewHabit(p=>({...p, difficulty: Number(e.target.value)}))}>
                  <option value={1}>1 (Facile)</option>
                  <option value={2}>2 (Standard)</option>
                  <option value={3}>3 (Booster)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
                <button type="submit" className="btn btn-primary">Enregistrer l'habitude</button>
            </div>
        </form>
      )}

      {loading && <p>Chargement des habitudes...</p>}
      {!loading && habits.length === 0 && <p className="text-slate-500">Vous n'avez pas encore d'habitude personnalisée. Ajoutez-en une !</p>}
      
      <div className="space-y-2">
        {habits.map(h => (
          <div key={h.id} className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{h.icon}</span>
              <div>
                <p className="font-semibold">{h.name}</p>
                <p className="text-xs text-slate-500 capitalize">{h.category} • difficulté {h.difficulty}</p>
              </div>
            </div>
            <button onClick={() => handleDelete(h.id)} className="text-red-500 hover:text-red-700 font-semibold">
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Onboarding(){
  const [form, setForm] = useState({
    sex: "male",
    birth_year: 1995,
    height_cm: 178,
    weight_kg: 80,
    activity_factor: 1.5,
    deficit_percent: 0.18,
    diet: "omnivore",
    mode: "simple",
    units: "metric",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
    reminder_time: "18:00"
  })
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const setVal = (k, v)=> setForm(prev => ({ ...prev, [k]: v }))

  const load = async ()=>{
    try{
      const r = await api.get("/profile")
      setForm(prev => ({ ...prev, ...r.data, timezone: r.data.timezone || prev.timezone }))
      setLoaded(true)
    }catch(e){ setLoaded(true) }
  }

  useEffect(()=>{ load() }, [])

  const save = async ()=>{
    setSaving(true)
    try{
      const payload = { ...form }
      // normaliser les nombres
      if (payload.height_cm != null) payload.height_cm = Number(payload.height_cm)
      if (payload.weight_kg != null) payload.weight_kg = Number(payload.weight_kg)
      if (payload.activity_factor != null) payload.activity_factor = Number(payload.activity_factor)
      if (payload.deficit_percent != null) payload.deficit_percent = Number(payload.deficit_percent)
      const r = await api.put("/profile", payload)
      setForm(prev => ({...prev, ...r.data}))
      alert("Profil enregistré ✅")
    }catch(e){
      alert("Erreur lors de l’enregistrement.")
    }finally{
      setSaving(false)
    }
  }

  const testReminder = async ()=>{
    try{
      const [hh, mm] = (form.reminder_time || "18:00").split(":").map(Number)
      await enableDailyNudge(async ()=>{
        new Notification("Rappel BoostFit", { body: "Pense à tes 3 micro-habitudes 💪" })
      }, hh, mm)
      new Notification("Rappel BoostFit", { body: "Test de notification envoyé 👍" })
    }catch(e){}
  }

  const age = useMemo(()=>{
    if(!form.birth_year) return ""
    const y = new Date().getFullYear()
    return Math.max(0, y - Number(form.birth_year))
  }, [form.birth_year])

  if(!loaded) return <div className="card">Chargement du profil…</div>

  return (
    <div className="space-y-6">
        <div className="card space-y-4">
          <h2 className="text-xl font-bold">Profil & préférences</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Sexe" type="select" value={form.sex} onChange={v=>setVal('sex', v)} options={[
              {value:'male', label:'Homme'},
              {value:'female', label:'Femme'}
            ]}/>
            <Field label="Année de naissance" type="number" value={form.birth_year||""} onChange={v=>setVal('birth_year', Number(v)||null)}/>
            <ReadOnly label="Âge (approx.)" value={age ? `${age} ans` : '—'}/>
            <Field label="Taille (cm)" type="number" step="0.5" value={form.height_cm||""} onChange={v=>setVal('height_cm', v)}/>
            <Field label="Poids (kg)" type="number" step="0.1" value={form.weight_kg||""} onChange={v=>setVal('weight_kg', v)}/>
            <Field label="Régime" type="select" value={form.diet} onChange={v=>setVal('diet', v)} options={[
              {value:'omnivore', label:'Omnivore'},
              {value:'vegetarian', label:'Végétarien'}
            ]}/>
            <Field label="Mode" type="select" value={form.mode} onChange={v=>setVal('mode', v)} options={[
              {value:'simple', label:'Suivi simple'},
              {value:'detail', label:'Suivi détaillé'}
            ]}/>
            <Field label="Unités" type="select" value={form.units} onChange={v=>setVal('units', v)} options={[
              {value:'metric', label:'Métriques (kg, cm)'},
              {value:'imperial', label:'Impériales (lb, in)'}
            ]}/>
            <ReadOnly label="Fuseau horaire" value={form.timezone || '—'}/>
            <Field label="Heure de rappel" type="time" value={form.reminder_time || ""} onChange={v=>setVal('reminder_time', v)}/>
            <Field label="Facteur d’activité (1.2–1.9)" type="number" step="0.1" value={form.activity_factor||""} onChange={v=>setVal('activity_factor', v)}/>
            <Field label="Déficit cible (0–0.2)" type="number" step="0.01" value={form.deficit_percent||""} onChange={v=>setVal('deficit_percent', v)}/>
          </div>

          <div className="flex gap-2">
            <button className="btn bg-white shadow" onClick={testReminder} type="button">Tester le rappel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving} type="button">
              {saving ? '...' : 'Enregistrer'}
            </button>
          </div>

          <div className="flex gap-2">
            <span className="badge">Streak visuel</span>
            <span className="badge">Planification + .ics</span>
            <span className="badge">Nudges à l’heure choisie</span>
          </div>
          <p className="text-slate-600 text-sm">Ces préférences alimentent les cibles & rappels, et pré-remplissent d’autres écrans.</p>
        </div>
        <HabitManager />
    </div>
  )
}

function Field({label, type="text", value, onChange, step, options, placeholder}){
  return (
    <div>
      <label className="text-sm text-slate-600">{label}</label>
      {type === "select" ? (
        <select className="mt-1 border rounded-xl px-3 py-2 w-full" value={value||""} onChange={e=>onChange(e.target.value)}>
          {(options||[]).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          className="mt-1 border rounded-xl px-3 py-2 w-full"
          type={type}
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={e=>onChange(e.target.value)}
        />
      )}
    </div>
  )
}

function ReadOnly({ label, value }){
  return (
    <div>
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-1 border rounded-xl px-3 py-2 bg-slate-50">{value}</div>
    </div>
  )
}