import {
  BoxGeometry, CylinderGeometry, type Material, Mesh, MeshBasicMaterial, MeshStandardMaterial
} from 'three';

export const M = {
  beam: new MeshStandardMaterial({ color: 0x2a1d12, roughness: 1, flatShading: true }),
  plaster: new MeshStandardMaterial({ color: 0x6b5f4c, roughness: 1 }),
  plank: new MeshStandardMaterial({ color: 0x4a3520, roughness: 1 }),
  floor: new MeshStandardMaterial({ color: 0x4d3823, roughness: 1 }),
  wood: new MeshStandardMaterial({ color: 0x33240f, roughness: 1, flatShading: true }),
  iron: new MeshStandardMaterial({ color: 0x171611, roughness: .8, metalness: .35 }),
  stone: new MeshStandardMaterial({ color: 0x2e2a22, roughness: 1, flatShading: true }),
  roof: new MeshStandardMaterial({ color: 0x241d16, roughness: 1, flatShading: true }),
  glass: new MeshBasicMaterial({ color: 0xffb45e }),
  paper: new MeshStandardMaterial({ color: 0xcbbb93, roughness: 1 }),
  bark: new MeshStandardMaterial({ color: 0x1d1f26, roughness: 1, flatShading: true }),
  rock: new MeshStandardMaterial({ color: 0x302c25, roughness: 1, flatShading: true }),
  earth: new MeshStandardMaterial({ color: 0x232720, roughness: 1, flatShading: true }),
  path: new MeshStandardMaterial({ color: 0x453b2c, roughness: 1 })
};

// Ground and path: their hex values were linear numbers in the prototype. Read as sRGB
// they come out ~3× darker in linear light; measured against the prototype frame the
// ground half of the forest shot was 33 vs 55 (path 61 vs 103). ×3 restores it.
M.earth.color.multiplyScalar(3);
M.path.color.multiplyScalar(3);

export const box = (w: number, h: number, d: number, m: Material | Material[],
  x: number, y: number, z: number) => {
  const o = new Mesh(new BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); return o;
};
export const cyl = (rt: number, rb: number, h: number, m: Material,
  x: number, y: number, z: number, seg?: number) => {
  const o = new Mesh(new CylinderGeometry(rt, rb, h, seg || 8), m);
  o.position.set(x, y, z); return o;
};
