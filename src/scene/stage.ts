import { ACESFilmicToneMapping, FogExp2, Scene, WebGLRenderer } from 'three';
import { FOG_OUT, cfg } from '../config';
import { Q } from '../quality';

export const renderer = new WebGLRenderer({ antialias: Q.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

export const scene = new Scene();
export const fog = new FogExp2(FOG_OUT.getHex(), cfg.fog);
scene.fog = fog;
renderer.setClearColor(FOG_OUT, 1);
