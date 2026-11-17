import { MODULATIONS, ModId } from '../dsp/modulation/constellation';
import { NO_IMPAIRMENTS } from '../dsp/channel/impairments';
import type { LinkParams } from '../engine/link';

/** Shareable links: every link parameter round-trips through the query string. */
export function paramsFromUrl(defaults: LinkParams): { params: LinkParams; autoSweep: boolean; tab: string | null } {
  const params: LinkParams = { ...defaults, imp: { ...(defaults.imp ?? NO_IMPAIRMENTS) } };
  let autoSweep = false;
  let tab: string | null = null;
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
    const imp = params.imp!;
    imp.cfo = num('cfo', -0.01, 0.01) ?? imp.cfo;
    imp.phaseDeg = num('ph', -180, 180) ?? imp.phaseDeg;
    imp.linewidth = num('pn', 0, 1e-4) ?? imp.linewidth;
    imp.timing = num('tau', -0.5, 0.5) ?? imp.timing;
    if (q.has('ts')) params.timingSync = q.get('ts') === '1';
    if (q.has('cs')) params.carrierSync = q.get('cs') === '1';
    autoSweep = q.get('sweep') === '1';
    tab = q.get('tab');
  } catch {
    /* malformed URL: keep defaults */
  }
  return { params, autoSweep, tab };
}

export function writeParamsToUrl(p: LinkParams): void {
  try {
    const q = new URLSearchParams();
    const imp = p.imp ?? NO_IMPAIRMENTS;
    q.set('mod', p.mod);
    q.set('ebn0', String(p.ebN0dB));
    q.set('beta', String(p.beta));
    q.set('sps', String(p.sps));
    q.set('span', String(p.span));
    if (imp.cfo) q.set('cfo', String(imp.cfo));
    if (imp.phaseDeg) q.set('ph', String(imp.phaseDeg));
    if (imp.linewidth) q.set('pn', String(imp.linewidth));
    if (imp.timing) q.set('tau', String(imp.timing));
    if (p.timingSync) q.set('ts', '1');
    if (p.carrierSync) q.set('cs', '1');
    const theme = new URLSearchParams(window.location.search).get('theme');
    if (theme) q.set('theme', theme);
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
  } catch {
    /* history API unavailable (sandboxed iframe): sharing just won't update */
  }
}
