import { AudioListener, Object3D, PositionalAudio } from 'three';
import { camera } from '../camera/camera';
import { MAX_ANGLE, GATE_Z } from '../config';
import { torch } from '../scene/lights';
import { scene } from '../scene/stage';
import { DOOR_POS, HEARTH_POS, SIGN_POS } from '../scene/tavern';
import { state } from '../state';
import voiceLines from '../ui/voice-lines.json';

/* Beds:        forest (stereo, highs cut — tropical insects live there),
                synthesised wind, tavern music behind the closed door.
   Positional:  torch, hearth, sign, door — mono (hard rule 6), placed in the world.
   One-shots:   footsteps (6 variants), owls, fly whoosh, paper rustle. */

// voice/line<i> are the narration (scripts/voice/generate.mjs); their count follows
// src/ui/voice-lines.json
const NAMES = ['forest', 'music', 'fire', 'door', 'whoosh', 'paper',
  'step0', 'step1', 'step2', 'step3', 'step4', 'step5',
  'owl0', 'owl1', 'owl2', 'sign0', 'sign1', 'sign2',
  ...voiceLines.lines.map((_, i) => `voice/line${i}`)];
type Name = string;
export type Buffers = Record<Name, AudioBuffer>;
export const voiceName = (i: number) => `voice/line${i}`;
const VOICE_GAIN = 1.1;

const LOAD_TIMEOUT = 12000;

export const listener = new AudioListener(); camera.add(listener);
const actx = listener.context;

let master = .7, audioReady = false, B = {} as Buffers;
let forestBed: { f: BiquadFilterNode; g: GainNode } | null = null;
let musicBed: { f: BiquadFilterNode; g: GainNode } | null = null;
let windGain: GainNode | null = null;
let torchSnd: PositionalAudio | null = null, hearthSnd: PositionalAudio | null = null;
let signSnd: PositionalAudio | null = null, doorSnd: PositionalAudio | null = null;
let stepLeft = false, lastStepIdx = -1, nextSign = 4, nextOwl = 9, owlsLeft = 3, paperPlayed = false;
let forestCut = 3500;
let voiceSrc: AudioBufferSourceNode | null = null;
export const mix = { torch: 1, wind: 1, forest: 1, music: 1 };   // layer switches, for listening checks
const torchObj = new Object3D(); scene.add(torchObj);
// beds (forest, music, wind) share a bus so the site narrator can duck them
let bedBus: GainNode | null = null;
const busIn = () => bedBus ??= (() => { const g = actx.createGain(); g.connect(listener.getInput()); return g; })();

export function setMaster(v: number) { master = v; applyVolume(); }

/* Mute: the whole mix (beds, one-shots, narrator) goes through the listener's gain.
   Ramped over ~0.15 s so toggling never clicks. Remembered between visits. */
const MUTE_KEY = 'tavern:muted';
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();
export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* private mode */ }
  applyVolume();
}
function applyVolume() {
  if (!audioReady) return;
  listener.gain.gain.setTargetAtTime(muted ? 0 : master, actx.currentTime, .05);
}
export function setForestCut(v: number) { forestCut = v; }

async function fetchDecode(name: Name) {
  const res = await fetch(`${import.meta.env.BASE_URL}audio/${name}.mp3`);
  if (!res.ok) throw new Error(`${name}.mp3: HTTP ${res.status}`);
  return actx.decodeAudioData(await res.arrayBuffer());
}

/** Audio never blocks entry (hard rule 7): resolves with null on timeout or any failure. */
export function loadAudio(): Promise<Buffers | null> {
  return new Promise(done => {
    let settled = false;
    const finish = (v: Buffers | null) => { if (settled) return; settled = true; clearTimeout(timer); done(v); };
    const timer = setTimeout(() => { console.warn('audio: timeout'); finish(null); }, LOAD_TIMEOUT);
    Promise.all(NAMES.map(fetchDecode))
      .then(list => { const o = {} as Buffers; NAMES.forEach((k, i) => o[k] = list[i]); finish(o); })
      .catch(e => { console.warn('audio: failed to load —', e); finish(null); });
  });
}

/** Resumes the context (needs the click) and starts playback when buffers exist. */
export function resumeAndStart(bufs: Buffers | null) {
  const go = () => { try { startAudio(bufs); } catch (e) { console.warn('audio:', e); } };
  actx.resume().then(go, go);
}

// bed: loop → filter → gain. Gain and cutoff are driven per frame.
function bed(buf: AudioBuffer, cut: number) {
  const s = actx.createBufferSource(); s.buffer = buf; s.loop = true;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = .5;
  const g = actx.createGain(); g.gain.value = 0;
  s.connect(f).connect(g).connect(busIn()); s.start();
  return { f, g };
}
// pink noise → bandpass 380 Hz with a slow LFO on the centre frequency
function buildWind() {
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
  src.connect(bp).connect(g).connect(busIn()); src.start();
  const lfo = actx.createOscillator(); lfo.frequency.value = .06;
  const lg = actx.createGain(); lg.gain.value = 230; lfo.connect(lg).connect(bp.frequency); lfo.start();
  return g;
}
interface ShotOpts { rate?: number; gain?: number; pan?: number; lowpass?: number; delay?: number }
function oneShot(buf: AudioBuffer | undefined, o: ShotOpts = {}) {
  if (!audioReady || !buf) return;
  const s = actx.createBufferSource(); s.buffer = buf; s.playbackRate.value = o.rate || 1;
  let node: AudioNode = s;
  if (o.lowpass) {
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lowpass;
    node.connect(f); node = f;
  }
  const p = actx.createStereoPanner(); p.pan.value = o.pan || 0;
  const g = actx.createGain(); g.gain.value = o.gain == null ? 1 : o.gain;
  node.connect(p).connect(g).connect(listener.getInput());
  s.start(actx.currentTime + (o.delay || 0));
}
function placed(buf: AudioBuffer, pos: { x: number; y: number; z: number },
  ref: number, roll: number, vol: number, loop: boolean) {
  const o = new Object3D(); o.position.set(pos.x, pos.y, pos.z); scene.add(o);
  const a = new PositionalAudio(listener);
  a.setBuffer(buf); a.setLoop(loop); a.setRefDistance(ref); a.setRolloffFactor(roll); a.setVolume(vol);
  o.add(a); return a;
}

function startAudio(bufs: Buffers | null) {
  if (!bufs) return;
  B = bufs;
  forestBed = bed(B.forest, forestCut);
  musicBed = bed(B.music, 380);                 // behind the door — muffled
  windGain = buildWind();
  torchSnd = new PositionalAudio(listener);
  torchSnd.setBuffer(B.fire); torchSnd.setLoop(true);
  torchSnd.setRefDistance(1.1); torchSnd.setRolloffFactor(1.7); torchSnd.setVolume(.8);
  torchObj.add(torchSnd); torchSnd.play();
  hearthSnd = placed(B.fire, HEARTH_POS, 3.2, 1.1, 0, true);
  hearthSnd.setPlaybackRate(.72); hearthSnd.play();
  signSnd = placed(B.sign0, SIGN_POS, 3, 1.3, .9, false);
  doorSnd = placed(B.door, DOOR_POS, 4, 1, 1.1, false);
  listener.setMasterVolume(muted ? 0 : master);
  audioReady = true;
}

/* ── script events ───────────────────────────────────────────────── */
export function sfxStep() {
  // the index is drawn even without audio, like in the prototype
  let i; do { i = Math.floor(Math.random() * 6); } while (i === lastStepIdx); lastStepIdx = i;
  oneShot(B[`step${i}`], {
    rate: .92 + Math.random() * .16, gain: .5 + Math.random() * .25,
    pan: (stepLeft = !stepLeft) ? -.2 : .2
  });
}
export function sfxDoor() { if (audioReady && doorSnd) { if (doorSnd.isPlaying) doorSnd.stop(); doorSnd.play(); } }
// whoosh peaks at 0.48 s, camera speed peaks about 1 s after the fly starts
export function sfxWhoosh() { oneShot(B.whoosh, { gain: .85, delay: .55 }); }
/** once, when the sheet first covers the viewport */
export function sfxPaperOnce() { if (!paperPlayed) { paperPlayed = true; oneShot(B.paper, { gain: .9 }); } }

/** Narration: dry, centred, not positional. One line at a time. */
export function playVoice(i: number) {
  stopVoice();
  const buf = B[voiceName(i)];
  if (!audioReady || !buf) return;
  const s = actx.createBufferSource(); s.buffer = buf;
  const g = actx.createGain(); g.gain.value = VOICE_GAIN;
  s.connect(g).connect(listener.getInput()); s.start();
  s.onended = () => { if (voiceSrc === s) voiceSrc = null; };
  voiceSrc = s;
}
export function stopVoice() {
  if (voiceSrc) { try { voiceSrc.stop(); } catch { /* already stopped */ } voiceSrc = null; }
}

/* ── site narrator ───────────────────────────────────────────────────
   Buffers load lazily after landing. One line at a time; the beds duck to a third
   while it speaks. level() is the voice's RMS (0…~0.3) for the avatar. */
export async function loadNarration(ids: string[]) {
  const out: Record<string, AudioBuffer> = {};
  await Promise.all(ids.map(async id => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}audio/narrator/${id}.mp3`);
      if (res.ok) out[id] = await actx.decodeAudioData(await res.arrayBuffer());
    } catch { /* a missing line just stays silent */ }
  }));
  return out;
}
export const audioStarted = () => audioReady;

export function narrate(buf: AudioBuffer, onEnd: () => void) {
  const s = actx.createBufferSource(); s.buffer = buf;
  const g = actx.createGain(); g.gain.value = VOICE_GAIN;
  const an = actx.createAnalyser(); an.fftSize = 512;
  s.connect(g).connect(listener.getInput()); g.connect(an);
  const duck = (v: number) => bedBus?.gain.setTargetAtTime(v, actx.currentTime, .25);
  duck(.35);
  let done = false;
  const finish = () => { if (done) return; done = true; duck(1); onEnd(); };
  s.onended = finish;
  s.start();
  const data = new Float32Array(an.fftSize);
  return {
    stop() { try { s.stop(); } catch { /* ended */ } finish(); },
    level() { an.getFloatTimeDomainData(data); let e = 0; for (const v of data) e += v * v; return Math.sqrt(e / data.length); }
  };
}

export function updateAudio(dt: number, camZ: number) {
  if (!audioReady || !forestBed || !musicBed || !windGain || !torchSnd || !hearthSnd || !signSnd) return;
  const { inside, t, doorAngle, phase } = state;
  const out = 1 - inside;
  // forest and wind die out inside
  forestBed.g.gain.value = .55 * out * mix.forest;
  forestBed.f.frequency.value = forestCut;
  const gust = .55 + .45 * Math.sin(t * .13) * Math.sin(t * .041);
  windGain.gain.value = .06 * gust * out * mix.wind;
  // music: muffled from ~48 m, the door opens it up fully
  const dist = Math.max(0, camZ - GATE_Z);
  const near = Math.pow(Math.min(1, Math.max(0, 1 - (dist - 6) / 42)), 1.6);
  const open = Math.max(doorAngle / MAX_ANGLE, inside);
  musicBed.g.gain.value = near * (.3 + .5 * open) * mix.music;
  musicBed.f.frequency.value = 380 * Math.pow(14000 / 380, open);
  // hearth inside
  hearthSnd.setVolume(1.4 * inside);
  torchObj.position.copy(torch.position);
  torchSnd.setVolume(.8 * mix.torch);
  // the sign creaks while we are outside
  nextSign -= dt;
  if (nextSign <= 0 && inside < .5) {
    nextSign = 3.5 + Math.random() * 5;
    if (signSnd.isPlaying) signSnd.stop();
    signSnd.setBuffer(B[`sign${Math.floor(Math.random() * 3)}`]);
    signSnd.setPlaybackRate(.9 + Math.random() * .2); signSnd.play();
  }
  // distant owls, three per walk
  if (phase === 'walk' && owlsLeft > 0) {
    nextOwl -= dt;
    if (nextOwl <= 0) {
      owlsLeft--; nextOwl = 13 + Math.random() * 9;
      oneShot(B[`owl${2 - owlsLeft}`], { gain: .32, pan: (Math.random() * 2 - 1) * .7, lowpass: 2200 });
    }
  }
}

export function resetAudio() {
  nextSign = 4; nextOwl = 9; owlsLeft = 3; paperPlayed = false; lastStepIdx = -1;
  if (audioReady && doorSnd && doorSnd.isPlaying) doorSnd.stop();
}
