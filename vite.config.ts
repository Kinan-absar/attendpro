
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
            src: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
});
