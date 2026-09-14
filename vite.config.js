import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        host: resolve(__dirname, 'host.html'),
        player: resolve(__dirname, 'player.html'),
      },
    },
  },
});
