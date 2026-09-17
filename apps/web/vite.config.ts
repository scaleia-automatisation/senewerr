import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const ROOT_ENV_DIR = path.resolve(__dirname, '../../')

export default defineConfig(({ mode }) => {
  // Le .env vit à la racine du monorepo (jamais commité — voir .gitignore).
  // On le charge explicitement et on l'expose à Vite via process.env
  // (plus fiable que `envDir` avec un chemin absolu sous Windows).
  Object.assign(process.env, loadEnv(mode, ROOT_ENV_DIR, ''))

  return {
  envDir: ROOT_ENV_DIR,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'Medikool',
        short_name: 'Medikool',
        description: 'Votre carnet de santé connecté au Sénégal',
        theme_color: '#159B55',
        background_color: '#F5F9FA',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@medikool/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts')
    }
  },
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
          ui: ['framer-motion', 'lucide-react']
        }
      }
    }
  }
  }
})
