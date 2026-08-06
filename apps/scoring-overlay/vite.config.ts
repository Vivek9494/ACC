import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  server: {
    port: 5178,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        graphics: resolve(__dirname, 'graphics.html'),
        control: resolve(__dirname, 'control.html'),
      },
    },
  },
});
