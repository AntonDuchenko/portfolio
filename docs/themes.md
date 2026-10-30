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
