# Seasons and holidays

The scene follows the visitor's calendar: a look per season, and over it a holiday look
that starts a week before the holiday. The scene comes first (the walk outside shows it
best); the site's look and content follow later if the scene works out. Every theme gets
its own sound too — full immersion is the point.

Code: `src/theme/calendar.ts` (pure: date → season, holiday, April 1), `src/theme/theme.ts`
(this visit's theme, the overrides, `data-season` / `data-holiday` / `data-fools` on
`<html>`), `src/theme/themes.ts` (what each theme brings — the scene and the sound read
it there, never the date). Tests: `tests/calendar.spec.ts` (no browser) and the override
check in `tests/smoke.spec.ts`. PostHog gets `season`, `holiday`, `fools` as properties.

## Calendar

The visitor's local date. Windows include both ends.

| Theme | When |
|---|---|
| Winter | December – February |
| Spring | March – May |
| Summer | June – August |
| Autumn | September – November |
| Christmas and New Year (`xmas`) | 18 December – 6 January (Christmas on 25 December, as Ukraine keeps it since 2023 too; to Epiphany, the end of the Christmas season in most of the world) |
| Valentine's Day | 7–14 February |
| April Fools' | 1 April only, a joke laid over any theme (a week of it would wear the joke out; before the day it makes no sense) |
| Easter (`easter`) | both Easters, see below |
| Midsummer / Kupala night (`midsummer`) | 17–24 June (Kupala on 24 June after the calendar change, as in the rest of Europe) |
| Halloween | 24 October – 2 November (with All Saints' and the Day of the Dead) |

International holidays only — the ones people celebrate everywhere. Not taken: national
public holidays, St Patrick's (dropped), Lunar New Year (an Asian theme does not suit a
medieval tavern), Thanksgiving (US/Canada only).

**Easter.** Western and Orthodox Easter are both Sundays; the Orthodox one is the same
day or 1, 4 or 5 weeks later. Rule: the same day → the week before it; a week apart → one
window from the week before the earlier to the later (two weeks, each Easter gets its
week); four or five weeks apart → a week before each.

| Year | Western | Orthodox | Window(s) |
|---|---|---|---|
| 2027 | 28 March | 2 May | 21–28 March, 25 April – 2 May |
| 2028 | 16 April | 16 April | 9–16 April |
| 2029 | 1 April | 8 April | 25 March – 8 April (and April Fools' on Easter Sunday) |
| 2030 | 21 April | 28 April | 14–28 April |

A holiday lies over its season (winter + xmas, autumn + halloween). Windows do not
overlap with this list; if one ever did, the nearer holiday would win.

**Previews and tests:** `?date=2026-12-24` (as if it were that day), `?season=winter`,
`?holiday=xmas|none`, `?fools=1|0`.

## Done

**Autumn** (`claude/theme-autumn`): broadleaf trees among the pines (`CommonTree_3` and
`_5`, bark cut to 520 tris, leaves whole — cut, they fused into sheets; 24 + 5 of each on
the high tier), each crown in one of five leaf colours (instance colour on the foliage
material, lit from above like the bushes); rust bushes; ferns and grass repainted bracken
and straw (`recolor`: the texture's brightness × a colour); fallen leaves painted by the
terrain shader (three turned and scaled grids of pointed leaf shapes, in drifts, thin on
the track, none in the ruts — no draw call); falling leaves in a band around the camera
(`scene/leaves.ts`, one draw call). Sound: wind ×1.3 and a 40 s loop of wind in dry
leaves (freesound 457318 by Stek59, CC0; cut below 250 Hz, seam crossfaded, −30 LUFS).
Cost: 66 draw calls walking (summer 61), 842k tris high / 496k low (summer 723k / 420k).
The broadleaf models sit in `forest.glb` (+125 KB) for every visitor — they are meant to be
reused by spring and summer.

**Winter** (`claude/theme-winter`): snow on whatever faces up (`scene/snow.ts`: a shader
addition on the night-tinted forest materials, the foliage and the roof tiles — white from
a 60° slope up, roofs from 78°, as their tiles are stepped; the hall's materials never get
it), a snow blanket in the terrain shader with thin patches and a trodden track whose ruts
cut through to the mud, falling snowflakes (the falling-leaves module, `fall: 'snow'`),
a colder and lighter mist. Left out: ferns, mushrooms, flowers (bushes and window boxes),
fireflies. Sound: the forest bed's insects down to 35 %, wind ×1.2 and a 40 s loop of a
storm in the pines (freesound 505999 by DBlover, CC0; its steadiest stretch, 240–283 s,
−26.7 LUFS), footsteps in snow (freesound 611277 by xkeril, CC0; six steps cut at their
onsets, levelled to the gravel ones' RMS) in `public/audio/snow/`. Cost: 55 draw calls,
684k tris high / 407k low (less than summer: no ferns, flowers or fireflies). Summer
frames are pixel-identical to before.

**Christmas and New Year** (`claude/theme-xmas`, over winter; `scene/xmas.ts`): a string of
coloured bulbs under the jetty deck (hung at x ±3.15, ±2.05, ±1, 0 — it passes the lantern
posts at its hanging points, above their arms), a wreath with berries and a bow on the
upper storey, a decorated pine in the left yard (`pine_b` at 4.5 m, 46 bulbs on a golden-
angle spiral over the measured crown, a star 8 cm into the tip); the undergrowth keeps 3 m
clear round it. Bulbs: one instanced mesh; their glows one instanced mesh of camera-facing
additive quads coloured per bulb, twinkling; the wire one line. No draw from the layout's
random stream. Sound: a distant church peal (freesound 244517 by Cheeseheadburger, CC0;
40 s seamless loop, −28 LUFS) over the winter storm. Cost: 63 draw calls, 691k / 413k.

**Polish** (`claude/theme-polish`, over the three above), from a frame-by-frame review:

- Fixes. The falling band follows the camera into the hall: snow and leaves drifted between
  the tables during the flight — nothing falls under a roof now (`leaves.ts`, the hall and
  the wing). A flake that passed by the lens was a bright orb filling a corner: anything
  closer than 1.4 m shrinks away.
- Light, every season. The lit windows are unlit panes, so the ground in front of the
  house got nothing from them and on snow it stood on an even blue-white. Their light is
  painted by the terrain shader (`windowLight`: a pool in front of each window, widening
  as it goes out) as emission in proportion to the ground's own colour — faint on the dark
  earth, warm on snow; the open door pours the hall's light out with its angle
  (`doorSpill`). No light source: every light is paid for by every pixel.
- Winter. The tall grass stood out of the snow as black spikes: it is bleached straw now,
  lit from above like the bushes. Snow on what stands outside — barrels, the crate, the
  cart, the sign, the upper sills: the facade's kit materials are the hall's too, so
  `snowy(m, from, outdoors)` also reads the world position (none inside the hall, none
  under the jetty to 20 cm past its edge). Fir sprigs in the window boxes where the flowers
  were (an empty box read as a missing prop), chimney smoke ×1.7, and a soft dark band
  behind the subtitles (white on snow they faded).
- Winter, warm points on the walk (`scene/waylights.ts`): with the fireflies gone the walk had
  nothing warm between the torch and the windows. Seven lantern posts along it, ~10 m apart
  on alternating sides, 2.6 m off the path's centre (at 2 m they swept past the frame's edge,
  blazing in the torchlight): the kit's wall lantern on a tall post, its arm towards the
  walker, the glass lit, a flame and a halo in the mist, a warm pool on the snow (the
  terrain's `addGroundLight`, also the yard tree's glow). Laid in the facade's group: they
  merge into its batch, no draw call of their own; pebbles, rocks and grass keep clear of
  them (which reshuffles winter's random layout, as the yard tree did). Christmas ties a bow
  on every post.
- Christmas, models (`scene/evergreen.ts`): a fir sprig is two crossed cards of a branch
  painted on a canvas, alpha-cut and lit from above; berries, bows and parcels are one
  vertex-coloured material — so a whole set of decorations merges into two draw calls.
  The wreath is four rings of sprigs (the torus read as a plastic ring), the garland a fir
  rope with a bow at each hanging point (the bare wire was a 1 px line), the yard tree's
  bulbs sit on its needles (a ray from outside finds the crown; on a cone round the trunk a
  third hung between the tiers), a five-pointed star, parcels under the lowest boughs.
  Inside (`decor.hall`): a garland along the mantel, a wreath on the chimney breast, a 2 m
  tree by the bar with parcels — their own group, out of the hall's batch and hidden until
  the door opens (drawn behind the facade all the walk they cost five calls for nothing).
- Autumn. The broadleaf colours lead with orange and gold: the deep reds turned mauve in
  the blue mist and the crowns read as cherry blossom. `recolor` is the texture's value
  (its brightest channel) × the colour *in place of* the night tint, lit from above —
  multiplied by the tint as well, the bracken and the straw were black. Chrysanthemums for
  the violet flowers. The harvest (`scene/harvest.ts`): a barrel of apples among the yard's
  barrels, crates of apples and carrots stacked in front of them, on the corner crate and
  inside the door, each set on its support by rays down (Barrel_Apples, FarmCrate_Apple,
  FarmCrate_Carrot from the props kit, fruit cut to 500–700 tris: +78 KB to props.glb).

Cost (walking, high / low): Christmas 62 calls, 720k / 423k tris (hall 51 calls); winter
56–57; autumn 67, 846k (the fruit's vertex colours are a batch of their own); summer 61 as
before — its frames differ only by the window light on the ground.

**Scene pass** (same branch, every season unless named): from the review that followed.

- Night grade (`scene/grade.ts`): the Village and Props kits are painted for daylight, and
  by the lanterns the facade came out a saturated, evenly bright orange — a house pasted
  onto the night. Their materials lose a third of their saturation and darken to a cool
  grey outside; the materials are the hall's too, so the grade follows the visitor
  (1 − inside) and the room warms back to its own colours on the way in. The window boxes'
  plants are dimmed to match.
- Windows with curtains (`scene/windows.ts`): one shader for every pane (the glass meshes
  get 0…1 coordinates across the window): a warm room, brighter low, flickering; drapes
  from a pelmet, gathered by tie-backs, the light coming through the cloth; a window's
  colours and life come from a hash of its place on the grid — now and then someone walks
  past the gap.
- Contact shadows (`scene/shadows.ts`): no shadow maps (the moon's would draw the forest
  twice a frame and it lights from where the sky's moon is not), but a soft patch under
  every tree (following the recycled ones), snag, rock and boulder, the bushes (moved in
  from undergrowth.ts), lantern posts, the yard's props and cart, the foot of the walls,
  the hall's tables, benches, counter and barrels. One instanced mesh, one draw call (the
  bushes' own disc mesh is gone).
- Life: wind (`scene/wind.ts`) sways needles, leaves, bushes, ferns and grass, stronger
  towards the tips, its gusts on the same curve as the wind one hears; the hanging sign
  swings on them (its own pivot, out of the static batch: +3 draw calls); a shooting star
  crosses the sky in about half of every 11 s (sky.ts); people pass behind the curtains.
- The hearth (`scene/hearth.ts`): charred logs with embers glowing in their cracks, an
  ember bed, shader-drawn tongues of flame on crossed cards, sparks rising, and soot inside
  the recess (the fire light had blown the bare stone out to white, and the flames could
  not show against it). Hidden until the door opens, like the hall's Christmas dressing.
- Winter's frost (`scene/frost.ts`): icicles on the main roof's side eaves and the wing's
  front eave (measured from the kit's bounds); low snow banks along both edges of the track,
  long and overlapping so they run together, and drifts against the hall's left wall and
  the wing's outer wall — lit by the windows' and lanterns' painted light like the ground
  (terrain.ts `groundLit`).
- Autumn's fallen leaves: four layers of many sizes and four colours, heaped in drifts and
  piled at the track's edges, dark and few on the track; where a leaf would be smaller than
  a few pixels the pattern gives way to its average tint (drawn, it shimmered as confetti).

Cost now (walk / hold / flight, high tier, `?seed=1`): summer 64 / 63 / 54 calls, 724k tris;
autumn 70 / 70 / 60, 850k; winter 61 / 60 / 52, 732k; Christmas 67 / 64 / 59, 750k.

**The brook** (`scene/brookShape.ts`, `scene/brook.ts`; every season): a small stream across
the walk halfway (z −90.75, where the path meets the camera line, so the bridge sits on the
track), wandering off into the forest both ways — the idea from a diorama render with a mill
and a plank bridge. The terrain cuts its channel into a level valley (rows every 0.3 m across
its band; `surfaceY` keeps the same cell split, so nothing moved elsewhere) and keeps the
painted track off its banks, the soil dark and wet at the water's edge. The water is one
lit ribbon: dark and glossy, rippled by noise flowing downstream, the misty sky reflected by
Fresnel and the moon as a glitter; autumn floats the season's leaves on it. Winter freezes
it the way a brook freezes (an open run down the whole middle was tried and read wrong): open
water only where the current is quickest — under the bridge and below two stones in riffles
(`ICE_WINDOWS`, ragged edges) — a white lip where the ice ends, a rim of clear dark ice round
each opening and patches swept bare (glossy, cracked), snow on the rest and on the banks down
to the ice; steam rising off the open water (mist sprites in the mist's batch, faint: it reads
against the dark trees, not the snow). The footbridge is a humpback (from a reference): its
deck a circular arc 0.5 m high over 5.4 m (`BRIDGE`, `deckY`), planks along the arc on two
stringers whose ends lie on the banks, handrails on posts — merged into the facade's batch,
taking the night grade and snow like the building. The walk climbs it (`walkRise`,
`placeCamera`): not along the deck itself — the arc meets the ground at 21° and the camera
jumped up on the first step and down on the last — but along a smootherstep bell from a metre
before the bridge to a metre after, level and straight at both ends, within 2 cm of the deck;
the eyes tilt a little with its slope. Reeds line the banks, stones lie on them and a
few in the stream. Trees standing in the water step onto the bank (after their random draws),
what is strewn along the path keeps dry, winter's snow banks stop at the bridge and a lantern
that would stand on a bank moves back along the path. Sound: a positional loop at the
crossing (freesound 363120 by TheWoodlandNomad, CC0, a trickle; mono, 30 s seamless,
−29 LUFS); in winter it comes from the open water under the bridge, duller and quieter. Cost: +3 draw calls (water, reeds, stones):
summer 67, autumn 73, winter 64.

**Look test, dropped**: Poly Haven's realistic models (rocks, grass, a chest, a fir, a
jacaranda) were exported from a Blender file and tried in the scene behind a flag. Rocks and
the chest sat well; the trees did not — a fir realized from its geometry nodes is ~12M
triangles (1.6M with a seventh of its twigs, still a bare pole at night next to the kit's
pines). The scene stays low-poly; the test is gone.

Ideas kept for later: patrons in the hall (two or three from the Character pack, idling at
the back tables — skinned meshes, so measured first).

## Per theme (scene first)

| Theme | Scene | Sound |
|---|---|---|
| Autumn | rust and brown undergrowth, fallen leaves on the path, falling leaves, warmer mist | rustling leaves, rain, owls |
| Winter | snow on the ground, roofs and rocks (shader: whatever faces up turns white), falling snow, bare bushes, cold mist, more chimney smoke | wind, snow crunching underfoot, crackling fire |
| Christmas and New Year | garland on the facade, a wreath on the door, a tree in the yard, snow | distant bells, carols from the tavern |
| Valentine's Day | to be designed | |
| Spring | fresh green, more flowering bushes, petals | nightingale, a brook |
| April Fools' | a gag: the sign upside down, a sheep at the bar… | |
| Easter | to be designed | |
| Summer | today's look with fireflies | crickets, frogs |
| Midsummer / Kupala | bonfires, wreaths on the water, fireflies | fire, singing in the distance |
| Halloween | carved pumpkins on the porch and along the path, orange lanterns, bats across the moon | crows, a distant howl, the sign creaking |

Assets: CC0 packs (KayKit Halloween Bits for pumpkins, the kits already used), checked at
night in the scene before they go in. Garlands, snow, leaves: particles and shaders. Each
theme stays within today's budget (~60 draw calls walking), measured on both tiers.
Decor models load only for their theme. Sound: CC0/CC-BY recordings from freesound like
the current ones — mono, denoised (hard rules 6, 9), levelled to the forest bed; each
theme's loop is `ambience` in `themes.ts` (optional: a missing file changes nothing). The
innkeeper's voice is not touched.

## Branches and release

`claude/theme-<name>` from `staging` → merged into `staging` (preview at
`preview/staging/`) → `staging` into `main` (the live site) through a pull request with
green CI. Each branch has its own preview at `preview/claude/theme-<name>/`.

| # | Branch | Ready by |
|---|---|---|
| 0 | `staging`, `claude/theme-core` (this) | — |
| 1 | `claude/theme-autumn` | now (autumn runs to 30 November) |
| 2 | `claude/theme-winter` | 1 December |
| 3 | `claude/theme-xmas` | 18 December |
| 4 | `claude/theme-valentine` | 7 February |
| 5 | `claude/theme-spring` | 1 March |
| 6 | `claude/theme-april-fools` | 1 April (21 March 2027 for Easter first) |
| 7 | `claude/theme-easter` | 21 March 2027 |
| 8 | `claude/theme-summer`, `claude/theme-midsummer` | 1 and 17 June |
| 9 | `claude/theme-halloween` | 24 October 2027 |
