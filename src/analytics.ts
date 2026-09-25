import type { PostHog } from 'posthog-js';
import { Q } from './quality';

/* Product analytics: PostHog (EU cloud). Page views, the scene → page funnel, how far down
   the page a visitor reads, and what they click (the conversions: CV, contacts, projects).
   No cookies and no storage (`persistence: 'memory'`), so no consent banner — the price is
   that a reload counts as a new visitor. No session recordings.

   Off in dev and on localhost (the smoke test). PostHog also drops bots, headless browsers
   included. The library (~95 KB gz, its own chunk) loads when the browser is idle, so it
   never competes with the scene; events fired earlier are queued.

   Events (the funnel, in order):
     scene_ready     the gate's button is live           { sound, load_s }
     trail_started   "Take the trail"                    { sound }
     walk_skipped    "Skip the walk"                     { at_s }
     door_opened     the door phase begins
     landed          the page is shown                   { via: scene | skip_fps | no_webgl, replay }
     chapter_view    a chapter reached mid-screen, once  { chapter }
     cv_download / contact_click { channel } / project_open { project } / email_copied
                     the conversions, each with { place } — the chapter it was clicked in
     replay          "Back to the tavern"
     sound_muted     { muted }
     narrator_skipped  a click on the innkeeper
   Autocapture records every other click as well ($autocapture). */

const KEY = 'phc_BUnXLjzVPn79jPiQUhNfZGc7CR5oX9shFPv9PidAQEaJ';   // project key: public by design
const HOST = 'https://eu.i.posthog.com';

type Props = Record<string, string | number | boolean>;
let on = false, ph: PostHog | null = null;
const queue: [string, Props | undefined][] = [];

/** Record an event (no-op when analytics is off). Safe to call before the library loads. */
export function track(event: string, props?: Props) {
  if (!on) return;
  if (ph) ph.capture(event, props);
  else queue.push([event, props]);
}

export function initAnalytics() {
  on = !import.meta.env.DEV && !/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
  if (!on) return;
  const load = () => void import('posthog-js').then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: HOST,
      defaults: '2026-08-30',
      persistence: 'memory',
      person_profiles: 'identified_only',
      capture_pageleave: true,              // carries the page's max scroll depth
      capture_heatmaps: true,
      capture_dead_clicks: true,
      disable_session_recording: true,
      disable_surveys: true,
      respect_dnt: true
    });
    posthog.register({ quality: Q.tier });
    ph = posthog;
    queue.splice(0).forEach(([e, p]) => posthog.capture(e, p));
  }).catch((e: unknown) => { on = false; console.warn('analytics:', e); });   // blocked: carry on
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 4000 });
  else setTimeout(load, 2000);
  trackClicks();
}

/* the conversions, from the links themselves: one listener instead of one per button */
function trackClicks() {
  document.addEventListener('click', e => {
    const a = (e.target as Element).closest<HTMLElement>('#site a, #site button.send');
    if (!a) return;
    const place = a.closest('section, header')?.id ?? 'nav';
    const href = a.getAttribute('href') ?? '';
    if (a.matches('button.send')) track('email_copied', { place });
    else if (a.matches('.cv')) track('cv_download', { place });
    else if (a.matches('.go')) track('project_open', { project: new URL(href, location.href).hostname, place });
    else if (a.matches('.wax')) {
      const channel = href.startsWith('mailto:') ? 'email' : href.includes('linkedin') ? 'linkedin'
        : href.includes('github') ? 'github' : href.includes('t.me') ? 'telegram' : href;
      track('contact_click', { channel, place });
    }
  }, { capture: true });
}

/* how far the visitor reads: a chapter counts once per page load, when it reaches the
   middle of the screen. Started on landing — during the scene the page sits under the
   poster and would count itself. */
let chapters: IntersectionObserver | null = null;
const seen = new Set<string>();
export function trackChapters() {
  if (!on || chapters) return;
  chapters = new IntersectionObserver(list => {
    for (const en of list) {
      const id = en.target.id;
      if (!en.isIntersecting || seen.has(id)) continue;
      seen.add(id); track('chapter_view', { chapter: id });
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  document.querySelectorAll('#site header[id], #site section[id]').forEach(s => chapters!.observe(s));
}
