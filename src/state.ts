import type { Vector3 } from 'three';
import { EYE } from './config';

export type Phase = 'walk' | 'hold' | 'open' | 'fly' | 'done';

// Mutable run state shared by the timeline, audio and portal.
export const state = {
  phase: 'walk' as Phase,
  walked: 0,
  walkLen: 0,                   // metres; set from the narration length (timeline inversion)
  startZ: 0,                    // where the walk begins: STOP_AT + walkLen
  pt: 0,                        // time inside the current phase
  t: 0,                         // total scene time
  flyFrom: 0,
  torchLeft: null as Vector3 | null,
  doorAngle: 0,
  camY: EYE,
  lastStep: -1,
  inside: 0                     // 0 outside, 1 inside — drives fog, lights, audio
};
