import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error("Supabase env missing. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY at build time.")
}

export const supabase = createClient(url, key)
