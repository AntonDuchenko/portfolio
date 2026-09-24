import { ColorManagement } from 'three';

// The prototype ran on r128 defaults: no colour management, linear output. Hex colours
// were used as-is. This must run before ANY Color is created (materials, fog colours),
// so it is the first import of main.ts and of every module that builds colours at load.
// Revisit together with the real (sRGB-textured) assets.
ColorManagement.enabled = false;
