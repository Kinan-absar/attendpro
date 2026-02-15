
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' strategy is the most stable for iOS Add-to-Home-Screen apps.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Attendance Pro',
        short_name: 'Attendance',
        description: 'Professional Attendance Tracking',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          }
        ],
      },
      workbox: {
        // Cache all static assets produced by the build
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Force the new service worker to take control as soon as it's ready
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        // Ensure the service worker itself is never cached by the browser
        navigateFallbackDenylist: [/^\/sw.js$/],
      },
      devOptions: {
        enabled: true, // Allows testing PWA features in dev mode
      }
    }),
  ],
});
