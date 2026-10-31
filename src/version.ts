/* Stale caches after a deploy (see vite.config.ts). `asset()` gives a file's URL tagged with
   this build's id, so new code never meets old models or sounds. `checkVersion()` asks the
   server, past the cache, which build is live; when it is newer than this page, the page
   reloads once — the old index.html was served from the cache. Never in dev. */

declare const __BUILD__: string;
export const BUILD = __BUILD__;

export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}?v=${BUILD}`;

export function checkVersion() {
  if (import.meta.env.DEV) return;
  const key = 'tavern-reloaded-for';
  fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    .then(r => r.ok ? r.json() as Promise<{ build?: string }> : null)
    .then(v => {
      if (!v?.build || v.build === BUILD) return;
      let done: string | null = null;
      try { done = sessionStorage.getItem(key); } catch { /* storage blocked */ }
      if (done === v.build) return;                // reloaded once for it already: no loop
      try { sessionStorage.setItem(key, v.build); } catch { /* storage blocked: reload anyway */ }
      location.reload();
    })
    .catch(() => { /* offline or blocked: carry on with this page */ });
}
