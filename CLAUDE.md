# Tavern Portfolio

Cinematic 3D entry into a developer portfolio. Night forest path → tavern door opens →
camera flies to a WANTED poster on a wooden post → poster becomes the resume page.

## Current state

`prototype/tavern-scene.html` is the **behavioural spec**, not the codebase.
Single file, three.js r128 UMD, all geometry is primitives, audio inlined as base64.
It works and the direction is approved — timing, camera, audio mix and transitions are final.
Geometry is placeholder and gets replaced by real assets.

Detailed numbers and reasoning: `docs/scene-spec.md`. Read it before touching the scene.

The port lives in `src/` (Vite + TypeScript, three 0.186, ES modules): `npm install`,
`npm run dev`, `npm run build` (typecheck + bundle), `npm run assets` (rebuild models).
Layout:

- `scene/` — `stage` (renderer, scene, fog), `lights` (global lights, flickering fires,
  legacy → physical conversion), `assets` (kit loading, cloning, instancing),
  `kitbox` (boxes wearing kit materials), `terrain`, `forest`, `tavern` (facade + hall), `post`.
- `camera/` — `timeline` (walk → hold → open → fly → done), `easing`.
- `portal/` — DOM projection of the poster, door mask, resume crossfade.
- `audio/` — loading from `public/audio`, beds, positional sources, one-shots.
- `ui/` — DOM refs, voice lines, tune panel (dev only, or `?debug` in a build).
- `loaders/gltf.ts` — `GLTFLoader` with meshopt and Draco (decoder bundled by Vite).
- `scripts/assets/build.mjs` — packs the kits into `public/models/{forest,village,props}.glb`
  (one file per kit, models as named root nodes): simplification to budget, 1K WebP
  textures, meshopt. Fails the build if a budget is exceeded. Writes `manifest.json`
  (tris + bounds per model) — use it for placement numbers.
- `scripts/voice/` — synthesises the narration placeholder (Kokoro, offline) into
  `public/audio/voice/line<i>.mp3` from `src/ui/voice-lines.json`. Own `package.json`, so
  CI never installs the native addon or the model: `cd scripts/voice && npm i && npm run generate`.
- `.github/workflows/deploy.yml` — every push to `main` or `claude/**` builds and publishes
  `dist/` to the `gh-pages` branch (GitHub Pages, Source: Deploy from a branch → gh-pages).
- Dev only: `window.__tavern` exposes scene/camera/renderer/state for numeric checks.
- All user-facing content is in English (any audience).

Decisions (keep them unless the look is retuned on purpose):

- **Scale:** the building follows the Village kit grid 1:1 (chosen over scaling the kit
  up to the prototype's 3.6 × 4.6 door). Door 1.79 × 2.4, hall 6 × 14 × 6.24, post at
  `d = 10`. Timeline durations are unchanged; the flight is simply shorter in metres.
- **Colour:** sRGB pipeline (three defaults) — the kit textures need it. The prototype's
  hex values were linear numbers; light colours keep those linear values (`legacyColor`),
  ground/path are ×3, forest materials get a cold night tint (the kit is painted for day).
- **Light units:** intensities are written in prototype (legacy) units. Ambient/hemisphere/
  directional ×π (exact). Point lights (`RescaledPointLight`) are physical 1/d² and match
  the prototype at a reference distance `dRef`. The prototype's nearly flat falloff lit
  the textured walls evenly and read as daylight.
- **Tests:** swiftshader in the cloud container needs ~1–3 s per frame; drive the timeline
  with a virtual clock (replace `performance.now`/`requestAnimationFrame`, 50 ms steps —
  the `dt` clamp) rather than Playwright's clock, which can run `performance.now` backwards.

## Hard rules (each one cost a debugging round)

1. **No coplanar surfaces.** Two surfaces closer than ~5 cm z-fight and read as a hole.
   The path ends 1 m before the facade; terrain sinks under the building.
2. **Every opening is cut through every layer.** The facade plinth once ran across the
   doorway as a 1.3 m stone wall — looked like a pit. Check openings numerically.
3. **Hanging objects must physically touch their support.** Verify chain/bracket/body
   extents with numbers, not by eye.
4. **Door mask uses real free-edge coordinates.** Doors open inward; the free edge moves
   deeper, so a door-plane formula lets the poster bleed over the leaves.
5. **Resume is a separate fixed layer**, never inside the scaled pane. The poster is
   portrait (1:1.9); the camera flies until it covers the viewport
   (`coverSc = 1.9 · aspect`), and the resume fades in only after full coverage.
6. **Positional audio must be mono.** Stereo buffers don't pan in `PositionalAudio`.
7. **Audio never blocks entry.** Decode with timeout + catch; enter without sound on failure.
8. **Declare before use.** A `let` referenced by earlier UI code threw a TDZ error and
   silently killed init. A global error handler prints init errors onto the enter button.
9. **Don't layer noisy loops.** Stacking copies stacks hiss. Denoise first.

## Next, in order

1. ~~Port (above).~~
2. ~~Assets — Quaternius CC0 kits~~ (done: forest 6 draw calls, tree ≤ 1200, rock ≤ 250,
   textures 1K; building on the kit grid). Open: ground/path are still flat colour.
3. ~~Voiceover + timeline inversion~~ (done: narration length sets the walk; placeholder TTS voice).
4. Mobile/perf: FPS check, reduced instances, fallback straight to the site.
   Now: ~356 draw calls / 466k tris on the walk, 167 in the hall. Easy win: merge the
   static village modules and props per material.
5. The site behind the poster (currently a stub).
6. Avatar narrating site sections (last, most expensive).

## Open decisions

- Tone of copy: poster text is a placeholder.
- Scene in vanilla three vs React Three Fiber; site framework.
- Debug panel (sliders, layer toggles) must be hidden in production — done: dev only or `?debug`.
