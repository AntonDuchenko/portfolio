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

// The recorded lines (ElevenLabs) come in at −18…−20 LUFS, ~8 dB above the synthesised
// ones the mix was balanced for, with peaks at −0.6 dBTP. −6.5 dB puts him level with the
// walk narration (~−24 LUFS) and keeps the peaks clear of clipping at full volume.
const INNKEEPER_TRIM = 10 ** (-6.5 / 20);

export function narrate(buf: AudioBuffer, onEnd: () => void) {
  const { s, g } = voice(buf);
  g.gain.value *= INNKEEPER_TRIM;
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
