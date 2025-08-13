// frontend/src/pages/Today.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import HabitCard from "../components/HabitCard";
import ProgressRing from "../components/ProgressRing";
import Confetti from "react-confetti";
import ProgressGarden from "../components/ProgressGarden";
import ScheduleTimeline from "../components/ScheduleTimeline";

export default function Today() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  const [planMsg, setPlanMsg] = useState("");
  const [energy, setEnergy] = useState("medium");

  const doneCount = useMemo(() => habits.filter(h => h.done).length, [habits]);
  const totalHabits = useMemo(() => habits.length, [habits]);

  const fetchPlan = async () => {
    setLoading(true)
    try {
      const [planRes] = await Promise.all([
        api.get("/plan/today"),
      ])
      setEnergy(planRes.data.energy)
      setPlanMsg(planRes.data.message)
      // récupérer statut via /api/habits (qui renvoie les 3 avec done)
      const habitsRes = await api.get("/habits")
      setHabits(habitsRes.data)
    } catch(e){
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlan();
  }, []);

  const toggleHabit = async (h) => {
    const newDone = !h.done;
    const optimistic = habits.map(x => x.id === h.id ? { ...x, done: newDone } : x);
    setHabits(optimistic);

    try {
      await api.post("/checkins", { habit_id: h.id, done: newDone });
      const nowDone = optimistic.filter(x => x.done).length;
      if (nowDone === totalHabits && totalHabits > 0) { // Corrected logic
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1800);
      }
    } catch (e) {
      console.error(e);
      setHabits(habits); // revert
    }
  };

  if (loading) {
    return <div className="card">Chargement du plan…</div>;
  }


  return (
    <div className="space-y-5">
      {celebrate && <Confetti numberOfPieces={200} recycle={false} />}
      <div className="card flex items-center justify-between">
        <div>
          <div className="badge">Énergie: {energy}</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-2">Tes 3 actions du jour</h1>
          <p className="text-slate-600 mt-1">{planMsg}</p>
        </div>
        <ProgressRing total={3} done={doneCount}/>
      </div>

      {/* 🌱 Jardin de progrès (visuel) */}
      <ProgressGarden/>

      {/* 🗓️ Planification simple (drag & drop + .ics) */}
      <ScheduleTimeline habits={habits}/>

      <div className="grid gap-4">
        {habits.map(h => (
          <HabitCard key={h.id} habit={h} onToggle={()=>toggleHabit(h)}/>
        ))}
      </div>
    </div>
  )
}
