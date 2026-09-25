import type { Vector3 } from 'three';
import { EYE } from './config';

export type Phase = 'walk' | 'hold' | 'open' | 'fly' | 'done';

/** Everything a replay starts over from. */
const run = () => ({
  phase: 'walk' as Phase,
  walked: 0,
  pt: 0,                        // time inside the current phase
  t: 0,                         // total scene time
  flyFrom: 0,
  torchLeft: null as Vector3 | null,
  doorAngle: 0,
  camY: EYE,
  lastStep: -1,
  inside: 0,                    // 0 outside, 1 inside — drives fog, lights, audio
  handedOver: false             // the sheet has covered the screen: the page is taking over
});

// Mutable run state shared by the timeline, audio and portal.
export const state = {
  walkLen: 0,                   // metres; set from the narration length (timeline inversion)
  startZ: 0,                    // where the walk begins: STOP_AT + walkLen
  ...run()
};

/** "Back to the tavern": the walk's geometry stays, the run starts over. */
export function resetRun() { Object.assign(state, run()); }
