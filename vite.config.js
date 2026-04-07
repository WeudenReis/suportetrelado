import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Fallback automático para Vercel Preview quando env vars não estão configuradas
// Usa Supabase DEV (anon key — chave pública, segura para client-side)
if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production') {
  if (!process.env.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = 'https://vbxzeyweurzrwppdiluo.supabase.co';
  }
  if (!process.env.VITE_SUPABASE_ANON_KEY) {
    process.env.VITE_SUPABASE_ANON_KEY = 'sb_publishable_03VCMlD83Jf9fsXJB97Ccw_QEYH_4Ps';
  }
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-motion': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
        }
      }
    }
  }
});
