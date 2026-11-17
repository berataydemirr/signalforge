import { CVec, cvec } from '../core/complex';
import type { Gaussian } from '../core/prng';

/**
 * Noise spectral density N0 for a target Eb/N0, given Es = 1 and k bits/symbol.
 *
 * Discrete-time convention: with unit-energy shaping and matched filters, a
 * complex white noise of total variance N0 per sample appears with variance N0
 * at the matched-filter output, so the decision SNR is exactly Es/N0.
 */
export function n0FromEbN0(ebN0dB: number, k: number): number {
  return 1 / (k * Math.pow(10, ebN0dB / 10));
}

/** y = x + w, w ~ CN(0, n0) i.i.d. (variance n0/2 per real dimension). */
export function addAwgn(x: CVec, n0: number, g: Gaussian): CVec {
  const n = x.re.length;
  const y = cvec(n);
  const sigma = Math.sqrt(n0 / 2);
  for (let i = 0; i < n; i++) {
    y.re[i] = x.re[i] + sigma * g.next();
    y.im[i] = x.im[i] + sigma * g.next();
  }
  return y;
}
