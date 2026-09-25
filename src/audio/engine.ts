import { AudioListener } from 'three';
import { camera } from '../camera/camera';

/* The audio context and the mix: master volume, the visitor's mute, a bed bus the
   narrator can duck, and one-shot playback. Everything else plays through here. */

export const listener = new AudioListener(); camera.add(listener);
export const actx = listener.context;

/* Volume: the visitor's sliders (ui/sound.ts), remembered between visits. */
const VOLUME_KEY = 'tavern:volume';
const stored = (() => { try { return localStorage.getItem(VOLUME_KEY); } catch { return null; } })();
let master = stored !== null && Number.isFinite(+stored) ? Math.min(1, Math.max(0, +stored)) : .7, ready = false;
export const getMaster = () => master;
const masterListeners = new Set<(v: number) => void>();
/** Sliders subscribe so the scene's and the site's stay in step. */
export function onMasterChange(fn: (v: number) => void) { masterListeners.add(fn); }
export function setMaster(v: number) {
  master = v;
  try { localStorage.setItem(VOLUME_KEY, String(v)); } catch { /* private mode */ }
  applyVolume();
  masterListeners.forEach(fn => fn(v));
}

/* Mute: the whole mix (beds, one-shots, narrator) goes through the listener's gain,
   ramped over ~0.15 s so toggling never clicks. The speaker icon toggles it, in the scene
   and on the site. The scene always STARTS with sound — after a reload and on "Back to
   the tavern" — because the intro is the point; the visitor's last choice (remembered)
   applies from landing on, and a mute clicked during the walk carries onto the page. */
const MUTE_KEY = 'tavern:muted';
let wantMuted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();
let muted = false;
export const isMuted = () => muted;
const muteListeners = new Set<(m: boolean) => void>();
export function onMuteChange(fn: (m: boolean) => void) { muteListeners.add(fn); }
function applyMute(m: boolean) { muted = m; applyVolume(); muteListeners.forEach(fn => fn(m)); }
export function setMuted(m: boolean) {
  wantMuted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* private mode */ }
  applyMute(m);
}
/** true on landing (the remembered choice applies), false when the scene replays (sound on) */
export function setOnSite(v: boolean) { applyMute(v && wantMuted); }
function applyVolume() {
  if (!ready) return;
  listener.gain.gain.setTargetAtTime(muted ? 0 : master, actx.currentTime, .05);
}

/** true once the context runs and the scene's sounds are started */
export const audioStarted = () => ready;
export function markStarted() { listener.setMasterVolume(muted ? 0 : master); ready = true; }

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
