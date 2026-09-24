# Scene spec

All values below are taken from `prototype/tavern-scene.html` and are approved.
Units are metres and seconds. The camera travels along −Z; `d` = metres inside the tavern
past the facade, `D(d) = GATE_Z − d`.

## World layout

| What | Value |
|---|---|
| Facade plane | `GATE_Z = −132` |
| Door opening | 3.6 wide × 4.6 high, two leaves, open **inward** |
| Facade | 18.8 wide, 9 high, stone plinth 1.3 (cut around the door), timber frame above |
| Tavern hall | 16 wide × 20 deep × 5.6 high, whole group offset `y = −0.24` |
| Hall floor top | y = 0.06 (flush with outside ground at the threshold) |
| Threshold sill | dark wood, top at 0.06 |
| Ceiling beams | every 2.5 m (`TAV_LEN / 8`) |
| Post | at `d = 13`, 1.35 × 1.35, floor to ceiling |
| Poster | on the post's front face, centre y = 1.81, height 1.95, aspect 1 : 1.9 |
| Bar | back wall, counter at `d ≈ 17.4` |
| Hearth | left wall at `d = 7` |
| Hanging lanterns | `d = 5, 10, 15`, exactly on beams |
| Tables | 6 round tables along the walls, centre aisle kept clear |

Terrain: `terrainY(x, z)` is one global function. Flat for |x| < 2.2 (the path),
hills beyond (amplitude 1.1), flattens to 0 within 20 m of the facade and sinks up to
−1.8 m under the building. Trees and rocks sample the same function.

Forest is finite (route is 0 → GATE_Z), terrain is 3 static segments of 80 m.
No trees past `GATE_Z + 4`.

## Camera timeline

| Phase | Behaviour |
|---|---|
| `walk` | 2.3 m/s from z = 0 to `GATE_Z + 6` (~55 s). Head bob: vertical at 2× stride freq, lateral at 1×. |
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

Skip button: during `walk` jumps to the end of `hold`; later jumps straight to `done`.

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
- Prototype light values are r128 legacy units. The port keeps them as written and converts
  at the light (`src/scene/lights.ts`): ×π for ambient/hemisphere/directional, a fitted
  factor + decay per point light so the falloff follows the legacy `(1 − d/R)²` curve.

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

Entry requires a click (browser autoplay policy). The gate also hides decoding time.

## Known placeholders

- All geometry.
- Poster copy and the resume content.
- The tavern sign is a canvas texture with the word «ТАВЕРНА».
- Voice lines are timed to walked distance; must become driven by audio duration.
