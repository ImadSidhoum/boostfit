import { motion } from "framer-motion"

export default function HabitCard({ habit, onToggle }){
  const done = habit.done
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.98 }}
      className={`w-full text-left card flex items-center justify-between border-l-4 ${done ? 'border-green-500 bg-green-50' : 'border-brand-600'}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl">{habit.icon}</div>
        <div>
          <div className="font-semibold">{habit.name}</div>
          <div className="text-xs text-slate-500 capitalize">{habit.category} • difficulté {habit.difficulty}</div>
        </div>
      </div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${done ? 'bg-green-500 text-white' : 'bg-slate-100'}`}>
        {done ? '✔' : ''}
      </div>
    </motion.button>
  )
}
