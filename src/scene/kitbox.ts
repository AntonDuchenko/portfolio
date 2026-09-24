import { BoxGeometry, type Material, Mesh, type MeshStandardMaterial } from 'three';
import { kitMaterial } from './assets';

/* Boxes for the few pieces the kits don't have (door lintel filler, sill, notice post,
   hearth), wearing the kits' own materials so they match. UVs are projected from
   positions: tiling materials repeat every TILE metres, trim-sheet wood uses one plank
   strip of T_WoodTrim with the grain along the box's long axis. */

type Surface =
  | { mat: 'MI_Plaster' | 'MI_UnevenBrick' | 'MI_Brick'; tile: number }
  | { mat: 'MI_WoodTrim'; strip: 'light' | 'dark' };

// rows of the trim sheet (v from the top, glTF convention)
const STRIPS = { light: [.02, .29], dark: [.32, .59] } as const;

const cache = new Map<string, Material>();
function surfaceMaterial(s: Surface) {
  const key = s.mat;
  if (!cache.has(key)) cache.set(key, kitMaterial('village', s.mat));
  return cache.get(key)! as MeshStandardMaterial;
}

export function kitBox(w: number, h: number, d: number, s: Surface, x: number, y: number, z: number) {
  const g = new BoxGeometry(w, h, d);
  const pos = g.attributes.position, uv = g.attributes.uv, nrm = g.attributes.normal;
  const size = [w, h, d], long = size.indexOf(Math.max(...size));
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const n = [Math.abs(nrm.getX(i)), Math.abs(nrm.getY(i)), Math.abs(nrm.getZ(i))];
    const axis = n.indexOf(Math.max(...n));                 // face normal axis
    const [a, b] = [0, 1, 2].filter(k => k !== axis);       // face plane axes
    if ('tile' in s) {
      uv.setXY(i, p[a] / s.tile, -p[b] / s.tile);
    } else {
      const along = long !== axis ? long : a, across = [a, b].find(k => k !== along)!;
      const [v0, v1] = STRIPS[s.strip];
      const f = size[across] ? p[across] / size[across] + .5 : .5;
      uv.setXY(i, p[along] / 1.5, v0 + (v1 - v0) * f);
    }
  }
  const m = new Mesh(g, surfaceMaterial(s));
  m.position.set(x, y, z);
  return m;
}
