import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/* Loader for the models built by scripts/assets/build.mjs: meshopt-compressed only.
   No Draco — its decoder added ~1.3 MB of wasm to the build and nothing used it. */

export function loadGLTF(url: string) {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
}
