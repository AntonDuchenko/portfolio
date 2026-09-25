import { track } from '../analytics';
import { getMaster, isMuted, onMasterChange, onMuteChange, setMaster, setMuted } from '../audio/engine';

/* The sound control, in two places with one state: the scene's top corner (#volume, next
   to Skip) and the site's nav (#sound). The speaker mutes and unmutes, the slider sets the
   level; moving the slider while muted unmutes. M toggles mute anywhere outside a text
   field. Shown only when the visitor entered with sound. The scene always starts with
   sound — see setOnSite in audio/engine.ts. */

function bind(root: HTMLElement) {
  const btn = root.querySelector<HTMLButtonElement>('.mute')!;
  const input = root.querySelector<HTMLInputElement>('input[type=range]')!;
  const sync = () => {
    const m = isMuted();
    root.classList.toggle('muted', m);
    root.classList.toggle('silent', +input.value === 0);
    btn.setAttribute('aria-pressed', String(m));
    btn.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
    btn.title = (m ? 'Unmute' : 'Mute') + ' (M)';
  };
  btn.addEventListener('click', () => { setMuted(!isMuted()); track('sound_muted', { muted: isMuted() }); });
  input.addEventListener('input', () => {
    setMaster(+input.value / 100);
    if (isMuted()) setMuted(false);
  });
  onMasterChange(v => { input.value = String(Math.round(v * 100)); sync(); });
  onMuteChange(sync);
  input.value = String(Math.round(getMaster() * 100));
  sync();
}

export function initSoundControls() {
  const scene = document.getElementById('volume'), site = document.getElementById('sound');
  if (scene) { bind(scene); scene.classList.remove('hidden'); }
  if (site) { bind(site); site.classList.add('on'); }
  addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 'm' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if ((e.target as HTMLElement).closest('input:not([type=range]), textarea, [contenteditable]')) return;
    setMuted(!isMuted());
  });
}
