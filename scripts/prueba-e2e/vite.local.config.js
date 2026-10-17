import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite de pruebas locales: sirve el repo y reenvía /api al servidor local del puerto 3001.
export default defineConfig({
  root: resolve(import.meta.dirname, '../..'),
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:3001' } },
});
