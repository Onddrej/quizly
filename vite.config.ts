/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pwa = VitePWA({
  // autoUpdate swaps the service worker silently, which is safe today: the app is ONE JS chunk with content-hashed fonts,
  // and the plugin only emits a bare navigator.serviceWorker.register (no virtual:pwa-register, no reload handler), so an
  // update never touches a running study session (spec 10: a new version activates at the next launch). Adding React.lazy
  // or import() chunks, or virtual:pwa-register, would let an update interrupt a session: change this strategy then.
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
  manifest: {
    name: 'Quizly',
    short_name: 'Quizly',
    id: '/quizly/',
    description: 'Learn vocabulary with flashcards, pronunciation and Learn mode.',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#F6F7FB',
    theme_color: '#4255FF',
    icons: [
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
  },
});

export default defineConfig({
  base: '/quizly/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  plugins: [react(), ...(process.env.VITEST ? [] : [pwa])],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // some editor tests take 1.3-1.8 s locally; the deploy workflow runs them on slower CI machines
    testTimeout: 15000,
  },
});
