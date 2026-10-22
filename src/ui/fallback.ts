import { track, trackChapters } from '../analytics';

/** Skip the scene entirely and show the site as the landing page would. */
export function showSiteOnly(via: 'no_webgl' | 'software_gl') {
  console.warn(`scene skipped: ${via === 'no_webgl' ? 'no WebGL2' : 'software WebGL renderer'}`);
  const $ = (id: string) => document.getElementById(id);
  document.body.classList.add('landed');
  document.body.classList.remove('scene-locked');
  for (const id of ['gate', 'scene', 'vignette', 'skip', 'tune', 'line', 'portal', 'again'])
    $(id)?.classList.add('hidden');
  const site = $('site'); if (site) site.style.opacity = '1';
  track('landed', { via, replay: false }); trackChapters();
}
