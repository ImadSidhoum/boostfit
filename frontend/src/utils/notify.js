export async function enableDailyNudge(checkFn, hour=18, minute=0){
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
  
    const schedule = ()=>{
      const now = new Date();
      const next = new Date();
      next.setHours(hour, minute, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      const ms = next - now;
      setTimeout(async ()=>{
        try { await checkFn(); } finally { schedule(); }
      }, ms);
    };
    schedule();
  }
  