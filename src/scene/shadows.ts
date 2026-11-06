import { CanvasTexture, Color, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry, Vector3 } from 'three';
import { scene } from './stage';
import { surfaceY } from './terrain';

/* Contact shadows: a soft dark patch on the ground under whatever stands on it — trees,
   rocks, bushes, the lantern posts, the yard's barrels and cart, the foot of the walls, the
   hall's tables and benches. The scene has no shadow maps: the moon's would draw the whole
   forest a second time every frame, and it lights the scene from where the sky's moon is
   not. Without any shadow, things sat on the ground like cut-outs laid over it.

   One instanced mesh for all of them (one draw call): each patch is an ellipse, tilted to
   the ground (four samples of the rendered surface) or flat on a floor, with its own depth
   of shade. The walk's trees are recycled ahead of the camera, and their patches with them
   (`moveShadow`). */

export interface Patch {
  x: number; z: number;
  /** half-sizes, m (rz defaults to rx) and the turn about y */
  rx: number; rz?: number; ry?: number;
  /** how dark at the centre, 0…1 */
  k: number;
  /** a floor's height; omitted: on the terrain */
  y?: number;
}

const patches: Patch[] = [];
let mesh: InstancedMesh | null = null;

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,.8)'); g.addColorStop(.6, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new CanvasTexture(c);
}

/** reserves a patch (before `buildShadows`); returns its index for `moveShadow` */
export function addShadow(p: Patch): number {
  if (mesh) throw new Error('shadows: added after the mesh was built');
  patches.push(p); return patches.length - 1;
}

const o = new Object3D(), n = new Vector3(), up = new Vector3(0, 1, 0);
function write(m: InstancedMesh, i: number) {
  const p = patches[i], rz = p.rz ?? p.rx;
  if (p.y === undefined) {
    const h = (dx: number, dz: number) => surfaceY(p.x + dx, p.z + dz), r = Math.max(p.rx, rz);
    n.set(h(-r, 0) - h(r, 0), 2 * r, h(0, -r) - h(0, r)).normalize();
    o.position.set(p.x, h(0, 0) + .02, p.z);         // 2 cm up, and the polygon offset (hard rule 1)
    o.quaternion.setFromUnitVectors(up, n);
  } else {
    o.position.set(p.x, p.y + .01, p.z); o.quaternion.identity();
  }
  o.rotateY(p.ry ?? 0);
  o.scale.set(p.rx, 1, rz); o.updateMatrix();
  m.setMatrixAt(i, o.matrix);
}

/** a recycled tree's patch follows it (radius 0 hides it) */
export function moveShadow(i: number, x: number, z: number, r: number) {
  const p = patches[i];
  p.x = x; p.z = z; p.rx = r; p.rz = r;
  if (!mesh) return;
  write(mesh, i); mesh.instanceMatrix.needsUpdate = true;
}

/** once everything has added its patches */
export function buildShadows() {
  const mat = new MeshBasicMaterial({
    map: shadowTexture(), transparent: true, depthWrite: false, color: 0x000000,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  // the shade per patch rides in the instance colour's red channel, as a factor on alpha
  mat.customProgramCacheKey = () => 'contactShadow';
  mat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n#ifdef USE_INSTANCING_COLOR\ndiffuseColor.a *= vColor.r;\n#endif\ndiffuseColor.rgb = vec3(0.);');
  };
  const m = new InstancedMesh(new PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mat, Math.max(1, patches.length));
  const shade = new Color();
  patches.forEach((p, i) => { write(m, i); m.setColorAt(i, shade.setRGB(p.k, p.k, p.k)); });
  m.count = patches.length;
  m.renderOrder = 1;                                 // after the ground, before the leaves' cut-outs blend
  m.frustumCulled = false;                           // spread along the whole walk and into the hall
  scene.add(m); mesh = m;
}
