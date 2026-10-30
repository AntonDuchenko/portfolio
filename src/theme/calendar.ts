/* The theme calendar: which season and which holiday a date falls into. Pure (no DOM, no
   clock), so the tests can walk it over any date. Dates are the visitor's local calendar
   days; every window is inclusive at both ends. Plan and reasons: docs/themes.md. */

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type Holiday = 'xmas' | 'valentine' | 'easter' | 'midsummer' | 'halloween';
export const SEASONS: Season[] = ['winter', 'spring', 'summer', 'autumn'];
export const HOLIDAYS: Holiday[] = ['xmas', 'valentine', 'easter', 'midsummer', 'halloween'];

export interface Theme {
  season: Season;
  holiday: Holiday | null;
  /** April 1: a one-day joke laid over whatever else is on */
  fools: boolean;
}

/** a local calendar day as a comparable number (days since 1970-01-01) */
const dayNo = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m - 1, d) / 864e5);

/** meteorological seasons (northern hemisphere): whole months */
export function seasonOf(month: number): Season {
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}

/** Western Easter (Gregorian computus, anonymous algorithm): [month, day] */
export function westernEaster(y: number): [number, number] {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return [Math.floor(n / 31), n % 31 + 1];
}

/** Orthodox Easter (Julian computus, Meeus), as a Gregorian date: +13 days for 1900–2099 */
export function orthodoxEaster(y: number): [number, number] {
  const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const julian = dayNo(y, Math.floor((d + e + 114) / 31), (d + e + 114) % 31 + 1);
  const g = new Date((julian + 13) * 864e5);
  return [g.getUTCMonth() + 1, g.getUTCDate()];
}

/** Easter windows of a year, both Easters covered:
 *  - the same Sunday: the week before it;
 *  - a week apart: one window from the week before the earlier to the later (two weeks);
 *  - four or five weeks apart: a week before each. */
export function easterWindows(y: number): [number, number][] {
  const w = dayNo(y, ...westernEaster(y)), o = dayNo(y, ...orthodoxEaster(y));
  if (o - w <= 7) return [[w - 7, o]];
  return [[w - 7, w], [o - 7, o]];
}

/** fixed windows: [from month, day, to month, day]; xmas wraps over the new year */
const FIXED: [Holiday, number, number, number, number][] = [
  ['xmas', 12, 18, 1, 6],          // a week before Christmas to Epiphany (Twelfth Night)
  ['valentine', 2, 7, 2, 14],
  ['midsummer', 6, 17, 6, 24],     // the week before Midsummer / Kupala night (23–24 June)
  ['halloween', 10, 24, 11, 2]     // with All Saints' and the Day of the Dead
];

export function holidayOf(y: number, m: number, d: number): Holiday | null {
  const day = dayNo(y, m, d);
  for (const [h, m0, d0, m1, d1] of FIXED) {
    const from = dayNo(y, m0, d0), to = dayNo(m1 < m0 ? y + 1 : y, m1, d1);
    if (day >= from && day <= to) return h;
    if (m1 < m0 && day >= dayNo(y - 1, m0, d0) && day <= dayNo(y, m1, d1)) return h;   // the wrapped tail
  }
  if (easterWindows(y).some(([a, b]) => day >= a && day <= b)) return 'easter';
  return null;
}

export function themeOf(y: number, m: number, d: number): Theme {
  return { season: seasonOf(m), holiday: holidayOf(y, m, d), fools: m === 4 && d === 1 };
}
