import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/* Loader for the asset step (Quaternius kits, compressed with Draco or meshopt).
   The Draco decoder is served from public/draco (copied from three on install,
   see scripts/copy-decoders.mjs) and only fetched when a Draco mesh shows up. */

let draco: DRACOLoader | null = null;

export function createGLTFLoader() {
  if (!draco) {
    draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  }
  return new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
}

export async function loadGLTF(url: string) {
  return createGLTFLoader().loadAsync(url);
}
