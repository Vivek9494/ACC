import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.API_PROXY_TARGET || 'http://localhost:3001';
  const isDevServer = command === 'serve';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // A pre-bundled @acc/types dist is cached until restart, so new exports read as undefined.
        ...(isDevServer && {
          '@acc/types': fileURLToPath(new URL('../../packages/types/src/index.ts', import.meta.url)),
        }),
      },
    },
    // @acc/types ships CommonJS (dist) — the production build converts it via commonjsOptions.
    build: {
      commonjsOptions: { include: [/packages[\\/]types/, /node_modules/] },
    },
    server: {
      port: 5180,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      environment: 'node',
    },
  };
});
