import { el } from './dom';

/* Full screen, like F11, for the scene only: it starts with the click that starts the
   scene ("Take the trail", "Back to the tavern") and ends on landing — the page is read
   in the normal window. Browsers allow it only from a click or key press (never on load)
   and not everywhere (iPhone Safari has none for pages): there nothing happens and the
   corner button stays hidden. During the scene the button and F toggle it; Esc leaves. */

const supported = () => document.fullscreenEnabled;
const report = (e: unknown) => console.warn('fullscreen:', e);

/** Call from inside a click or key handler. */
export function enterFullscreen() {
  if (!supported() || document.fullscreenElement) return;
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(report);
}
export function leaveFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(report);
}

export function initFullscreen() {
  if (!supported()) return;
  const btn = el.fullscreen;
  const toggle = () => { if (document.fullscreenElement) leaveFullscreen(); else enterFullscreen(); };
  const sync = () => {
    const on = !!document.fullscreenElement;
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Leave full screen (F)' : 'Full screen (F)';
  };
  btn.addEventListener('click', toggle);
  document.addEventListener('fullscreenchange', sync);
  addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 'f' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (document.body.classList.contains('landed')) return;
    toggle();
  });
  sync();
  btn.classList.remove('hidden');
}
