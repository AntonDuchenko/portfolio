import { getMaster, setMaster } from '../audio/engine';
import { el } from './dom';

/** Volume slider in the scene's top corner (next to Skip), shown when the visitor entered
 *  with sound. Sets the master level for the scene and the site; remembered between
 *  visits. The site's own control is the mute toggle in the nav (ui/sound.ts). */
export function initVolume() {
  const input = el.volume.querySelector('input')!;
  const sync = () => el.volume.classList.toggle('silent', +input.value === 0);
  input.value = String(Math.round(getMaster() * 100));
  input.addEventListener('input', () => { setMaster(+input.value / 100); sync(); });
  sync();
  el.volume.classList.remove('hidden');
}
