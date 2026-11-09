import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/gardenleave/',
  plugins: [react()],
  build: {
    outDir: 'dist/gardenleave',
    sourcemap: true,
  },
});
