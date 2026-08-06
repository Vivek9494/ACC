import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5178,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
