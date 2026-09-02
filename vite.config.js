import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // `@/` -> src/, matching jsconfig.json and components.json. shadcn components
  // are generated with this alias baked into their imports, so both the bundler
  // and the editor have to resolve it.
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'),
    },
  },

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
