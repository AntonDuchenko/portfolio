import { AdditiveBlending, CanvasTexture, Sprite, SpriteMaterial, type Texture } from 'three';

function glowTexture(a: string, b: string, c0: string) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, a); g.addColorStop(.3, b); g.addColorStop(1, c0);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new CanvasTexture(c);
}
export const fireTex = glowTexture('rgba(255,240,200,1)', 'rgba(255,170,70,.8)', 'rgba(120,40,0,0)');
export const mistTex = glowTexture('rgba(150,175,215,.30)', 'rgba(130,155,200,.16)', 'rgba(110,135,180,0)');
export const smokeTex = glowTexture('rgba(90,95,105,.22)', 'rgba(80,85,95,.12)', 'rgba(70,75,85,0)');

export type GlowSprite = Sprite & { material: SpriteMaterial; userData: { base: number } };

export function sprite(tex: Texture, s: number, o: number, fog?: boolean): GlowSprite {
  const sp = new Sprite(new SpriteMaterial({
    map: tex, transparent: true,
    blending: AdditiveBlending, depthWrite: false, opacity: o, fog: fog !== false
  })) as GlowSprite;
  sp.scale.set(s, s * 1.25, 1); sp.userData.base = s; return sp;
}
