import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: 5173,
    host: true, // permite abrir pelo celular na mesma rede (sem push: exige HTTPS)
    proxy: { '/api': 'http://localhost:3000' },
  },
});
