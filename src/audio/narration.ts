import { duckBeds, fetchDecode, voice } from './engine';

/* The site narrator's voice. Lines are fetched and decoded during the walk
   (preloadNarrator); one plays at a time and the beds duck to a third while it speaks.
   level() is the voice's RMS (0…~0.3) for the avatar. */

export async function loadNarration(ids: string[]) {
  const out: Record<string, AudioBuffer> = {};
  await Promise.all(ids.map(async id => {
    try { out[id] = await fetchDecode(`narrator/${id}`); } catch { /* a missing line just stays silent */ }
  }));
  return out;
}

export function narrate(buf: AudioBuffer, onEnd: () => void) {
  const { s, g } = voice(buf);
  const an = g.context.createAnalyser(); an.fftSize = 512;
  g.connect(an);
  duckBeds(.35);
  let done = false;
  const finish = () => { if (done) return; done = true; duckBeds(1); onEnd(); };
  s.onended = finish;
  s.start();
  const data = new Float32Array(an.fftSize);
  return {
    stop() { try { s.stop(); } catch { /* ended */ } finish(); },
    level() { an.getFloatTimeDomainData(data); let e = 0; for (const v of data) e += v * v; return Math.sqrt(e / data.length); }
  };
}
