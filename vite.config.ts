// vitest/config re-exports Vite's defineConfig with the `test` key typed.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  // Tailwind v4 runs as a Vite plugin. There is no postcss.config.
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Keep the vendor bundle off the critical path. The /admin tree is
        // split by React.lazy in routes.tsx, not here.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
