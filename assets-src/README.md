# Source assets

Raw material the build is made from. Kept in the repo, never shipped: Vite only publishes
`public/` and what `src/` imports, so nothing here reaches `dist/`.

- `kits/` — Quaternius CC0 packs (glTF exports only, see `.gitignore`):
  Stylized Nature, Medieval Village, Fantasy Props, Ultimate Animated Character Pack.
  `npm run assets` (`scripts/assets/build.mjs`) packs them into `public/models/`.
- `audio/` — the original CC recordings from freesound.org (`<id>__<author>__<name>`).
  Edited and denoised copies live in `public/audio/`. The 144 MB forest field recording
  (`410357__felixblume__*`) is not committed; its processed loop is `public/audio/forest.mp3`.

The behavioural spec of the scene (the original prototype) is `docs/prototype/`.
