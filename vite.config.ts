import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// The build's id: the commit (+ the time, so a rebuild of the same commit is new too).
// GitHub Pages lets browsers keep every file for 10 minutes and its headers cannot be
// changed, so after a deploy a visitor could get the old page, or the new code with old
// models and sounds (their names never change). The id goes into those files' URLs
// (`?v=`, src/version.ts) and into version.json, which the page checks on load.
const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; } })();
const BUILD = `${commit}-${Date.now().toString(36)}`;

export default defineConfig({
  // relative base: the build works from any sub-path (GitHub Pages, a CDN folder)
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [{
    name: 'version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) });
    }
  }],
  build: {
    target: 'es2022',
    // three alone is ~550 kB minified; the scene is one page, so one chunk is fine for now
    chunkSizeWarningLimit: 800
  }
});
