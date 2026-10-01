import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      // ESM source (not the CommonJS dist) so unused shared exports tree-shake away.
      '@acc/types': resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
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
        preview: resolve(__dirname, 'preview.html'),
      },
    },
  },
});
