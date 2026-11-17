import { MODULATIONS, ModId } from '../dsp/modulation/constellation';
import type { LinkParams } from '../engine/link';

/** Shareable links: every link parameter round-trips through the query string. */
export function paramsFromUrl(defaults: LinkParams): { params: LinkParams; autoSweep: boolean } {
  const params = { ...defaults };
  let autoSweep = false;
  try {
    const q = new URLSearchParams(window.location.search);
    const num = (key: string, min: number, max: number) => {
      const v = Number(q.get(key));
      return q.has(key) && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;
    };
    const mod = q.get('mod');
    if (mod && MODULATIONS.some((m) => m.id === mod)) params.mod = mod as ModId;
    params.ebN0dB = num('ebn0', -4, 34) ?? params.ebN0dB;
    params.beta = num('beta', 0.05, 1) ?? params.beta;
    const sps = num('sps', 4, 16);
    if (sps === 4 || sps === 8 || sps === 16) params.sps = sps;
    const span = num('span', 4, 16);
    if (span !== undefined) params.span = Math.round(span / 2) * 2;
    autoSweep = q.get('sweep') === '1';
  } catch {
    /* malformed URL: keep defaults */
  }
  return { params, autoSweep };
}

export function writeParamsToUrl(p: LinkParams): void {
  try {
    const q = new URLSearchParams(window.location.search);
    q.set('mod', p.mod);
    q.set('ebn0', String(p.ebN0dB));
    q.set('beta', String(p.beta));
    q.set('sps', String(p.sps));
    q.set('span', String(p.span));
    q.delete('sweep');
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
  } catch {
    /* history API unavailable (sandboxed iframe): sharing just won't update */
  }
}
