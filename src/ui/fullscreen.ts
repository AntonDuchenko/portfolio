import { el } from './dom';

/** Full screen, like F11, for the scene: a button in the top corner and the F key (scene
 *  only). Browsers allow it only from a click or a key press, and not every one allows it
 *  for a page (iPhone Safari does not) — there the button stays hidden. Leaving: the
 *  button, F or Esc; landing on the page keeps it, Esc still leaves. */
export function initFullscreen() {
  if (!document.fullscreenEnabled) return;
  const btn = el.fullscreen;
  const toggle = () => {
    const change = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    change.catch((e: unknown) => console.warn('fullscreen:', e));
  };
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
