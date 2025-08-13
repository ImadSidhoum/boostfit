import { motion } from "framer-motion";
import { IconCheck } from "./Icons"; // Assuming you will add an IconCheck to Icons.jsx

export default function HabitCard({ habit, onToggle }) {
  const done = habit.done;
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
      className={`w-full text-left p-4 rounded-2xl flex items-center justify-between transition-colors duration-300 ease-in-out ${
        done
          ? 'bg-brand-gold/20 border-brand-gold'
          : 'bg-white/80 border-transparent'
      } border-l-4 shadow-soft`}
    >
      <div className="flex items-center gap-4">
        <div className="text-3xl">{habit.icon}</div>
        <div>
          <div className="font-semibold text-brand-charcoal-dark">{habit.name}</div>
          <div className="text-xs text-brand-charcoal-light capitalize">
            {habit.category} • difficulté {habit.difficulty}
          </div>
        </div>
      </div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${done ? 'bg-brand-gold text-white' : 'bg-slate-100 border border-slate-200'}`}>
        <AnimatePresence>
            {done && (
                <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}