import { motion } from "framer-motion";

export default function ProgressRing({ total = 3, done = 0, size = 84, stroke = 10 }) {
  const pct = total > 0 ? done / total : 0;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
      <defs>
        <linearGradient id="gold_gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E7D48D" />
            <stop offset="100%" stopColor="#D4AF37" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="stroke-slate-200"
        strokeWidth={stroke}
        fill="none"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#gold_gradient)"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.2, ease: "circOut" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-bold text-xl text-brand-charcoal-dark"
        dy=".1em"
      >
        {`${Math.round(pct * 100)}%`}
      </text>
    </svg>
  );
}