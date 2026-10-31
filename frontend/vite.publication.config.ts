import { defineConfig } from 'vite';
export default defineConfig({
  publicDir: false,
  build: { outDir: 'publication-dist', rollupOptions: { input: 'publication.html' } },
});
