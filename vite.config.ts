import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

/**
 * Multi-page build: each HTML entry maps to a URL subpath on Cloudflare Pages.
 *   index.html             -> /
 *   home/index.html        -> /home/
 *   work/index.html        -> /work/
 *   gardenleave/index.html -> /gardenleave/
 */
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        landing: resolve(rootDir, 'index.html'),
        home: resolve(rootDir, 'home/index.html'),
        work: resolve(rootDir, 'work/index.html'),
        gardenleave: resolve(rootDir, 'gardenleave/index.html'),
      },
    },
  },
});
