import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for HF Spaces
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
