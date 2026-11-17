import { describe, expect, it } from 'vitest';
import {
  MODULATIONS,
  detectLabels,
  getConstellation,
  gray,
  grayInverse,
  labelsToBits,
  mapBits,
} from '../../src/dsp/modulation/constellation';
import { randomBits } from '../../src/dsp/source/bits';
import { mulberry32 } from '../../src/dsp/core/prng';
import { meanPower } from '../../src/dsp/core/complex';
import { qfunc } from '../../src/dsp/theory/qfunc';
import { theoreticalBer } from '../../src/dsp/theory/ber';

const popcount = (x: number) => {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
};

describe('Gray code', () => {
  it('inverse round-trips', () => {
    for (let n = 0; n < 1024; n++) expect(grayInverse(gray(n))).toBe(n);
  });
});

describe.each(MODULATIONS.map((m) => m.id))('constellation %s', (id) => {
  const c = getConstellation(id);

  it('has unit average symbol energy', () => {
    let e = 0;
    for (let b = 0; b < c.M; b++) e += c.re[b] ** 2 + c.im[b] ** 2;
    expect(e / c.M).toBeCloseTo(1, 12);
  });

  it('is Gray coded: nearest neighbours differ in exactly one bit', () => {
    let dmin = Infinity;
    for (let a = 0; a < c.M; a++)
      for (let b = a + 1; b < c.M; b++) dmin = Math.min(dmin, Math.hypot(c.re[a] - c.re[b], c.im[a] - c.im[b]));
    for (let a = 0; a < c.M; a++)
      for (let b = 0; b < c.M; b++) {
        if (a === b) continue;
        const d = Math.hypot(c.re[a] - c.re[b], c.im[a] - c.im[b]);
        if (d < dmin * 1.0001) expect(popcount(a ^ b)).toBe(1);
      }
  });

  it('map -> detect -> bits round-trips without noise', () => {
    const bits = randomBits(c.k * 5000, mulberry32(1));
    const sym = mapBits(bits, c);
    expect(meanPower(sym)).toBeCloseTo(1, 1);
    const back = labelsToBits(detectLabels(sym, c), c.k);
    expect(Array.from(back)).toEqual(Array.from(bits));
  });

  it('slicer agrees with brute-force minimum distance', () => {
    const rng = mulberry32(99);
    const n = 3000;
    const x = { re: new Float64Array(n), im: new Float64Array(n) };
    for (let i = 0; i < n; i++) {
      x.re[i] = (rng() - 0.5) * 3;
      x.im[i] = (rng() - 0.5) * 3;
    }
    const fast = detectLabels(x, c);
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bd = Infinity;
      for (let b = 0; b < c.M; b++) {
        const d = (x.re[i] - c.re[b]) ** 2 + (x.im[i] - c.im[b]) ** 2;
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      const dFast = (x.re[i] - c.re[fast[i]]) ** 2 + (x.im[i] - c.im[fast[i]]) ** 2;
      expect(dFast).toBeCloseTo(bd, 9); // equal distance (ties allowed)
      if (Math.abs(dFast - bd) > 1e-9) expect(fast[i]).toBe(best);
    }
  });
});

describe('theory', () => {
  it('Q-function reference values', () => {
    expect(qfunc(0)).toBeCloseTo(0.5, 7);
    expect(qfunc(1)).toBeCloseTo(0.158655254, 6);
    expect(qfunc(3)).toBeCloseTo(1.349898e-3, 8);
    expect(qfunc(-1)).toBeCloseTo(1 - 0.158655254, 6);
  });

  it('textbook BER values', () => {
    // BPSK at 9.6 dB is the classic 1e-5 point.
    expect(theoreticalBer('bpsk', 9.6)).toBeGreaterThan(0.9e-5);
    expect(theoreticalBer('bpsk', 9.6)).toBeLessThan(1.1e-5);
    expect(theoreticalBer('qpsk', 6)).toBeCloseTo(theoreticalBer('bpsk', 6), 12);
    // Higher order costs Eb/N0 at the same BER.
    for (const db of [4, 8, 12]) {
      expect(theoreticalBer('16qam', db)).toBeGreaterThan(theoreticalBer('qpsk', db));
      expect(theoreticalBer('64qam', db)).toBeGreaterThan(theoreticalBer('16qam', db));
      expect(theoreticalBer('8psk', db)).toBeGreaterThan(theoreticalBer('qpsk', db));
    }
  });
});
