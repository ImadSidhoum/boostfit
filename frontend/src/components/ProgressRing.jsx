export default function ProgressRing({ total=3, done=0, size=84, stroke=10 }){
    const pct = total ? (done/total) : 0
    const r = (size - stroke)/2
    const circ = 2 * Math.PI * r
    const dash = circ * pct
  
    return (
      <svg width={size} height={size} className="drop-shadow">
        <circle cx={size/2} cy={size/2} r={r} stroke="#eee" strokeWidth={stroke} fill="none"/>
        <circle
          cx={size/2} cy={size/2} r={r}
          stroke="url(#g1)" strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${circ-dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
        <defs>
          <linearGradient id="g1" x1="0" x2="1">
            <stop offset="0%" stopColor="#f97316"/>
            <stop offset="100%" stopColor="#fb923c"/>
          </linearGradient>
        </defs>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="font-bold">{Math.round(pct*100)}%</text>
      </svg>
    )
  }
  