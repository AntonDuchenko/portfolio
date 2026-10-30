import { expect, test } from '@playwright/test';
import { easterWindows, orthodoxEaster, seasonOf, themeOf, westernEaster } from '../src/theme/calendar';

/* The theme calendar (src/theme/calendar.ts), no browser: season edges, every holiday
   window's first and last day and the days just outside, both Easters. */

const at = (date: string) => { const [y, m, d] = date.split('-').map(Number); return themeOf(y, m, d); };

test('seasons follow whole months', () => {
  expect([12, 1, 2].map(seasonOf)).toEqual(['winter', 'winter', 'winter']);
  expect([3, 5, 6, 8, 9, 11].map(seasonOf)).toEqual(['spring', 'spring', 'summer', 'summer', 'autumn', 'autumn']);
});

test('fixed holiday windows, edges included', () => {
  const cases: [string, string | null][] = [
    ['2026-12-17', null], ['2026-12-18', 'xmas'], ['2026-12-31', 'xmas'], ['2027-01-01', 'xmas'],
    ['2027-01-06', 'xmas'], ['2027-01-07', null],
    ['2027-02-06', null], ['2027-02-07', 'valentine'], ['2027-02-14', 'valentine'], ['2027-02-15', null],
    ['2027-06-16', null], ['2027-06-17', 'midsummer'], ['2027-06-24', 'midsummer'], ['2027-06-25', null],
    ['2026-10-23', null], ['2026-10-24', 'halloween'], ['2026-10-31', 'halloween'], ['2026-11-02', 'halloween'],
    ['2026-11-03', null]
  ];
  for (const [d, h] of cases) expect(at(d).holiday, d).toBe(h);
  expect(at('2026-12-24').season).toBe('winter');
  expect(at('2026-10-31').season).toBe('autumn');
});

test('both Easters are known for the coming years', () => {
  const western: Record<number, [number, number]> = { 2025: [4, 20], 2026: [4, 5], 2027: [3, 28], 2028: [4, 16], 2029: [4, 1], 2030: [4, 21] };
  const orthodox: Record<number, [number, number]> = { 2025: [4, 20], 2026: [4, 12], 2027: [5, 2], 2028: [4, 16], 2029: [4, 8], 2030: [4, 28] };
  for (const y of [2025, 2026, 2027, 2028, 2029, 2030]) {
    expect(westernEaster(y), `western ${y}`).toEqual(western[y]);
    expect(orthodoxEaster(y), `orthodox ${y}`).toEqual(orthodox[y]);
  }
});

test('Easter windows: same day, a week apart, five weeks apart', () => {
  expect(easterWindows(2028)).toHaveLength(1);                         // both on 16 April
  expect([at('2028-04-08').holiday, at('2028-04-09').holiday, at('2028-04-16').holiday, at('2028-04-17').holiday])
    .toEqual([null, 'easter', 'easter', null]);
  expect(easterWindows(2029)).toHaveLength(1);                         // 1 and 8 April: one two-week window
  expect([at('2029-03-24').holiday, at('2029-03-25').holiday, at('2029-04-08').holiday, at('2029-04-09').holiday])
    .toEqual([null, 'easter', 'easter', null]);
  expect(easterWindows(2027)).toHaveLength(2);                         // 28 March and 2 May: two weeks
  expect(['2027-03-20', '2027-03-21', '2027-03-28', '2027-03-29', '2027-04-24', '2027-04-25', '2027-05-02', '2027-05-03']
    .map(d => at(d).holiday)).toEqual([null, 'easter', 'easter', null, null, 'easter', 'easter', null]);
});

test('April 1 is a one-day joke on top of whatever is on', () => {
  expect([at('2027-03-31').fools, at('2027-04-01').fools, at('2027-04-02').fools]).toEqual([false, true, false]);
  expect(at('2029-04-01')).toEqual({ season: 'spring', holiday: 'easter', fools: true });   // Western Easter day
});
