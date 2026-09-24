# Scene spec

Timing, camera, audio and transitions are from `prototype/tavern-scene.html` and are
approved. The world layout below is the **asset version**: the building was rebuilt from
the Medieval Village kit at real scale (1:1, 2 m grid), so it is smaller than the
prototype's. Units are metres and seconds. The camera travels along −Z; `d` = metres
inside the tavern past the facade, `D(d) = GATE_Z − d`.

## World layout

| What | Value | Prototype |
|---|---|---|
| Facade plane | `GATE_Z = −132` (outside face of the wall) | same |
| Wall modules | 2 m wide, 3.12 per storey, solid from z 0 (outside) to −0.2 (inside) | — |
| Door opening | 1.79 wide × 2.4 high between kit posts, two leaves, open **inward**, hinges mid-wall (−0.1) | 3.6 × 4.6 |
| Facade | 3 modules = 6 wide, 2 storeys + gable; stone ground floor, plaster above | 18.8 × 9 |
| Tavern hall | 6 wide × 14 deep × 6.24 high (open to the roof), one `Roof_RoundTiles_6x14` | 16 × 20 × 5.6 |
| Hall floor top | y = 0.06 (flush with the sill); floor starts at the inside face | same |
| Threshold sill | dark wood, top at 0.06 | same |
| Tie beams | every 2 m (`d = 2 … 12`) at y 4.6, ends 0.2 m inside the side walls | ceiling beams every 2.5 |
| Post | at `d = 10`, 1.1 × 1.1, floor to the tie beam | `d = 13`, 1.35 |
| Poster | on the post's front face, centre y = 1.81, height 1.95, aspect 1 : 1.9 | same |
| Bar | cabinets across the back at `d = 12.2`, bottle shelves on the back wall | `d ≈ 17.4` |
| Hearth | left wall at `d = 6`, under the chimney | `d = 7` |
| Chandeliers | `d = 4, 8`, chain end 1 cm into the tie beam | lanterns `d = 5, 10, 15` |
| Tables | 4 long tables along the walls with benches, aisle `|x| < 0.83` clear | 6 round |

Kit placement numbers (bounds, tris) are in `scripts/assets/manifest.json`.
The chosen models and their budgets are listed in `scripts/assets/build.mjs`.

Terrain: `terrainY(x, z)` is one global function. Flat for |x| < 2.2 (the path),
hills beyond (amplitude 1.1), flattens to 0 within 20 m of the facade and sinks up to
−1.8 m under the building. Trees and rocks sample the same function.

Forest is finite (route is 0 → GATE_Z), terrain is 3 static segments of 80 m.
No trees past `GATE_Z + 4`. Nature kit: `Pine_5`, `Pine_2`, `DeadTree_3`, `Rock_Medium_2`,
simplified to ≤ 1200 / ≤ 250 tris, 6 instanced draw calls in total. Pines stand at least
their crown reach + 1.2 m from the camera line, so branches never cross the path.

## Camera timeline

| Phase | Behaviour |
|---|---|
| `walk` | 2.3 m/s ending at `STOP_AT = GATE_Z + 6`. **Length is set by the narration**: walk time = 2 s lead-in + lines with 1.6 s gaps + 5 s tail (≈ 32 s, ≈ 74 m with the current lines); the start is `STOP_AT + 2.3 · time`. Head bob: vertical at 2× stride freq, lateral at 1×. |
| `hold` | 1.3 s. Bob fades out in 0.6 s, slight upward look (pitch 0.04). |
| `open` | Leaves rotate to 1.75 rad over 3.6 s (cubic ease). `fly` starts at 55 %. |
| `fly` | 4.2 s. Ends at `POSTER_Z + fitDist / endSc`. Camera y rises from eye (1.62) to poster centre. |
| `done` | Scene hidden, resume layer becomes normal page flow. |

Fly easing — short ramp then long deceleration:

```
RAMP = 0.2, DECEL = 3.2
s = x < RAMP ? x² / (2·RAMP) : x − RAMP/2
e = 1 − (1 − min(1, s / (1 − RAMP/2)))^DECEL
```

Half the distance in the first quarter of the time; the last centimetres (where the
resume fades in) take roughly the last quarter.

Skip button: during `walk` jumps to the end of `hold` (and silences the narrator); later jumps straight to `done`.

Narration (`src/ui/voice.ts`, text in `src/ui/voice-lines.json`): each line starts its
voice file and subtitle together; the subtitle stays 1.2 s after the line ends. Without
audio, line lengths are estimated at 2.6 words/s so the pacing still holds.

## Portal

The poster and the resume are DOM, not textures.

- A world-space rectangle (poster height `SHEET_H` at `POSTER_Z`) is projected every frame;
  the pane gets `translate + scale` so it matches the projection.
- While the camera is in front of the facade, the portal is clipped to the gap between the
  leaves. Gap edges come from the leaves' real free-edge positions:
  `x = ±(W/2)(1 − cos α)`, `z = GATE_Z − (W/2) sin α`, projected.
- `coverSc = max(1.9 · aspect, 1.06)` — screen-height fraction at which the portrait
  sheet covers the full viewport width. `endSc = coverSc × 1.42` — where the flight ends.
- Resume opacity = `easeInOut((sc − coverSc) / (endSc − coverSc))`.
- Near plane 0.15 because the camera ends ~0.4 m from the sheet on wide screens.

## Lighting and atmosphere

- Outside: moon (directional `#8aa4e0`, 1.5), hemisphere, cold ambient.
  Fog `FogExp2 #0d1626`, density 0.028.
- A variable `inside` (0 → 1) drives the transition as the doors open and the camera enters:
  fog → `#1a1209` at 0.005, moon down 85 %, warm ambient up, tavern fires up,
  street lanterns and mist out.
- Torch is carried at camera-space `(−0.34, +0.34, −1.15)`. On `fly` it detaches and
  stays at the threshold.
- Prototype light values are r128 legacy units. The code keeps them as written and converts
  at the light (`src/scene/lights.ts`): ×π for ambient/hemisphere/directional; point lights
  are physical (1/d²) and match the prototype's brightness at a reference distance `dRef`
  (lanterns 1.5 m, hearth 2, chandeliers 1.6, torch 2).
- Checked against prototype frames (mean luminance, 0–255): forest 43 vs 42, ground 58 vs
  55, path 108 vs 104, at the door 76 vs 81; the hall reads ~87–101 vs ~70–80.

## Audio

All files in `public/audio`, MP3. Everything positional is mono.

| File | Role | Mix |
|---|---|---|
| `forest.mp3` (stereo, 35 s loop) | Night bed | gain 0.55·(1−inside), lowpass 3.5 kHz — source is a tropical recording, the cut removes insects |
| — | Wind | Synthesised pink noise, bandpass 380 Hz Q 0.55, LFO 0.06 Hz ±230 Hz, gain 0.06·gust·(1−inside) |
| `music.mp3` (stereo, 5.3 s loop) | Tavern music | audible from 48 m, lowpass 380 Hz → 14 kHz (exponential) as doors open |
| `fire.mp3` (mono, 6 s loop) | Torch | positional, ref 1.1, rolloff 1.7, vol 0.8 — denoised, do not re-layer raw copies |
| `fire.mp3` | Hearth | positional, playback 0.72, ref 3.2, rolloff 1.1, vol 1.4·inside |
| `step0–5.mp3` | Footsteps | one per `floor(stride / π)`, never the same twice in a row, rate 0.92–1.08, gain 0.5–0.75, pan ±0.2 alternating |
| `owl0–2.mp3` | Distant owls | 3 per walk, first at 9 s then every 13–22 s, gain 0.32, pan ±0.7, lowpass 2.2 kHz |
| `sign0–2.mp3` | Tavern sign creak | positional at the sign, every 3.5–8 s while outside |
| `door.mp3` | Latch + creak | positional at the door, on `open` start |
| `whoosh.mp3` | Fly accent | on `fly` start, delayed 0.55 s (its peak at 0.48 s meets max camera speed ~1 s in) |
| `paper.mp3` | Entering the poster | once, when the sheet covers the viewport |
| `voice/line<i>.mp3` (mono, 24 kHz) | Narration | dry, centred, gain 1.1; one line at a time. Placeholder synthesised with Kokoro (`scripts/voice`) |

Entry requires a click (browser autoplay policy). The gate also hides decoding time.

## Known placeholders

- Ground and path are still procedural flat-colour meshes (no kit ground tiles).
- Custom boxes wearing kit materials (`src/scene/kitbox.ts`): door lintel filler, sill,
  notice post, hearth, bar top. The kits have no fireplace or notice board.
- Poster copy. (The resume content behind it is real, from the CV.)
- The tavern sign is a canvas texture with the word «ТАВЕРНА».
- Narration is a synthesised placeholder (Kokoro `bm_george`); copy and voice are placeholders.
- Owls: first at 9 s, then every 13–22 s — with the ~32 s walk only two of the three play.
