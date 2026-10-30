import { HOLIDAYS, type Holiday, type Season, SEASONS, type Theme, themeOf } from './calendar';

/* The theme of this visit: the visitor's local date through the calendar, then the
   overrides, for previews and tests:
     ?date=2026-12-24       as if it were that day
     ?season=winter         force the season
     ?holiday=xmas|none     force the holiday, or none
     ?fools=1|0             force the April 1 joke on or off
   The result is fixed for the visit and mirrored on <html> as data-season, data-holiday
   and data-fools (CSS hooks; the site's look follows later). */

function resolve(): Theme {
  const q = new URLSearchParams(location.search);
  const now = new Date(), forced = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q.get('date') ?? '');
  const t = forced ? themeOf(+forced[1], +forced[2], +forced[3])
    : themeOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const s = q.get('season'), h = q.get('holiday'), f = q.get('fools');
  if (SEASONS.includes(s as Season)) t.season = s as Season;
  if (h === 'none') t.holiday = null;
  else if (HOLIDAYS.includes(h as Holiday)) t.holiday = h as Holiday;
  if (f === '1' || f === '0') t.fools = f === '1';
  return t;
}

export const theme: Theme = resolve();

export function applyTheme() {
  const el = document.documentElement;
  el.dataset.season = theme.season;
  el.dataset.holiday = theme.holiday ?? 'none';
  el.dataset.fools = String(theme.fools);
}
