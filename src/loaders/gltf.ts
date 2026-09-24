import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/* Loader for the kit models (meshopt-compressed, see scripts/assets/build.mjs); Draco is
   supported too. DRACOLoader resolves its decoder with new URL(…, import.meta.url), so
   Vite bundles it; it is only fetched when a Draco mesh shows up. */

let draco: DRACOLoader | null = null;

export function createGLTFLoader() {
  draco ??= new DRACOLoader();
  return new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
}

export async function loadGLTF(url: string) {
  return createGLTFLoader().loadAsync(url);
}
