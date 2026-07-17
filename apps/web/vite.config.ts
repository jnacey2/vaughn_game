import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Allow Vite to read the sibling workspace packages (engine/bot) that are
      // symlinked in via npm workspaces but physically live outside apps/web.
      allow: [path.resolve(__dirname, '..', '..')],
    },
  },
})
