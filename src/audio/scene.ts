import { Object3D, PositionalAudio } from 'three';
import { GATE_Z, MAX_ANGLE } from '../config';
import { random } from '../random';
import { torch } from '../scene/lights';
import { scene } from '../scene/stage';
import { DOOR_POS, HEARTH_POS, SIGN_POS } from '../scene/tavern';
import { state } from '../state';
import voiceLines from '../ui/voice-lines.json';
import { actx, bedInput, fetchDecode, listener, markStarted, oneShot, voice } from './engine';

/* The scene's sound.
   Beds:        forest (stereo, highs cut — tropical insects live there),
                synthesised wind, tavern music behind the closed door.
   Positional:  torch, hearth, sign, door — mono (hard rule 6), placed in the world.
   One-shots:   footsteps (6 variants), owls, fly whoosh, paper rustle.
   Voice:       the walk narration, one line at a time. */

type Sound = 'forest' | 'music' | 'fire' | 'door' | 'whoosh' | 'paper'
  | `step${number}` | `owl${number}` | `sign${number}` | `voice/line${number}`;
export type Buffers = Record<Sound, AudioBuffer>;

/** the narration files (scripts/voice/generate.mjs); their count follows voice-lines.json */
export const voiceName = (i: number): Sound => `voice/line${i}`;
const SOUNDS: Sound[] = ['forest', 'music', 'fire', 'door', 'whoosh', 'paper',
  'step0', 'step1', 'step2', 'step3', 'step4', 'step5',
  'owl0', 'owl1', 'owl2', 'sign0', 'sign1', 'sign2',
  ...voiceLines.lines.map((_, i) => voiceName(i))];

const LOAD_TIMEOUT = 12000;

/** Audio never blocks entry (hard rule 7): resolves with null on timeout or any failure. */
export function loadAudio(): Promise<Buffers | null> {
  return new Promise(done => {
    let settled = false;
    const finish = (v: Buffers | null) => { if (settled) return; settled = true; clearTimeout(timer); done(v); };
    const timer = setTimeout(() => { console.warn('audio: timeout'); finish(null); }, LOAD_TIMEOUT);
    Promise.all(SOUNDS.map(fetchDecode))
      .then(list => { const o = {} as Buffers; SOUNDS.forEach((k, i) => o[k] = list[i]); finish(o); })
      .catch((e: unknown) => { console.warn('audio: failed to load —', e); finish(null); });
  });
}

/** Resumes the context (needs the click) and starts playback when buffers exist. */
export function resumeAndStart(bufs: Buffers | null) {
  const go = () => { try { start(bufs); } catch (e) { console.warn('audio:', e); } };
  actx.resume().then(go, go);
}

export const mix = { torch: 1, wind: 1, forest: 1, music: 1 };   // layer switches, for listening checks
let forestCut = 3500;
export function setForestCut(v: number) { forestCut = v; }

let B = {} as Buffers;
let beds: { forest: Bed; music: Bed; wind: GainNode } | null = null;
let snd: { torch: PositionalAudio; hearth: PositionalAudio; sign: PositionalAudio; door: PositionalAudio } | null = null;
const torchObj = new Object3D(); scene.add(torchObj);

interface Bed { f: BiquadFilterNode; g: GainNode }
// bed: loop → filter → gain. Gain and cutoff are driven per frame.
function bed(buf: AudioBuffer, cut: number): Bed {
  const s = actx.createBufferSource(); s.buffer = buf; s.loop = true;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = .5;
  const g = actx.createGain(); g.gain.value = 0;
  s.connect(f).connect(g).connect(bedInput()); s.start();
  return { f, g };
}
// pink noise → bandpass 380 Hz with a slow LFO on the centre frequency
function wind() {
  const len = Math.floor(actx.sampleRate * 4), buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = .997 * b0 + w * .0555; b1 = .985 * b1 + w * .0750; b2 = .95 * b2 + w * .1530; d[i] = (b0 + b1 + b2 + w * .02) * .55;
  }
  const cf = Math.floor(actx.sampleRate * .3);
  for (let i = 0; i < cf; i++) { const k = i / cf; d[i] = d[i] * k + d[len - cf + i] * (1 - k); }
  const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = .55;
  const g = actx.createGain(); g.gain.value = 0;
  src.connect(bp).connect(g).connect(bedInput()); src.start();
  const lfo = actx.createOscillator(); lfo.frequency.value = .06;
  const lg = actx.createGain(); lg.gain.value = 230; lfo.connect(lg).connect(bp.frequency); lfo.start();
  return g;
}
function placed(buf: AudioBuffer, pos: { x: number; y: number; z: number },
  ref: number, roll: number, vol: number, loop: boolean) {
  const o = new Object3D(); o.position.set(pos.x, pos.y, pos.z); scene.add(o);
  const a = new PositionalAudio(listener);
  a.setBuffer(buf); a.setLoop(loop); a.setRefDistance(ref); a.setRolloffFactor(roll); a.setVolume(vol);
  o.add(a); return a;
}

function start(bufs: Buffers | null) {
  if (!bufs) return;
  B = bufs;
  beds = { forest: bed(B.forest, forestCut), music: bed(B.music, 380), wind: wind() };   // music: behind the door — muffled
  const torchSnd = new PositionalAudio(listener);
  torchSnd.setBuffer(B.fire); torchSnd.setLoop(true);
  torchSnd.setRefDistance(1.1); torchSnd.setRolloffFactor(1.7); torchSnd.setVolume(.8);
  torchObj.add(torchSnd); torchSnd.play();
  const hearth = placed(B.fire, HEARTH_POS, 3.2, 1.1, 0, true);
  hearth.setPlaybackRate(.72); hearth.play();
  snd = {
    torch: torchSnd, hearth,
    sign: placed(B.sign0, SIGN_POS, 3, 1.3, .9, false),
    door: placed(B.door, DOOR_POS, 4, 1, 1.1, false)
  };
  markStarted();
}

/* ── script events ───────────────────────────────────────────────── */
let stepLeft = false, lastStepIdx = -1, nextSign = 4, nextOwl = 9, owlsLeft = 3;

export function sfxStep() {
  // the index is drawn even without audio, like in the prototype
  let i; do { i = Math.floor(random() * 6); } while (i === lastStepIdx); lastStepIdx = i;
  stepLeft = !stepLeft;
  oneShot(B[`step${i}`], {
    rate: .92 + random() * .16, gain: .5 + random() * .25, pan: stepLeft ? -.2 : .2
  });
}
export function sfxDoor() { if (snd) { if (snd.door.isPlaying) snd.door.stop(); snd.door.play(); } }
// whoosh peaks at 0.48 s, camera speed peaks about 1 s after the fly starts
export function sfxWhoosh() { oneShot(B.whoosh, { gain: .85, delay: .55 }); }
/** when the sheet first covers the viewport */
export function sfxPaper() { oneShot(B.paper, { gain: .9 }); }

/** Walk narration: dry, centred, not positional. One line at a time. */
let voiceSrc: AudioBufferSourceNode | null = null;
export function playVoice(i: number) {
  stopVoice();
  const buf = B[voiceName(i)] as AudioBuffer | undefined;
  if (!snd || !buf) return;
  const { s } = voice(buf);
  s.start();
  s.onended = () => { if (voiceSrc === s) voiceSrc = null; };
  voiceSrc = s;
}
export function stopVoice() {
  if (voiceSrc) { try { voiceSrc.stop(); } catch { /* already stopped */ } voiceSrc = null; }
}

export function updateAudio(dt: number, camZ: number) {
  if (!beds || !snd) return;
  const { inside, t, doorAngle, phase } = state;
  const out = 1 - inside;
  // forest and wind die out inside
  beds.forest.g.gain.value = .55 * out * mix.forest;
  beds.forest.f.frequency.value = forestCut;
  const gust = .55 + .45 * Math.sin(t * .13) * Math.sin(t * .041);
  beds.wind.gain.value = .06 * gust * out * mix.wind;
  // music: muffled from ~48 m, the door opens it up fully
  const dist = Math.max(0, camZ - GATE_Z);
  const near = Math.pow(Math.min(1, Math.max(0, 1 - (dist - 6) / 42)), 1.6);
  const open = Math.max(doorAngle / MAX_ANGLE, inside);
  beds.music.g.gain.value = near * (.3 + .5 * open) * mix.music;
  beds.music.f.frequency.value = 380 * Math.pow(14000 / 380, open);
  // hearth inside
  snd.hearth.setVolume(1.4 * inside);
  torchObj.position.copy(torch.position);
  snd.torch.setVolume(.8 * mix.torch);
  // the sign creaks while we are outside
  nextSign -= dt;
  if (nextSign <= 0 && inside < .5) {
    nextSign = 3.5 + random() * 5;
    if (snd.sign.isPlaying) snd.sign.stop();
    snd.sign.setBuffer(B[`sign${Math.floor(random() * 3)}`]);
    snd.sign.setPlaybackRate(.9 + random() * .2); snd.sign.play();
  }
  // distant owls, three per walk
  if (phase === 'walk' && owlsLeft > 0) {
    nextOwl -= dt;
    if (nextOwl <= 0) {
      owlsLeft--; nextOwl = 13 + random() * 9;
      oneShot(B[`owl${2 - owlsLeft}`], { gain: .32, pan: (random() * 2 - 1) * .7, lowpass: 2200 });
    }
  }
}

export function resetAudio() {
  nextSign = 4; nextOwl = 9; owlsLeft = 3; lastStepIdx = -1;
  if (snd?.door.isPlaying) snd.door.stop();
}
