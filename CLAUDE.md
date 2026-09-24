# Tavern Portfolio

Cinematic 3D entry into a developer portfolio. Night forest path → tavern door opens →
camera flies to a WANTED poster on a wooden post → poster becomes the resume page.

## Current state

`prototype/tavern-scene.html` is the **behavioural spec**, not the codebase.
Single file, three.js r128 UMD, all geometry is primitives, audio inlined as base64.
It works and the direction is approved — timing, camera, audio mix and transitions are final.
Geometry is placeholder and gets replaced by real assets.

Detailed numbers and reasoning: `docs/scene-spec.md`. Read it before touching the scene.

## First task

Port the prototype to a Vite + TypeScript project with modern three (ES modules)
**without changing behaviour**. Compare against the prototype side by side.

- Split by concern: `scene/` (terrain, forest, tavern, post), `camera/` (timeline, easing),
  `portal/` (DOM projection, door mask, crossfade), `audio/`, `ui/`.
- Audio comes from `public/audio/*.mp3`, not base64.
- three ≥ 0.155 uses physical light units: point-light intensities must be rescaled
  (roughly ×10 for our values). Verify visually against the prototype.
- Add `GLTFLoader` + Draco + Meshopt decoders — needed for the asset step.

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

1. Port (above).
2. Assets — Quaternius CC0 kits, one author for consistent style:
   Stylized Nature MegaKit (forest), Medieval Village MegaKit (building),
   Fantasy Props MegaKit (interior). Building dimensions follow the kit grid.
   Forest budget: ≤ 6 instanced draw calls, tree ≤ 1200 tris, rock ≤ 250, textures 1K.
3. Voiceover + timeline inversion: audio duration drives walk length, not the reverse.
4. Mobile/perf: FPS check, reduced instances, fallback straight to the site.
5. The site behind the poster (currently a stub).
6. Avatar narrating site sections (last, most expensive).

## Open decisions

- Tone of copy: poster text is a placeholder.
- Scene in vanilla three vs React Three Fiber; site framework.
- Debug panel (sliders, layer toggles) must be hidden in production.
