import { audioStarted, loadNarration, narrate } from '../audio/audio';
import data from './narration.json';
import { mountAvatar } from './avatar';

/* The innkeeper: narrates each chapter as it reaches the middle of the screen, once per
   visit. A newer chapter interrupts the current line; clicking him skips it. Without
   audio (entered silently) the lines still appear as speech bubbles, timed by length.
   The portrait is the avatar slot: a 3D character mounts there (see avatar hook). */

const LINES: Record<string, string> = data.lines;
const WORDS_PER_S = 2.6, LINGER = 1.4;

type Line = { stop(): void; level(): number };
let buffers: Record<string, AudioBuffer> = {};
let current: Line | null = null, hideTimer = 0, raf = 0;
const said = new Set<string>();

const root = () => document.querySelector<HTMLElement>('.narrator')!;

/** The 3D innkeeper (avatar.ts) follows the voice level; until it loads, the portrait
 *  shows the poster's silhouette and bobs via --lvl. */
let avatar: { talk(level: number): void; idle(): void; greet(): void } | null = null;

function show(text: string) {
  const r = root();
  r.querySelector('.say')!.textContent = text;
  r.classList.add('talking', 'open');
  clearTimeout(hideTimer);
}
function hide() {
  const r = root();
  r.classList.remove('talking');
  hideTimer = window.setTimeout(() => r.classList.remove('open'), LINGER * 1000);
  cancelAnimationFrame(raf);
  r.style.setProperty('--lvl', '0');
  avatar?.idle();
}

function speak(id: string) {
  if (said.has(id) || !LINES[id]) return;
  said.add(id);
  current?.stop();
  if (id === 'intro') avatar?.greet();
  const text = LINES[id];
  show(text);
  const buf = buffers[id];
  if (buf && audioStarted()) {
    const line = narrate(buf, () => { if (current === line) { current = null; hide(); } });
    current = line;
    const r = root();
    const tick = () => {                       // voice level → portrait bob and the avatar
      if (current !== line) return;
      const lvl = Math.min(1, line.level() * 6);
      r.style.setProperty('--lvl', lvl.toFixed(3));
      avatar?.talk(lvl);
      raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  } else {
    // silent: keep the bubble up for as long as the line would take
    let alive = true;
    const t = window.setTimeout(() => { if (alive && current === line) { current = null; hide(); } }, text.split(/\s+/).length / WORDS_PER_S * 1000);
    const line: Line = { stop() { alive = false; clearTimeout(t); }, level: () => 0 };
    current = line;
  }
}

let started = false;
/** Called on landing. Loads the lines, then narrates chapters as they come into view. */
export function startNarrator() {
  const r = root();
  r.hidden = false;
  if (started) return;
  started = true;
  r.querySelector('.keeper')!.addEventListener('click', () => { current?.stop(); current = null; hide(); });
  mountAvatar(r.querySelector<HTMLElement>('.portrait')!)
    .then(a => { avatar = a; r.classList.add('has-avatar'); })
    .catch(e => console.warn('avatar:', e));             // the silhouette stays
  const ids = Object.keys(LINES);
  const ready = audioStarted() ? loadNarration(ids).then(b => { buffers = b; }) : Promise.resolve();
  ready.then(() => {
    // a chapter "arrives" when it crosses the middle band of the screen
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) speak(e.target.id);
    }, { rootMargin: '-35% 0px -45% 0px' });
    ids.forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
  });
}

/** Replaying the scene: stop talking, tell the whole tale again next time. */
export function resetNarrator() {
  current?.stop(); current = null; said.clear();
  root().classList.remove('talking', 'open');
}
