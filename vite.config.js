import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        host: resolve(import.meta.dirname, 'host.html'),
        player: resolve(import.meta.dirname, 'player.html'),
      },
      output: {
        // El mapa de argumentos (React Flow + dagre) es lo más pesado y cambia poco: en su propio
        // chunk se cachea aparte y el resto de la interfaz carga más rápido en el celular.
        manualChunks(idDelModulo) {
          if (idDelModulo.includes('node_modules/@xyflow') || idDelModulo.includes('node_modules/@dagrejs')) {
            return 'mapa-de-argumentos';
          }
          if (idDelModulo.includes('node_modules/ably')) {
            return 'ably';
          }
          return undefined;
        },
      },
    },
  },
});
