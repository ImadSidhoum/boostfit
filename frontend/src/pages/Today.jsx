// frontend/src/pages/Today.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import HabitCard from "../components/HabitCard";
import ProgressRing from "../components/ProgressRing";
import Confetti from "react-confetti";
import ProgressGarden from "../components/ProgressGarden";
import ScheduleTimeline from "../components/ScheduleTimeline";
import { motion, AnimatePresence } from "framer-motion";

export default function Today() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  const [planMsg, setPlanMsg] = useState("");
  const [energy, setEnergy] = useState("medium");

  const doneCount = useMemo(() => habits.filter(h => h.done).length, [habits]);
  const totalHabits = useMemo(() => habits.length, [habits]);
  const countLabel = totalHabits === 1 ? "1 action du jour" : `${totalHabits} actions du jour`;


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
    if (navigator.vibrate) navigator.vibrate(12); // ✨
    const nowDone = optimistic.filter(x => x.done).length;
    if (nowDone === totalHabits && totalHabits > 0) {
      setCelebrate(true); setTimeout(() => setCelebrate(false), 1800);
    }
  } catch (e) { console.error(e); setHabits(habits); }
  };

  if (loading) {
    return (
        <div className="card text-center">
            <p className="font-semibold">Chargement de votre plan du jour...</p>
        </div>
    );
  }

  return (
    <div className="space-y-5">
      {celebrate && <Confetti width={window.innerWidth} height={window.innerHeight} numberOfPieces={250} recycle={false} />}
      
      <div className="card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <div className="badge capitalize">Énergie du jour: {energy}</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-serif mt-2 text-brand-charcoal-dark">
            Aujourd'hui
          </h1>
          <p className="text-brand-charcoal-light mt-1">{planMsg}</p>
        </div>
        <ProgressRing total={Math.max(1, totalHabits)} done={doneCount} />
      </div>

      <ProgressGarden />
      <ScheduleTimeline habits={habits} />
      
      <AnimatePresence>
        {habits.length > 0 ? (
          <motion.div layout className="grid gap-4">
            {habits.map((h) => (
              <HabitCard key={h.id} habit={h} onToggle={() => toggleHabit(h)} />
            ))}
          </motion.div>
        ) : (
          <motion.div layout className="card text-center">
            <p className="text-2xl mb-2">🎉</p>
            <h3 className="font-bold text-lg">Tout est prêt !</h3>
            <p className="text-brand-charcoal-light">Aucune action n'est prévue pour aujourd'hui. Profitez-en pour vous reposer ou ajoutez une nouvelle habitude depuis votre profil.</p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}