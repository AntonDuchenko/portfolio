import { AudioListener } from 'three';
import { camera } from '../camera/camera';

/* The audio context and the mix: master volume, the visitor's mute, a bed bus the
   narrator can duck, and one-shot playback. Everything else plays through here. */

export const listener = new AudioListener(); camera.add(listener);
export const actx = listener.context;

let master = .7, ready = false;

export function setMaster(v: number) { master = v; applyVolume(); }

/* Mute: the whole mix (beds, one-shots, narrator) goes through the listener's gain,
   ramped over ~0.15 s so toggling never clicks. It is a preference for the SITE only:
   the scene always plays with sound (the intro is the point, and Skip is there for
   anyone who wants out), so the stored choice applies from landing on (setOnSite). */
const MUTE_KEY = 'tavern:muted';
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();
let onSite = false;
export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* private mode */ }
  applyVolume();
}
/** true on landing, false when the scene replays */
export function setOnSite(v: boolean) { onSite = v; applyVolume(); }
function applyVolume() {
  if (!ready) return;
  listener.gain.gain.setTargetAtTime(muted && onSite ? 0 : master, actx.currentTime, .05);
}

/** true once the context runs and the scene's sounds are started */
export const audioStarted = () => ready;
export function markStarted() { listener.setMasterVolume(muted && onSite ? 0 : master); ready = true; }

// beds (forest, music, wind) share a bus so the site narrator can duck them
let bedBus: GainNode | null = null;
export const bedInput = () => bedBus ??= (() => { const g = actx.createGain(); g.connect(listener.getInput()); return g; })();
/** 1 = full; the narrator ducks the beds to a third while it speaks */
export function duckBeds(v: number) { bedBus?.gain.setTargetAtTime(v, actx.currentTime, .25); }

export async function fetchDecode(path: string) {
  const res = await fetch(`${import.meta.env.BASE_URL}audio/${path}.mp3`);
  if (!res.ok) throw new Error(`${path}.mp3: HTTP ${res.status}`);
  return actx.decodeAudioData(await res.arrayBuffer());
}

export interface ShotOpts { rate?: number; gain?: number; pan?: number; lowpass?: number; delay?: number }
/** Fire and forget: buffer → (lowpass) → pan → gain → mix. Silent until started. */
export function oneShot(buf: AudioBuffer | undefined, o: ShotOpts = {}) {
  if (!ready || !buf) return;
  const s = actx.createBufferSource(); s.buffer = buf; s.playbackRate.value = o.rate ?? 1;
  let node: AudioNode = s;
  if (o.lowpass) {
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lowpass;
    node.connect(f); node = f;
  }
  const p = actx.createStereoPanner(); p.pan.value = o.pan ?? 0;
  const g = actx.createGain(); g.gain.value = o.gain ?? 1;
  node.connect(p).connect(g).connect(listener.getInput());
  s.start(actx.currentTime + (o.delay ?? 0));
}

/** Dry, centred voice (walk narration and the innkeeper); returns the source and its gain. */
export const VOICE_GAIN = 1.1;
export function voice(buf: AudioBuffer) {
  const s = actx.createBufferSource(); s.buffer = buf;
  const g = actx.createGain(); g.gain.value = VOICE_GAIN;
  s.connect(g).connect(listener.getInput());
  return { s, g };
}
