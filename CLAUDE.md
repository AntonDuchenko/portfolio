# Tavern Portfolio

Cinematic 3D entry into a developer portfolio. Night forest path → tavern door opens →
camera flies to a WANTED poster on a wooden post → poster becomes the resume page.

## Current state

`docs/prototype/tavern-scene.html` is the **behavioural spec**, not the codebase.
Single file, three.js r128 UMD, all geometry is primitives, audio inlined as base64.
It works and the direction is approved — timing, camera, audio mix and transitions are final.
Geometry is placeholder and gets replaced by real assets.

Detailed numbers and reasoning: `docs/scene-spec.md`. Read it before touching the scene.

The port lives in `src/` (Vite + TypeScript, three 0.186, ES modules): `npm install`,
`npm run dev`, `npm run build` (typecheck + bundle), `npm run lint`, `npm run typecheck`
(app + tests), `npm test` (after a build), `npm run assets` (rebuild models).

Repository:

- `src/` — the app (below). `public/` — only files the page loads (models, audio, CV, icons).
- `assets-src/` — raw sources, committed but never shipped: `kits/` (Quaternius glTF
  exports incl. `Character/`), `audio/` (original freesound recordings). See its README.
- `scripts/` — build tools (`assets/`, `voice/`). `docs/` — spec, prototype, voice script.

`src/` layout:

- `scene/` — `stage` (renderer, scene, fog), `lights` (global lights, flickering fires,
  legacy → physical conversion), `assets` (kit loading, cloning, instancing),
  `kitbox` (boxes wearing kit materials), `terrain`, `forest`, `ground` (path dressing), `tavern` (facade + hall), `post`.
- `camera/` — `timeline` (walk → hold → open → fly → done), `easing`. The timeline only
  moves the camera and advances phases; what a phase does to the page, sound and door is
  wired in `app.ts` (`TimelineHooks`). Keep DOM and audio out of it.
- `portal/` — DOM projection of the poster, door mask, resume crossfade.
- `audio/` — `engine` (context, master/mute, bed bus + ducking, one-shots, voice),
  `scene` (typed sound names, loading, beds, positional sources, script events, walk
  narration), `narration` (the site innkeeper).
- `ui/` — DOM refs, voice lines, tune panel (dev only, or `?debug` in a build).
- `state.ts` — the run state; `resetRun()` is the one place a replay resets it.
- `random.ts` — the scene's own seeded generators; `?seed=<n>` pins them. `random`/`rand`/
  `side` for placement, `jitter` for per-frame variation (flicker, sounds) so frame count
  cannot move the layout. Never use `Math.random` for layout or variation: three.js draws from it for
  every object's uuid, so the forest moved whenever the code created more objects.
- `loaders/gltf.ts` — `GLTFLoader` with meshopt (no Draco: nothing uses it, 1.3 MB of wasm).
- `scripts/assets/build.mjs` — packs the kits into `public/models/{forest,village,props}.glb`
  (one file per kit, models as named root nodes): simplification to budget, 1K WebP
  textures, meshopt. Fails the build if a budget is exceeded. Writes `manifest.json`
  (tris + bounds per model) — use it for placement numbers.
- `scripts/voice/` — synthesises the narration placeholder (Kokoro, offline) into
  `public/audio/voice/line<i>.mp3` from `src/ui/voice-lines.json`. Own `package.json`, so
  CI never installs the native addon or the model: `cd scripts/voice && npm i && npm run generate`.
- `.github/workflows/deploy.yml` — every push to `main` or `claude/**` builds, runs the smoke
  test and publishes `dist/` to the `gh-pages` branch (GitHub Pages, Source: Deploy from a
  branch → gh-pages). A failing test stops the deploy (report uploaded as an artifact).
- `tests/` — Playwright smoke test (`npm test`, after `npm run build`; runs `vite preview`):
  gate, scene → page with the virtual clock (`helpers.ts`), no-WebGL fallback, linked files.
- `main.ts` is a tiny bootstrap: checks WebGL2, then lazy-loads `app.ts` (the scene and
  three.js). Without WebGL2 the site is shown directly (`ui/fallback.ts`).
- `quality.ts` — tier `low` (touch + small screen, or ≤ 4 GB / ≤ 4 cores) or `high`;
  override `?quality=low|high`. Low: pixel ratio 1, no MSAA, half forest and mist,
  `public/models/low/` (512 textures, no normal maps — built by `npm run assets`).
- `scene/merge.ts` — static batching: building and props merged per material after build
  (door leaves, sprites, the sign and mirrored meshes excluded).
- `scene/spriteBatch.ts` — glow sprites (flames, candles, mist, smoke) drawn as one instanced
  quad per texture/blending; the `Sprite`s stay as invisible proxies (layer 31) that the
  rest of the code moves and flickers. Walk 86 → 47 draw calls, hall 37 → 31.
- FPS guard (`app.ts`): below 28 fps in 2 s windows lowers the pixel ratio (−25 %/step,
  floor 0.5); below 12 fps at the floor lands on the site. `?noguard` for tests.
- Dev only: `window.__tavern` exposes scene/camera/renderer/state for numeric checks.
- Transition cost. Measured on a phone (a temporary `?perf` frame-time overlay, since removed): the fade ran at 8 fps (everything else
  53–60). Reproduced in the container with xvfb + real time + CPU ×4 (screenshot-driven
  traces mislead: each screenshot repaints the whole document). Bisection: hiding the page
  changed nothing, hiding the poster 5 → 19 fps — the sheet, scaled past the screen, was
  re-rastered every frame (no single property: shadow, clip-path, background all equal).
  Fix: `#pane.settled` (`will-change: transform`) from the moment it covers the screen —
  rastered once, scaled by the compositor; fade 5 → 14 fps. Only from cover: set during
  the approach it rasters at a tiny scale and turns visibly soft. Also: `#site` is its own
  layer during the scene, the hero name inks without blur, 3D frames are skipped while
  the poster covers the screen. Second phone run: fade 8 → 47 fps, ratio stays 1.00.
  Then: the page stays at an invisible opacity .002 from the door on (rastered during
  the flight, not on the first fade frame); the avatar compiles its shaders with
  `compileAsync` and mounts ~1.5 s after landing (was a 0.3 s frame on the phone).
- All user-facing content is in English (any audience).
- Sound toggle (`ui/sound.ts`): in the site nav only, when the visitor entered with sound;
  `M` toggles (site only); remembered in localStorage. Mutes the whole mix via the
  listener gain — but only on the site (`setOnSite`): the scene always plays with sound,
  also after a reload or "Back to the tavern" (Skip is the way out of the scene).

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
  Pin the layout with `?seed=1` (the smoke test does). Compare frames against a build of
  the previous commit, never against numbers from an older session (narration length
  moves the walk). A Python `http.server` keeps serving its directory — rebuild in place.
- **Lint:** ESLint 9 + typescript-eslint (type-aware) + `@stylistic` pinned to the house
  style (single quotes, semicolons, 2-space indent); no Prettier — it would reflow the
  compact scene code. Runs in CI before the build; `npm run lint -- --fix` for style.

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
   textures 1K; building on the kit grid). Path dressed with kit stones, pebbles and grass
   (`scene/ground.ts`, 4 draw calls, ~50k tris on the low tier); the ground itself is flat colour.
3. ~~Voiceover + timeline inversion~~ (done: narration length sets the walk; placeholder TTS voice).
4. ~~Mobile/perf~~ (done: draw calls walk 356 → 86, hall 167 → 37; low tier 278k tris
   and ¼ texture memory; FPS guard; no-WebGL fallback; sprites instanced). Not measured on
   a real phone — check FPS on a device.
5. ~~The site behind the poster~~ (done: content from the CV + tavern-themed UI).
   Markup in `index.html` `#site`, styles `src/site/site.css`, behaviour `src/site/site.ts`
   (loaded by the bootstrap, so it also runs without WebGL). The hero is the poster
   unfolded (same parchment → near-seamless crossfade; the name inks in via `inkHero()`
   when the page takes over). Chapters: Tale, Quest Board, Journeys, Armoury, Guild
   Records, Send a Raven. Motion is native CSS scroll timelines with an
   IntersectionObserver fallback (`html.no-sda`); transform/opacity/filter only;
   `prefers-reduced-motion` turns it all off. Section ids are hooks for the narrator.
6. ~~Avatar narrating site sections~~ (done).
   `src/site/narrator.ts`: the innkeeper (third person, voice `bm_lewis`, lines in
   `src/site/narration.json` → `public/audio/narrator/<chapter>.mp3`) speaks when a chapter
   crosses the middle of the screen, once per visit; a newer chapter interrupts; a click
   on him skips. Beds duck to ⅓ while he talks. Without audio: bubbles only.
   `src/site/avatar.ts`: `Viking_Male` from `assets-src/kits/Character/` (Ultimate Animated Character Pack,
   CC0) packed as `public/models/narrator.glb` (Idle only, 6.3k tris). The pack faces +Z
   and has no facial rig: speech is head nods / torso sway / right-hand gesture driven by
   the voice RMS, layered on Idle; the neck follows the pointer; a nod greets on the intro.
   Offsets are removed before each mixer update — Idle does not rewrite every bone, and
   additive offsets on those bones accumulated until the head left the portrait.
   Swap the character: `CHARACTER.src` in `scripts/assets/build.mjs`, then `npm run assets`.
   Loading is kept off the landing frames: the glb and the lines are fetched and decoded
   4 s into the walk (`preloadNarrator`), the avatar's renderer is created on idle after
   landing. Lines to record for a real voice: `docs/voice-script.md`.

## Open decisions

- Tone of copy: poster text is a placeholder.
- Scene in vanilla three vs React Three Fiber; site framework.
- Debug panel (sliders, layer toggles) must be hidden in production — done: dev only or `?debug`.
