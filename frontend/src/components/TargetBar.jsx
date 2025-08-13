export default function TargetBar({ label, unit, value=0, target=0, step=1, onChange }){
    const pct = target ? Math.min(100, Math.round((value/target)*100)) : 0
    return (
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">{label}</div>
          <div className="text-sm text-slate-600">{value} / {target} {unit}</div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
          <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#f97316,#fb923c)'}}/>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max={Math.max(target*1.5, target+1)}
            step={step}
            value={value}
            onChange={(e)=>onChange(Number(e.target.value))}
            className="w-full"
          />
          <input
            type="number"
            step={step}
            className="border rounded-xl px-3 py-2 w-24"
            value={value}
            onChange={(e)=>onChange(Number(e.target.value))}
          />
        </div>
      </div>
    )
  }
  