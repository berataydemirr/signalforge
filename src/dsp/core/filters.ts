import { CVec, cvec } from './complex';

/**
 * Root-raised-cosine impulse response, normalized to unit energy (sum h^2 = 1).
 *
 * With unit-energy taps, TX shaping followed by a matched RX filter gives a
 * raised-cosine (Nyquist) overall response whose peak equals 1, so a symbol of
 * energy Es survives the chain unscaled and the noise variance is unchanged.
 *
 * @param beta  roll-off factor, 0 < beta <= 1
 * @param sps   samples per symbol
 * @param span  filter length in symbols (taps = span * sps + 1)
 */
export function rrcTaps(beta: number, sps: number, span: number): Float64Array {
  if (!(beta > 0 && beta <= 1)) throw new Error('rrcTaps: beta must be in (0, 1]');
  if (!Number.isInteger(sps) || sps < 2) throw new Error('rrcTaps: sps must be an integer >= 2');
  const n = span * sps + 1;
  const h = new Float64Array(n);
  const mid = (n - 1) / 2;
  const singular = 1 / (4 * beta);

  for (let i = 0; i < n; i++) {
    const t = (i - mid) / sps; // time in symbol periods
    if (Math.abs(t) < 1e-12) {
      h[i] = 1 - beta + (4 * beta) / Math.PI;
    } else if (Math.abs(Math.abs(t) - singular) < 1e-9) {
      const a = Math.PI / (4 * beta);
      h[i] = (beta / Math.SQRT2) * ((1 + 2 / Math.PI) * Math.sin(a) + (1 - 2 / Math.PI) * Math.cos(a));
    } else {
      const num = Math.sin(Math.PI * t * (1 - beta)) + 4 * beta * t * Math.cos(Math.PI * t * (1 + beta));
      const den = Math.PI * t * (1 - (4 * beta * t) ** 2);
      h[i] = num / den;
    }
  }

  let e = 0;
  for (let i = 0; i < n; i++) e += h[i] * h[i];
  const g = 1 / Math.sqrt(e);
  for (let i = 0; i < n; i++) h[i] *= g;
  return h;
}

/**
 * Pulse shaping: equivalent to zero-stuffing by `sps` then convolving with `h`,
 * but done per symbol (O(nSym * taps) instead of O(nSym * sps * taps)).
 * Output length = nSym * sps + taps - 1 (full convolution, tails included).
 */
export function shapeSymbols(sym: CVec, h: Float64Array, sps: number): CVec {
  const nSym = sym.re.length;
  const nh = h.length;
  const y = cvec((nSym - 1) * sps + nh + (sps - 1));
  for (let i = 0; i < nSym; i++) {
    const sr = sym.re[i];
    const si = sym.im[i];
    const off = i * sps;
    for (let k = 0; k < nh; k++) {
      y.re[off + k] += sr * h[k];
      y.im[off + k] += si * h[k];
    }
  }
  return y;
}

/** Full linear convolution of a complex signal with real taps. Length = n + taps - 1. */
export function firFilter(x: CVec, h: Float64Array): CVec {
  const n = x.re.length;
  const nh = h.length;
  const y = cvec(n + nh - 1);
  for (let i = 0; i < n; i++) {
    const xr = x.re[i];
    const xi = x.im[i];
    if (xr === 0 && xi === 0) continue;
    for (let k = 0; k < nh; k++) {
      y.re[i + k] += xr * h[k];
      y.im[i + k] += xi * h[k];
    }
  }
  return y;
}
