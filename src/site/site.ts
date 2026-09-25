/* Behaviour for the site behind the poster. Plain DOM, no dependencies; loaded by the
   bootstrap so it also runs in the no-WebGL fallback. Scroll-linked motion itself is CSS
   (site.css); this file adds what CSS cannot: splitting letters, pointer-driven light and
   tilt, the nav state, clipboard, and an IntersectionObserver fallback for browsers
   without scroll timelines. */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  [...root.querySelectorAll<T & Element>(sel)] as T[];

/** Wraps every character of [data-ink] headings in a span with its index (--i). Letters
 *  are grouped per word in a no-wrap span: loose inline-block letters let the browser
 *  break a line in the middle of a word ("Duchenk / o"). */
function splitInk() {
  for (const el of $$('[data-ink]')) {
    const text = el.textContent ?? '';
    el.setAttribute('aria-label', text);
    el.textContent = '';
    let i = 0;
    text.split(/(\s+)/).forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) { el.append(document.createTextNode(' ')); i++; return; }
      const word = document.createElement('span');
      word.className = 'word'; word.setAttribute('aria-hidden', 'true');
      for (const c of part) {
        const s = document.createElement('span');
        s.className = 'ch'; s.textContent = c; s.style.setProperty('--i', String(i++));
        word.append(s);
      }
      el.append(word);
    });
  }
}

/** Adds .is-in once an element is on screen (inked headings, flourishes, fallback reveals). */
function observeIn(targets: Element[], threshold = .25) {
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { threshold });
  targets.forEach(t => io.observe(t));
}

/** Nav: appears once the hero is mostly scrolled past; marks the chapter in view. */
function nav() {
  const bar = document.querySelector<HTMLElement>('.bar');
  const hero = document.getElementById('intro');
  if (!bar || !hero) return;
  new IntersectionObserver(([e]) => bar.classList.toggle('on', !e.isIntersecting), { threshold: .35 }).observe(hero);
  const links = new Map($$<HTMLAnchorElement>('.bar ul a').map(a => [a.hash.slice(1), a]));
  const spy = new IntersectionObserver(entries => {
    for (const e of entries) {
      const a = links.get(e.target.id);
      if (!a) continue;
      if (e.isIntersecting) { links.forEach(l => l.removeAttribute('aria-current')); a.setAttribute('aria-current', 'true'); }
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('.chapter').forEach(c => spy.observe(c));
}

/** Warm light that follows the pointer; mouse and pen only. */
function candlelight() {
  const light = document.querySelector<HTMLElement>('.candlelight');
  if (!light || !finePointer || reduced) return;
  let x = 0, y = 0, queued = false;
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    if (queued) return; queued = true;
    requestAnimationFrame(() => {
      queued = false;
      light.style.setProperty('--mx', `${x}px`); light.style.setProperty('--my', `${y}px`);
      light.classList.add('on');
    });
  }, { passive: true });
  document.addEventListener('pointerleave', () => light.classList.remove('on'));
}

/** Quest notices tilt towards the pointer and carry a light spot (--x/--y). */
function tilt() {
  if (!finePointer || reduced) return;
  for (const card of $$('[data-tilt]')) {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--tx', `${(px - .5) * 8}deg`);
      card.style.setProperty('--ty', `${(.5 - py) * 8}deg`);
      card.style.setProperty('--x', `${px * 100}%`);
      card.style.setProperty('--y', `${py * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      for (const p of ['--tx', '--ty']) card.style.setProperty(p, '0deg');
    });
  }
}

/** Wax seals lean a few pixels towards the pointer. */
function magnetic() {
  if (!finePointer || reduced) return;
  for (const a of $$('a.wax')) {
    a.addEventListener('pointermove', e => {
      const r = a.getBoundingClientRect();
      a.style.setProperty('--dx', `${((e.clientX - r.left) / r.width - .5) * 8}px`);
      a.style.setProperty('--dy', `${((e.clientY - r.top) / r.height - .5) * 6}px`);
    });
    a.addEventListener('pointerleave', () => { a.style.setProperty('--dx', '0px'); a.style.setProperty('--dy', '0px'); });
  }
}

/** "Send a raven": copy the address, let the bird fly, say so. */
function raven() {
  const btn = document.querySelector<HTMLButtonElement>('.send');
  const toast = document.querySelector<HTMLElement>('.toast');
  if (!btn || !toast) return;
  const send = async () => {
    const text = btn.dataset.copy ?? '';
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { /* insecure context or denied */ }
    toast.textContent = ok ? 'Copied. The raven is on its way.' : `Write to ${text}`;
    btn.classList.remove('sent'); void btn.offsetWidth; btn.classList.add('sent');
  };
  btn.addEventListener('click', () => { void send(); });
}

/** Called when the resume starts to fade in over the poster (or at once without the scene). */
export function inkHero() {
  document.querySelector('#intro [data-ink]')?.classList.add('is-in');
}

export function initSite() {
  splitInk();
  // the hero name inks in when the poster hands over to the page (inkHero), not before:
  // the site sits invisible under the scene until then
  observeIn($$('[data-ink], .chapter-head').filter(el => !el.closest('#intro')), .3);
  // without scroll timelines the CSS keeps [data-reveal] hidden until .is-in
  if (!CSS.supports('animation-timeline: view()')) {
    document.documentElement.classList.add('no-sda');
    observeIn($$('[data-reveal]'), .15);
  }
  nav();
  candlelight();
  tilt();
  magnetic();
  raven();
}
