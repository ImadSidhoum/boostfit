import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// /api est proxifié par Nginx en prod. En dev, Vite peut aussi proxy si besoin.
export default defineConfig({
  plugins: [react()]
})
