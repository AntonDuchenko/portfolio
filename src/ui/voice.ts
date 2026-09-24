import { el } from './dom';

// Voice lines are timed to walked distance (fraction of the walk) for now.
// Next step inverts this: audio duration drives the walk length.
const script = [
  { at: .02, text: 'Здесь начинается закадровый голос. Пара фраз о том, кто я.' },
  { at: .28, text: 'Дальше — как пришёл в разработку и чем занимался до неё.' },
  { at: .55, text: 'Потом — чем занимаюсь сейчас и что мне в этом интересно.' },
  { at: .80, text: 'И последняя фраза — прямо перед дверью.' }
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
