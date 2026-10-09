import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Fail the build rather than ship a panel that calls the wrong API.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (!env.VITE_ADMIN_API_URL) {
    throw new Error('VITE_ADMIN_API_URL is not set. Copy apps/admin/.env.example to .env.local, or set it in your host.')
  }

  return {
    plugins: [react(), tailwindcss()],
  }
})
