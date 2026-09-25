/* Visitor counts, nothing else: GoatCounter (https://www.goatcounter.com) — no cookies, no
   personal data, so no consent banner. Page views are counted per visit on the live site
   only: never in dev, on localhost (the smoke test) or while the code is empty. */

const GOATCOUNTER = '' as string;   // the account's code: https://<code>.goatcounter.com

export function initAnalytics() {
  if (!GOATCOUNTER || import.meta.env.DEV || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${GOATCOUNTER}.goatcounter.com/count`;
  document.head.append(s);
}
