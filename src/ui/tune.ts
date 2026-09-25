import { setMaster } from '../audio/engine';
import { mix, setForestCut } from '../audio/scene';
import { cfg } from '../config';
import { setMoon } from '../scene/lights';
import { el } from './dom';

/** Debug panel: shown in dev, or in a build with `?debug` in the URL. */
export const tuneEnabled = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

const $ = (id: string) => document.getElementById(id) as HTMLInputElement;

type Knob = [slider: string, value: string, parse: (v: number) => number, fmt: (v: number) => string];
const knobs: Record<keyof typeof cfg, Knob> = {
  moon: ['s-moon', 'v-moon', v => v / 100, v => (v / 100).toFixed(2)],
  fog: ['s-fog', 'v-fog', v => v / 1000, v => (v / 1000).toFixed(3)],
  hall: ['s-hall', 'v-hall', v => v / 100, v => (v / 100).toFixed(2)],
  fly: ['s-fly', 'v-fly', v => v / 10, v => (v / 10).toFixed(1)]
};

export function initTune() {
  if (!tuneEnabled) { el.tune.remove(); return; }
  for (const k of Object.keys(knobs) as (keyof typeof cfg)[]) {
    const [sid, vid, parse, fmt] = knobs[k], input = $(sid), out = $(vid);
    const sync = () => {
      cfg[k] = parse(+input.value); out.textContent = fmt(+input.value);
      if (k === 'moon') setMoon(1);
    };
    input.addEventListener('input', sync); sync();
  }
  const sVol = $('s-vol'), vVol = $('v-vol');
  const syncVol = () => { setMaster(+sVol.value / 100); vVol.textContent = sVol.value + '%'; };
  sVol.addEventListener('input', syncVol); syncVol();
  const sCut = $('s-cut'), vCut = $('v-cut');
  const syncCut = () => { setForestCut(+sCut.value); vCut.textContent = (+sCut.value / 1000).toFixed(1) + ' kHz'; };
  sCut.addEventListener('input', syncCut); syncCut();
  document.querySelectorAll<HTMLInputElement>('.mutes input').forEach(cb =>
    cb.addEventListener('change', () => { mix[cb.dataset.l as keyof typeof mix] = cb.checked ? 1 : 0; }));
}
