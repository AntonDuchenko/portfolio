/* ?perf — frame times per phase, for measuring on a real device (the cloud container has
   no GPU, so jank on phones cannot be reproduced there). Uses its own rAF loop, so it
   keeps measuring after the scene loop stops at landing. The report appears 4 s after
   landing: frames, mean fps, the worst frame and frames over 50 ms, per phase. */

export const perfEnabled = new URLSearchParams(location.search).has('perf');

interface Stat { n: number; sum: number; worst: number; long: number }
const stats = new Map<string, Stat>();

export function startPerf(phase: () => string, info: () => Record<string, string | number>) {
  if (!perfEnabled) return;
  let last = performance.now(), landedAt = -1;
  const tick = (now: number) => {
    const dt = now - last; last = now;
    const p = phase();
    if (!document.hidden && dt < 5000) {
      let s = stats.get(p);
      if (!s) stats.set(p, s = { n: 0, sum: 0, worst: 0, long: 0 });
      s.n++; s.sum += dt; s.worst = Math.max(s.worst, dt); if (dt > 50) s.long++;
    }
    if (p === 'site' && landedAt < 0) landedAt = now;
    if (landedAt >= 0 && now - landedAt > 4000) { report(info()); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function report(info: Record<string, string | number>) {
  const rows = [...stats].map(([p, s]) =>
    `${p.padEnd(6)} ${String(s.n).padStart(5)} ${(1000 / (s.sum / s.n)).toFixed(0).padStart(5)} ` +
    `${s.worst.toFixed(0).padStart(6)} ${String(s.long).padStart(5)}`);
  const box = document.createElement('pre');
  box.textContent = [
    Object.entries(info).map(([k, v]) => `${k}: ${v}`).join('  '),
    'phase  frames   fps  worst  >50ms', ...rows, '(tap to close)'
  ].join('\n');
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:100;margin:0;padding:10px 12px;' +
    'background:rgba(0,0,0,.85);color:#e8e0cc;font:12px/1.45 ui-monospace,monospace;' +
    'border:1px solid #d9a84e;border-radius:4px;white-space:pre;max-width:calc(100vw - 16px);overflow:auto';
  box.addEventListener('click', () => box.remove());
  document.body.append(box);
}
