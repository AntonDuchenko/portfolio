/** Skip the scene entirely and show the site as the landing page would. */
export function showSiteOnly(reason: string) {
  console.warn(`scene skipped: ${reason}`);
  const $ = (id: string) => document.getElementById(id);
  document.body.classList.add('landed');
  document.body.classList.remove('scene-locked');
  for (const id of ['gate', 'scene', 'vignette', 'skip', 'tune', 'line', 'portal', 'again'])
    $(id)?.classList.add('hidden');
  const site = $('site'); if (site) site.style.opacity = '1';
}
