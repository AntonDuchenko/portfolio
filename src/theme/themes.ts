import type { Holiday, Season } from './calendar';
import { theme } from './theme';

/* What each season and holiday brings. Filled in by the theme branches (docs/themes.md);
   the scene and the sound read it here instead of looking at the date themselves.
   A holiday is laid over its season: both entries apply, the holiday's on top. Anything
   left out keeps today's look — summer is the base. */

export interface Ambience {
  /** a mono loop in public/audio/ (no extension): plays outside, under the forest bed */
  file: string;
  /** level next to the forest bed (that one is 0.55) */
  gain: number;
}
type RGB = [number, number, number];
export interface Look {
  /** broadleaf trees among the pines; each crown takes one of these (sRGB) in turn */
  broadleaf?: number[];
  /** the plain bush's leaves: linear colour × the texture's brightness */
  bush?: RGB;
  /** the flowering bush's leaves: a multiplier (sRGB) */
  bloomLeaves?: number;
  /** extra linear multipliers on kit materials by name, after the night tint — e.g. Grass
   *  (above 1 to lighten: the night tint has darkened them) */
  tint?: Record<string, RGB>;
  /** kit materials by name repainted: the texture's brightness × this linear colour (for a
   *  change of hue a multiplier cannot make, e.g. green ferns to brown bracken) */
  recolor?: Record<string, RGB>;
  /** fallen leaves on the ground, 0…1 (terrain shader) */
  litter?: number;
  /** falling leaves around the walk at the high tier (low: half) */
  falling?: number;
  /** leaf colours (sRGB) for the litter and the falling leaves */
  leaves?: number[];
}
export interface Sound {
  /** the synthesised wind, × today's level */
  wind?: number;
}
export interface ThemeData {
  look?: Look;
  sound?: Sound;
  ambience?: Ambience;
}

const AUTUMN_LEAVES = [0xb5541c, 0x9c2f1c, 0xc8861f, 0x6e4426, 0xa8661e];

export const SEASON_DATA: Record<Season, ThemeData> = {
  winter: {},
  spring: {},
  summer: {},
  autumn: {
    look: {
      broadleaf: AUTUMN_LEAVES,
      bush: [.075, .04, .018],                      // rust
      bloomLeaves: 0x3a2a1c,
      recolor: { Leaves: [.11, .05, .018], Grass: [.12, .09, .04] },   // bracken ferns, straw grass
      litter: .8,
      falling: 140,
      leaves: AUTUMN_LEAVES
    },
    sound: { wind: 1.3 },
    // wind through dry leaves: freesound 457318 by Stek59 (CC0), cut below 250 Hz (wind on
    // the microphone), a 40 s seamless loop at −30 LUFS (the forest bed: −22.4)
    ambience: { file: 'autumn', gain: .6 }
  }
};
export const HOLIDAY_DATA: Record<Holiday, ThemeData> = {
  xmas: {}, valentine: {}, easter: {}, midsummer: {}, halloween: {}
};

/** the data in force for this visit: the season's, then the holiday's */
export const active: ThemeData[] = [SEASON_DATA[theme.season], ...(theme.holiday ? [HOLIDAY_DATA[theme.holiday]] : [])];
/** the look in force: the holiday's fields over the season's */
export const look: Look = Object.assign({}, ...active.map(d => d.look ?? {})) as Look;
export const sound: Sound = Object.assign({}, ...active.map(d => d.sound ?? {})) as Sound;
