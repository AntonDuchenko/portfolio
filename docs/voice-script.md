# Voice script

The texts of the recorded lines. The walk is Anton's own voice, the innkeeper is ElevenLabs;
the source of truth for the wording is the JSON (the subtitles and bubbles read it) —
change the text there, then re-record that line.

Delivery: mono, any sample rate (the files are re-encoded to 24 kHz MP3), a little room
tone before and after. Timing adapts to the recording: the walk length is computed from
the durations of the walk lines, and the narrator waits for each line to finish.

## Walk — the narrator on the forest path

Source `src/ui/voice-lines.json` → `public/audio/voice/line<i>.mp3`. A stranger on the road,
talking to the visitor — the bounty hunter — about the wanted developer: low, knowing, a
little amused. ~1.6 s of footsteps between lines.

| File | Line |
|---|---|
| `line0.mp3` | Evening. You're out late — looking for someone, I'd wager. |
| `line1.mp3` | Word is there's a developer in these parts who takes every job all the way to production. |
| `line2.mp3` | Front end, back end, the database in between — he doesn't leave a task half-done. |
| `line3.mp3` | The tavern's just ahead. His notice is on the wall. Wanted alive, mind — he's more useful that way. |

## Site — the innkeeper

Source `src/site/narration.json` → `public/audio/narrator/<id>.mp3`. Third person, warm,
a bit of a storyteller. Each line plays once, when its chapter reaches the middle of the
screen; the music ducks while he speaks.

| File | Chapter | Line |
|---|---|---|
| `intro.mp3` | hero | So you're the one who's been asking about him. That's Anton Duchenko, full-stack developer. Pull up a stool — I'll tell you what I know. |
| `about.mp3` | The Tale | He likes to own a feature from end to end — from the data model to the last pixel. Used to be a ship's electro-technical officer, if you can believe it. |
| `work.mp3` | Quest Board | These are the quests he's taken. Releaf, where he works now. The Levels, a language-learning app with AI inside. And a phone store he built with his crew. |
| `experience.mp3` | Journeys | Three companies so far — Maxopen, Nitrix Soft, and now Binary Studio. At every stop he made things faster: pages, queries, delivery. |
| `skills.mp3` | Armoury | His weapons of choice: TypeScript, React and Node.js — a good deal of SQL, and a knack for putting AI to real work. |
| `education.mp3` | Guild Records | Learned his trade at Mate Academy. Before that, the maritime academy in Kherson. |
| `contact.mp3` | Send a Raven | Mean to claim the bounty? Send a raven — he answers quickly. |

ElevenLabs for the innkeeper: `cd scripts/voice && ELEVENLABS_API_KEY=… npm run elevenlabs` lists
the account's voices; add `ELEVENLABS_VOICE_ID=…` to voice all lines (or name chapters to
redo some: `npm run elevenlabs -- intro contact`). It overwrites `public/audio/narrator/`.

Replacing a file: drop the recording in place under the same name (MP3, mono). Positional
audio is not involved, but keep it mono anyway — the mix expects it.
