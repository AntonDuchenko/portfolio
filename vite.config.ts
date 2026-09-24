import { defineConfig } from 'vite';

export default defineConfig({
  // relative base: the build works from any sub-path (GitHub Pages, a CDN folder)
  base: './',
  build: {
    target: 'es2022',
    // three alone is ~550 kB minified; the scene is one page, so one chunk is fine for now
    chunkSizeWarningLimit: 800
  }
});
