// Voices the innkeeper's lines (src/site/narration.json) with ElevenLabs and writes
// public/audio/narrator/<chapter>.mp3 — the same files the Kokoro placeholder writes.
//
//   ELEVENLABS_API_KEY=… node elevenlabs.mjs                 list the voices on the account
//   ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… node elevenlabs.mjs [chapter …]
//
// No dependencies (Node 18+ fetch). Chapters default to all of them; name some to redo
// only those, e.g. `node elevenlabs.mjs intro contact`. The key is read from the
// environment only — never commit it.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'public/audio/narrator');
const API = 'https://api.elevenlabs.io/v1';
const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID;
const model = process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';

if (!key) { console.error('ELEVENLABS_API_KEY is not set'); process.exit(1); }
const headers = { 'xi-api-key': key, 'content-type': 'application/json' };

if (!voice) {
  // no voice chosen yet: show what the account has, pick one, run again
  const res = await fetch(`${API}/voices`, { headers });
  if (!res.ok) { console.error(`voices: HTTP ${res.status} ${await res.text()}`); process.exit(1); }
  const { voices } = await res.json();
  for (const v of voices) {
    const l = v.labels ?? {};
    console.log(`${v.voice_id}  ${v.name.padEnd(24)} ${[l.gender, l.accent, l.age, l.description ?? l.use_case].filter(Boolean).join(', ')}`);
  }
  console.log('\nSet ELEVENLABS_VOICE_ID to one of the ids above and run again.');
  process.exit(0);
}

const { lines } = JSON.parse(readFileSync(join(ROOT, 'src/site/narration.json'), 'utf8'));
const wanted = process.argv.slice(2);
const chapters = Object.entries(lines).filter(([id]) => !wanted.length || wanted.includes(id));
if (!chapters.length) { console.error(`no such chapter: ${wanted.join(', ')}`); process.exit(1); }

mkdirSync(OUT, { recursive: true });
for (const [id, text] of chapters) {
  const res = await fetch(`${API}/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST', headers,
    body: JSON.stringify({
      text, model_id: model,
      // a warm storyteller: some variation between lines, clear diction
      voice_settings: { stability: .45, similarity_boost: .8, style: .3, use_speaker_boost: true }
    })
  });
  if (!res.ok) { console.error(`${id}: HTTP ${res.status} ${await res.text()}`); process.exit(1); }
  const mp3 = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(OUT, `${id}.mp3`), mp3);
  console.log(`${`${id}.mp3`.padEnd(16)} ${(mp3.length / 1024).toFixed(0).padStart(4)} KB  ${text}`);
}
