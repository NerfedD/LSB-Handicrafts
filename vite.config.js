import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Declared up front so the dev server doesn't discover these mid-load and
  // then re-optimize, which forces a full page reload part-way through the
  // first paint.
  optimizeDeps: {
    include: ['react', 'react-dom/client', '@supabase/supabase-js'],
  },

  server: {
    // Transform the login path before the browser asks for it — that's
    // everything needed for first paint.
    warmup: {
      clientFiles: [
        './src/main.jsx',
        './src/App.jsx',
        './src/components/LoginPage.jsx',
      ],
    },
    // Keep the watcher out of any stray nested install.
    watch: {
      ignored: ['**/lsbHandicraft/**'],
    },
  },
})
