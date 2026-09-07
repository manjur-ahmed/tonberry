import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    // Listen on the LAN interface too, not just localhost, so the dev
    // server is reachable from a phone on the same Wi-Fi for on-device
    // testing (e.g. http://<your-LAN-IP>:5174).
    host: true,
  },
})
