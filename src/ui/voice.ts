import { playVoice, stopVoice } from '../audio/audio';
import data from './voice-lines.json';
import { el } from './dom';

/* Narration drives the walk (timeline inversion): the lines play back to back with
   pauses, and the walk lasts exactly as long as the narration needs. Durations come from
   the decoded voice files; without audio they are estimated from the word count so the
   subtitles still pace sensibly. */

export const LINES: string[] = data.lines;

const LEAD_IN = 2;        // s of forest before the first line
const GAP = 1.6;          // s between lines
const TAIL = 5;           // s after the last line before the camera stops at the door
const LINGER = 1.2;       // s a subtitle stays after its line ends
const WORDS_PER_S = 2.6;  // estimate when there is no audio

let starts: number[] = [], ends: number[] = [];
let next = 0, shown = -1;
const lineP = el.line.querySelector('p')!;

/** Lays the lines out on the walk's clock; returns the walk duration in seconds. */
export function buildSchedule(durations: (number | null)[]) {
  starts = []; ends = [];
  let t = LEAD_IN;
  LINES.forEach((text, i) => {
    const d = durations[i] ?? text.split(/\s+/).length / WORDS_PER_S;
    starts.push(t); ends.push(t + d);
    t += d + GAP;
  });
  return t - GAP + TAIL;
}

export function setLine(v: string | null) {
  if (v === null) { el.line.classList.remove('on'); return; }
  lineP.textContent = v; el.line.classList.add('on');
}

/** t — seconds since the walk started */
export function updateLines(t: number) {
  while (next < LINES.length && t >= starts[next]) {
    setLine(LINES[next]); playVoice(next); shown = next; next++;
  }
  if (shown >= 0 && t >= ends[shown] + LINGER) { setLine(null); shown = -1; }
}

/** Skip or replay: silence the narrator and start the script from the top next time. */
export function resetLines() { next = 0; shown = -1; stopVoice(); }
