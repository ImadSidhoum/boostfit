import axios from "axios"
import { supabase } from "./lib/supabase"

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 10000
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
