import { CVec, cvec } from '../core/complex';
import type { Gaussian } from '../core/prng';

/** Front-end impairments, all normalized to the symbol rate Rs or symbol period T. */
export interface Impairments {
  /** Carrier frequency offset, in units of Rs. */
  cfo: number;
  /** Static carrier phase offset, degrees. */
  phaseDeg: number;
  /** Oscillator 3 dB linewidth (Wiener phase noise), in units of Rs. */
  linewidth: number;
  /** Sampling-time offset, in units of T (fraction of a symbol). */
  timing: number;
}

export const NO_IMPAIRMENTS: Impairments = { cfo: 0, phaseDeg: 0, linewidth: 0, timing: 0 };

export const hasCarrierImpairment = (m: Impairments) => m.cfo !== 0 || m.phaseDeg !== 0 || m.linewidth > 0;

/**
 * y[n] = x[n] e^{j phi[n]},  phi[n] = phi0 + 2 pi (cfo / sps) n + theta[n]
 * where theta is a Wiener process with increment variance 2 pi (linewidth / sps).
 * Returns the applied phase so the receiver's estimates can be compared to the truth.
 */
export function applyCarrierImpairments(
  x: CVec,
  m: Impairments,
  sps: number,
  g: Gaussian,
): { y: CVec; phase: Float64Array } {
  const n = x.re.length;
  const y = cvec(n);
  const phase = new Float64Array(n);
  const phi0 = (m.phaseDeg * Math.PI) / 180;
  const dphi = (2 * Math.PI * m.cfo) / sps;
  const sigma = Math.sqrt((2 * Math.PI * m.linewidth) / sps);
  let walk = 0;
  for (let i = 0; i < n; i++) {
    const p = phi0 + dphi * i + walk;
    phase[i] = p;
    if (sigma > 0) walk += sigma * g.next();
    const c = Math.cos(p);
    const s = Math.sin(p);
    y.re[i] = x.re[i] * c - x.im[i] * s;
    y.im[i] = x.re[i] * s + x.im[i] * c;
  }
  return { y, phase };
}
