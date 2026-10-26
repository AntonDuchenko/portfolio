import { BoxGeometry, type Material, Mesh, MeshStandardMaterial } from 'three';

/* The few flat materials left from the prototype; everything else wears kit materials.
   The ground and the path are painted by the terrain shader (terrain.ts). */
export const M = {
  iron: new MeshStandardMaterial({ color: 0x171611, roughness: .8, metalness: .35 }),
  paper: new MeshStandardMaterial({ color: 0xcbbb93, roughness: 1 })
};

export const box = (w: number, h: number, d: number, m: Material | Material[],
  x: number, y: number, z: number) => {
  const o = new Mesh(new BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); return o;
};
