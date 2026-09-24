import { PerspectiveCamera } from 'three';

// near 0.15: the flight ends ~0.4 m from the sheet on wide screens
export const camera = new PerspectiveCamera(56, innerWidth / innerHeight, .15, 400);
