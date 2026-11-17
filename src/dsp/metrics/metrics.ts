import { CVec } from '../core/complex';
import { fft } from '../core/fft';

/** RMS error-vector magnitude, in percent of the reference RMS. */
export function evmPercent(rx: CVec, ref: CVec): number {
  const n = Math.min(rx.re.length, ref.re.length);
  let e = 0;
  let p = 0;
  for (let i = 0; i < n; i++) {
    const dr = rx.re[i] - ref.re[i];
    const di = rx.im[i] - ref.im[i];
    e += dr * dr + di * di;
    p += ref.re[i] * ref.re[i] + ref.im[i] * ref.im[i];
  }
  return p === 0 ? 0 : 100 * Math.sqrt(e / p);
}

/**
 * Wilson score interval for a binomial proportion k/n (default 95%).
 * Well-behaved for small k, unlike the normal approximation.
 */
export function wilsonInterval(k: number, n: number, z = 1.959964): [number, number] {
  if (n <= 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / den;
  const h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return [k === 0 ? 0 : Math.max(0, c - h), k === n ? 1 : Math.min(1, c + h)];
}

/** Decision-directed Es/N0 estimate from EVM: SNR = 1 / EVM^2 (valid when decisions are mostly correct). */
export function snrFromEvmDb(evmPct: number): number {
  const e = evmPct / 100;
  return e > 0 ? -20 * Math.log10(e) : Infinity;
}

export interface Psd {
  /** Normalized frequency in cycles/sample, from -0.5 to 0.5 (fftshifted). */
  freq: Float64Array;
  /** Power in dB, normalized so the maximum bin is 0 dB. */
  db: Float64Array;
}

/** Welch PSD estimate: Hann window, 50% overlap, averaged periodograms. */
export function welchPsd(x: CVec, nfft = 512): Psd {
  const n = x.re.length;
  const hop = nfft >> 1;
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / nfft);

  const acc = new Float64Array(nfft);
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  let segs = 0;
  for (let start = 0; start + nfft <= n; start += hop) {
    for (let i = 0; i < nfft; i++) {
      re[i] = x.re[start + i] * win[i];
      im[i] = x.im[start + i] * win[i];
    }
    fft(re, im);
    for (let i = 0; i < nfft; i++) acc[i] += re[i] * re[i] + im[i] * im[i];
    segs++;
  }

  const freq = new Float64Array(nfft);
  const db = new Float64Array(nfft);
  let max = -Infinity;
  for (let i = 0; i < nfft; i++) {
    const src = (i + hop) % nfft; // fftshift
    freq[i] = (i - hop) / nfft;
    db[i] = 10 * Math.log10(acc[src] / Math.max(segs, 1) + 1e-30);
    if (db[i] > max) max = db[i];
  }
  for (let i = 0; i < nfft; i++) db[i] -= max;
  return { freq, db };
}

/**
 * Eye-diagram traces of the real part of `x`: each trace spans 2 symbol periods
 * centered on a symbol's sampling instant (index `first + s * sps`).
 */
export function eyeTraces(
  x: Float64Array,
  first: number,
  sps: number,
  nSym: number,
  maxTraces = 300,
): Float64Array[] {
  const traces: Float64Array[] = [];
  const len = 2 * sps + 1;
  for (let s = 1; s < nSym - 1 && traces.length < maxTraces; s++) {
    const c = first + s * sps;
    const t = new Float64Array(len);
    for (let i = 0; i < len; i++) t[i] = x[c - sps + i];
    traces.push(t);
  }
  return traces;
}
