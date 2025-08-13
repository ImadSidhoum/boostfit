// Very small ICS generator (floating local time)
export function downloadICS({ title, description="", start, durationMin=15 }){
    const pad = n => String(n).padStart(2,'0')
    const dt = (d)=> `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
    const dtstamp = dt(new Date())
    const dtstart = dt(start)
    const end = new Date(start.getTime() + durationMin*60000)
    const dtend = dt(end)
    const uid = `${Date.now()}-${Math.random().toString(16).slice(2)}@boostfit`
  
    const ics = [
      "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//BoostFit//Schedule//FR",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${escapeICS(title)}`,
      description ? `DESCRIPTION:${escapeICS(description)}` : null,
      "END:VEVENT",
      "END:VCALENDAR"
    ].filter(Boolean).join("\r\n")
  
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${title.replace(/\s+/g,'_')}.ics`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }
  function escapeICS(s){ return String(s).replace(/([,;])/g,"\\$1").replace(/\n/g,"\\n") }
  