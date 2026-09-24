import { el } from './dom';

// Voice lines are timed to walked distance (fraction of the walk) for now.
// Next step inverts this: audio duration drives the walk length.
const script = [
  { at: .02, text: 'Evening, traveller. Mind the roots — the path is longer than it looks.' },
  { at: .28, text: 'My name is Anton. I build things for the web, from the database up to the last pixel.' },
  { at: .55, text: 'These days it is TypeScript, Node and React — and a habit of seeing work through to production.' },
  { at: .80, text: 'The tavern is just ahead. My notice is pinned up inside.' }
];
let lineIdx = -1;
const lineP = el.line.querySelector('p')!;

export function setLine(v: string | null) {
  if (v === null) { el.line.classList.remove('on'); return; }
  lineP.textContent = v; el.line.classList.add('on');
}

/** p — walked fraction of the route */
export function updateLines(p: number) {
  for (let i = script.length - 1; i >= 0; i--)
    if (p >= script[i].at && lineIdx !== i) { lineIdx = i; setLine(script[i].text); break; }
}

export function resetLines() { lineIdx = -1; }
