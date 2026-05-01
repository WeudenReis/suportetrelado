import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Fallback automático para Vercel Preview quando env vars não estão configuradas
// Usa Supabase DEV (anon key — chave pública, segura para client-side)
if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production') {
  if (!process.env.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL_DEV || ''
  }
  if (!process.env.VITE_SUPABASE_ANON_KEY) {
    process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY_DEV || ''
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-motion': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
})
