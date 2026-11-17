import { CVec, cvec } from '../core/complex';

export type ModId = 'bpsk' | 'qpsk' | '8psk' | '16qam' | '64qam' | '256qam';

export interface ModInfo {
  id: ModId;
  label: string;
  kind: 'psk' | 'qam';
  M: number;
}

export const MODULATIONS: readonly ModInfo[] = [
  { id: 'bpsk', label: 'BPSK', kind: 'psk', M: 2 },
  { id: 'qpsk', label: 'QPSK', kind: 'psk', M: 4 },
  { id: '8psk', label: '8-PSK', kind: 'psk', M: 8 },
  { id: '16qam', label: '16-QAM', kind: 'qam', M: 16 },
  { id: '64qam', label: '64-QAM', kind: 'qam', M: 64 },
  { id: '256qam', label: '256-QAM', kind: 'qam', M: 256 },
];

export function modInfo(id: ModId): ModInfo {
  const m = MODULATIONS.find((x) => x.id === id);
  if (!m) throw new Error(`unknown modulation ${id}`);
  return m;
}

/**
 * A Gray-coded constellation with unit average symbol energy (Es = 1).
 * `re[b], im[b]` is the point carrying the k-bit label `b` (MSB first).
 */
export interface Constellation extends ModInfo {
  k: number;
  re: Float64Array;
  im: Float64Array;
  /** PSK: phase offset of point 0. QAM: amplitude scale of the unit-spaced grid. */
  param: number;
}

export const gray = (n: number): number => n ^ (n >> 1);

export function grayInverse(g: number): number {
  let n = 0;
  for (; g; g >>= 1) n ^= g;
  return n;
}

const cache = new Map<ModId, Constellation>();

export function getConstellation(id: ModId): Constellation {
  const hit = cache.get(id);
  if (hit) return hit;
  const info = modInfo(id);
  const { M } = info;
  const k = Math.log2(M);
  const re = new Float64Array(M);
  const im = new Float64Array(M);
  let param: number;

  if (info.kind === 'psk') {
    // QPSK sits on the diagonals (pi/4), the conventional orientation.
    param = M === 4 ? Math.PI / 4 : 0;
    for (let b = 0; b < M; b++) {
      const m = grayInverse(b);
      const a = param + (2 * Math.PI * m) / M;
      re[b] = Math.cos(a);
      im[b] = Math.sin(a);
    }
  } else {
    // Square QAM = two Gray-coded sqrt(M)-PAM axes; high bits -> I, low bits -> Q.
    const L = Math.round(Math.sqrt(M));
    const half = k / 2;
    param = 1 / Math.sqrt((2 * (M - 1)) / 3); // makes Es = 1
    for (let b = 0; b < M; b++) {
      const i = grayInverse(b >> half);
      const q = grayInverse(b & (L - 1));
      re[b] = (2 * i - L + 1) * param;
      im[b] = (2 * q - L + 1) * param;
    }
  }

  const c: Constellation = { ...info, k, re, im, param };
  cache.set(id, c);
  return c;
}

/** Map bits (MSB first, k per symbol) to complex symbols. Trailing bits that don't fill a symbol are ignored. */
export function mapBits(bits: Uint8Array, c: Constellation): CVec {
  const nSym = Math.floor(bits.length / c.k);
  const y = cvec(nSym);
  for (let s = 0; s < nSym; s++) {
    let label = 0;
    for (let j = 0; j < c.k; j++) label = (label << 1) | bits[s * c.k + j];
    y.re[s] = c.re[label];
    y.im[s] = c.im[label];
  }
  return y;
}

/** Hard-decision (minimum-distance) detection, returning symbol labels. O(1) per symbol. */
export function detectLabels(x: CVec, c: Constellation): Uint16Array {
  const n = x.re.length;
  const out = new Uint16Array(n);
  if (c.kind === 'psk') {
    const M = c.M;
    const step = (2 * Math.PI) / M;
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(x.im[i], x.re[i]) - c.param;
      const m = ((Math.round(a / step) % M) + M) % M;
      out[i] = gray(m);
    }
  } else {
    const L = Math.round(Math.sqrt(c.M));
    const half = c.k / 2;
    const inv = 1 / c.param;
    const slice = (v: number) => {
      const idx = Math.round((v * inv + L - 1) / 2);
      return gray(idx < 0 ? 0 : idx > L - 1 ? L - 1 : idx);
    };
    for (let i = 0; i < n; i++) out[i] = (slice(x.re[i]) << half) | slice(x.im[i]);
  }
  return out;
}

/** Expand labels back into bits (MSB first). */
export function labelsToBits(labels: Uint16Array, k: number): Uint8Array {
  const bits = new Uint8Array(labels.length * k);
  for (let s = 0; s < labels.length; s++) {
    const l = labels[s];
    for (let j = 0; j < k; j++) bits[s * k + j] = (l >> (k - 1 - j)) & 1;
  }
  return bits;
}

/** The ideal constellation point for each detected label (used for EVM and decision-directed metrics). */
export function labelsToSymbols(labels: Uint16Array, c: Constellation): CVec {
  const y = cvec(labels.length);
  for (let i = 0; i < labels.length; i++) {
    y.re[i] = c.re[labels[i]];
    y.im[i] = c.im[labels[i]];
  }
  return y;
}
