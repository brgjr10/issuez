import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: '.',
  publicDir: 'assets',
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
  plugins: [
    viteSingleFile({
      removeViteModuleLoader: false,
      deleteInlinedFiles: true,
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
});
