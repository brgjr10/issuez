import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'assets',
  base: '/issuez/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        hoistTransitiveImports: false,
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
