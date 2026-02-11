
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Attendance Pro',
        short_name: 'Attended',
        theme_color: '#4f46e5',
        icons: [
          {
            src: 'logo.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
});
    