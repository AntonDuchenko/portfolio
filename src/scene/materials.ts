import { BoxGeometry, type Material, Mesh, MeshStandardMaterial } from 'three';

/* The few flat materials left from the prototype; everything else wears kit materials. */
export const M = {
  iron: new MeshStandardMaterial({ color: 0x171611, roughness: .8, metalness: .35 }),
  paper: new MeshStandardMaterial({ color: 0xcbbb93, roughness: 1 }),
  earth: new MeshStandardMaterial({ color: 0x232720, roughness: 1, flatShading: true }),
  // the path lies 5 cm over the terrain; the offset keeps it on top where the two meet
  path: new MeshStandardMaterial({ color: 0x453b2c, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })
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
