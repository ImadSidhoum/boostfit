import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: [
    'favicon.svg',
    'apple-touch-icon.png',
    'pwa-192.png',
    'pwa-512.png',
    'pwa-maskable-512.png'
  ],
  manifest: {
    name: 'BoostFit',
    short_name: 'BoostFit',
    description: 'Micro-habitudes, design premium, expérience mobile.',
    start_url: '/',
    scope: '/',
    display: 'standalone',             // Android full-screen app-like
    // display: 'fullscreen',           // uncomment if you truly want no status bar on Android
    display_override: ['standalone'],
    orientation: 'portrait',
    theme_color: '#0b0b0c',
    background_color: '#fffaf3',
    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ],
    shortcuts: [
      { name: 'Aujourd’hui', url: '/' },
      { name: 'Suivi', url: '/progress' },
      { name: 'Coach', url: '/coach' }
    ]
  },
  workbox: {
    cleanupOutdatedCaches: true,
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        urlPattern: /\/api\//,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api',
          networkTimeoutSeconds: 5
        }
      },
      {
        // Google Fonts stylesheets
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'google-fonts-styles' }
      },
      {
        // Google Fonts files
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-webfonts',
          expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 }
        }
      },
      {
        // App images
        urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'images' }
      }
    ]
  }
})

  ]
})
