// Synthesises the walk narration (src/ui/voice-lines.json → public/audio/voice/line<i>.mp3)
// and the site narrator (src/site/narration.json → public/audio/narrator/<chapter>.mp3)
// (mono MP3, 24 kHz, 64 kbps). Placeholder voice until a real recording exists.
//
//   cd scripts/voice && npm install && npm run generate
//
// Model: Kokoro-82M int8, English, Apache-2.0. Hugging Face is often unreachable from CI or
// sandboxes, so the model is taken from an npm package that bundles it (n8n-nodes-ttsbro)
// and cached in scripts/voice/.cache. Speakers: 0 af, 1 af_bella, 2 af_nicole, 3 af_sarah,
// 4 af_sky, 5 am_adam, 6 am_michael, 7 bf_emma, 8 bf_isabella, 9 bm_george, 10 bm_lewis.

import lamejs from '@breezystack/lamejs';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sherpa from 'sherpa-onnx-node';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const CACHE = join(HERE, '.cache');
const MODEL = join(CACHE, 'package/kokoro-int8-en-v0_19');
const OUT = join(ROOT, 'public/audio/voice');
const PKG = 'n8n-nodes-ttsbro@0.1.6';

if (!existsSync(join(MODEL, 'model.int8.onnx'))) {
  mkdirSync(CACHE, { recursive: true });
  console.log(`fetching the Kokoro model from npm (${PKG}, ~50 MB download)…`);
  const tgz = execSync(`npm pack ${PKG} --silent`, { cwd: CACHE }).toString().trim().split('\n').pop();
  execSync(`tar xzf ${tgz} package/kokoro-int8-en-v0_19`, { cwd: CACHE });
}

const { voice, lines } = JSON.parse(readFileSync(join(ROOT, 'src/ui/voice-lines.json'), 'utf8'));
const tts = new sherpa.OfflineTts({
  model: {
    kokoro: {
      model: join(MODEL, 'model.int8.onnx'), voices: join(MODEL, 'voices.bin'),
      tokens: join(MODEL, 'tokens.txt'), dataDir: join(MODEL, 'espeak-ng-data')
    },
    numThreads: 4
  }
});

function mp3(samples, rate) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 32767;
  const enc = new lamejs.Mp3Encoder(1, rate, 64), parts = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b));
  }
  parts.push(Buffer.from(enc.flush()));
  return Buffer.concat(parts);
}

function synth(dir, file, text, v) {
  const a = tts.generate({ text, sid: v.speaker, speed: v.speed });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), mp3(a.samples, a.sampleRate));
  console.log(`${file.padEnd(16)} ${(a.samples.length / a.sampleRate).toFixed(2)} s  ${text}`);
}

// the walk: Anton, first person
lines.forEach((text, i) => synth(OUT, `line${i}.mp3`, text, voice));

// the site: the innkeeper narrates each chapter (src/site/narration.json)
const narration = JSON.parse(readFileSync(join(ROOT, 'src/site/narration.json'), 'utf8'));
for (const [id, text] of Object.entries(narration.lines))
  synth(join(ROOT, 'public/audio/narrator'), `${id}.mp3`, text, narration.voice);
