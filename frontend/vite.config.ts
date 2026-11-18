import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// In local development the Vite server proxies /api to the backend, so the
// browser always talks to a single origin (the same shape as the Nginx setup
// used in Docker) and no CORS configuration is needed.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'PLANTPULSE_');
  const backend = env.PLANTPULSE_BACKEND_URL ?? 'http://127.0.0.1:8000';
  const proxy = { '/api': { target: backend, changeOrigin: false } };

  return {
    plugins: [react(), tailwindcss()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
    preview: { host: '127.0.0.1', port: 4173, proxy },
    test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true },
  };
});
