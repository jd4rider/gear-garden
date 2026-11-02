import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths keep the build portable across GitHub Pages project
  // paths, the custom domain and a future Electron shell.
  base: './',
  server: { port: 5175 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1800,
  },
})
