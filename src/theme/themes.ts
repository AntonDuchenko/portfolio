import type { Holiday, Season } from './calendar';
import { theme } from './theme';

/* What each season and holiday brings. Filled in by the theme branches (docs/themes.md);
   the scene and the sound read it here instead of looking at the date themselves.
   A holiday is laid over its season: both entries apply, the holiday's on top. */

export interface Ambience {
  /** a mono loop in public/audio/ (no extension): plays outside, under the forest bed */
  file: string;
  /** level next to the forest bed (that one is 0.55) */
  gain: number;
}
export interface ThemeData {
  ambience?: Ambience;
}

export const SEASON_DATA: Record<Season, ThemeData> = {
  winter: {}, spring: {}, summer: {}, autumn: {}
};
export const HOLIDAY_DATA: Record<Holiday, ThemeData> = {
  xmas: {}, valentine: {}, easter: {}, midsummer: {}, halloween: {}
};

/** the data in force for this visit: the season's, then the holiday's */
export const active: ThemeData[] = [SEASON_DATA[theme.season], ...(theme.holiday ? [HOLIDAY_DATA[theme.holiday]] : [])];
