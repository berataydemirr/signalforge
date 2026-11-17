import type { Rng } from '../core/prng';

/** i.i.d. equiprobable bits. */
export function randomBits(n: number, rng: Rng): Uint8Array {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = rng() < 0.5 ? 0 : 1;
  return b;
}

/** Number of positions where two bit arrays differ (over the shorter length). */
export function countBitErrors(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  let e = 0;
  for (let i = 0; i < n; i++) e += a[i] ^ b[i];
  return e;
}
