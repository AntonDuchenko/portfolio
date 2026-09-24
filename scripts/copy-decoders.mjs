// Copies the Draco decoder shipped with three into public/, so GLTFLoader can load it
// from our own origin (no CDN at runtime). Runs on postinstall; output is gitignored.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/three/examples/jsm/libs/draco/gltf');
const dst = join(root, 'public/draco');

if (!existsSync(src)) {
  console.warn('copy-decoders: three is not installed yet, skipping');
} else {
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log('copy-decoders: public/draco ready');
}
