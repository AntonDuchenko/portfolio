import { isMuted, setMuted } from '../audio/engine';

/** Sound toggle in the site nav (shown after entering with sound). M toggles — on the
 *  site only; the scene always plays with sound (see setOnSite in audio.ts). */
export function initSoundToggle() {
  const btn = document.getElementById('sound') as HTMLButtonElement | null;
  if (!btn) return;
  const label = btn.querySelector('.label')!;
  const sync = () => {
    const m = isMuted();
    btn.setAttribute('aria-pressed', String(m));
    btn.classList.toggle('muted', m);
    label.textContent = m ? 'Sound off' : 'Sound on';
    btn.title = (m ? 'Turn sound on' : 'Turn sound off') + ' (M)';
  };
  const toggle = () => { setMuted(!isMuted()); sync(); };
  btn.addEventListener('click', toggle);
  addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 'm' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!document.body.classList.contains('landed')) return;
    if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
    toggle();
  });
  sync();
  btn.classList.add('on');
}
