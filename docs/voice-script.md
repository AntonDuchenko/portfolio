# Voice script

Lines to record. Today they are synthesised placeholders (`scripts/voice/generate.mjs`);
the source of truth is the JSON — change the text there, then record.

Delivery: mono, any sample rate (the files are re-encoded to 24 kHz MP3), a little room
tone before and after. Timing adapts to the recording: the walk length is computed from
the durations of the walk lines, and the narrator waits for each line to finish.

## Walk — the narrator on the forest path

Source `src/ui/voice-lines.json` → `public/audio/voice/line<i>.mp3`. First person, calm,
unhurried; there are ~1.6 s of footsteps between lines.

| File | Line |
|---|---|
| `line0.mp3` | Evening, traveller. Mind the roots — the path is longer than it looks. |
| `line1.mp3` | My name is Anton. I build things for the web, from the database up to the last pixel. |
| `line2.mp3` | These days it's TypeScript, Node and React — and a habit of seeing work through to production. |
| `line3.mp3` | The tavern is just ahead. My notice is pinned up inside. |

## Site — the innkeeper

Source `src/site/narration.json` → `public/audio/narrator/<id>.mp3`. Third person, warm,
a bit of a storyteller. Each line plays once, when its chapter reaches the middle of the
screen; the music ducks while he speaks.

| File | Chapter | Line |
|---|---|---|
| `intro.mp3` | hero | Ah — you found his notice. That's Anton Duchenko, full-stack developer. Pull up a stool, I'll tell you what I know. |
| `about.mp3` | The Tale | He likes to own a feature from end to end — from the data model to the last pixel. Used to be a ship's electro-technical officer, if you can believe it. |
| `work.mp3` | Quest Board | These are the quests he's taken. Releaf, where he works now. The Levels, a language-learning app with AI inside. And a phone store he built with his crew. |
| `experience.mp3` | Journeys | Three companies so far — Maxopen, Nitrix Soft, and now Binary Studio. At every stop he made things faster: pages, queries, delivery. |
| `skills.mp3` | Armoury | His armoury: TypeScript, React and Node.js, a good deal of SQL, and a knack for plugging AI into real products. |
| `education.mp3` | Guild Records | Learned his trade at Mate Academy. Before that, the maritime academy in Kherson. |
| `contact.mp3` | Send a Raven | Got a quest for him? Send a raven. He answers quickly. |

Replacing a file: drop the recording in place under the same name (MP3, mono). Positional
audio is not involved, but keep it mono anyway — the mix expects it.
