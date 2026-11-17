import { describe, expect, it } from 'vitest';
import { fft } from '../../src/dsp/core/fft';
import { firFilter, rrcTaps, shapeSymbols } from '../../src/dsp/core/filters';
import { Gaussian, mulberry32 } from '../../src/dsp/core/prng';
import { cvec } from '../../src/dsp/core/complex';

describe('fft', () => {
  it('matches a direct DFT', () => {
    const n = 64;
    const rng = mulberry32(42);
    const re = new Float64Array(n).map(() => rng() - 0.5);
    const im = new Float64Array(n).map(() => rng() - 0.5);
    const xr = re.slice();
    const xi = im.slice();
    fft(xr, xi);
    for (let k = 0; k < n; k++) {
      let sr = 0;
      let si = 0;
      for (let t = 0; t < n; t++) {
        const a = (-2 * Math.PI * k * t) / n;
        sr += re[t] * Math.cos(a) - im[t] * Math.sin(a);
        si += re[t] * Math.sin(a) + im[t] * Math.cos(a);
      }
      expect(xr[k]).toBeCloseTo(sr, 10);
      expect(xi[k]).toBeCloseTo(si, 10);
    }
  });

  it('inverse undoes forward', () => {
    const re = Float64Array.from({ length: 256 }, (_, i) => Math.sin(i));
    const im = Float64Array.from({ length: 256 }, (_, i) => Math.cos(3 * i));
    const r2 = re.slice();
    const i2 = im.slice();
    fft(r2, i2);
    fft(r2, i2, true);
    for (let i = 0; i < 256; i++) {
      expect(r2[i]).toBeCloseTo(re[i], 12);
      expect(i2[i]).toBeCloseTo(im[i], 12);
    }
  });

  it('rejects non power-of-two lengths', () => {
    expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow();
  });
});

describe('RRC filter', () => {
  it('has unit energy and is symmetric', () => {
    for (const beta of [0.1, 0.25, 0.35, 0.5, 1]) {
      const h = rrcTaps(beta, 8, 10);
      let e = 0;
      for (const v of h) e += v * v;
      expect(e).toBeCloseTo(1, 12);
      for (let i = 0; i < h.length; i++) expect(h[i]).toBeCloseTo(h[h.length - 1 - i], 12);
    }
  });

  it('RRC * RRC is a Nyquist pulse (zero ISI at symbol instants)', () => {
    const sps = 8;
    const h = rrcTaps(0.35, sps, 16);
    const impulse = cvec(1);
    impulse.re[0] = 1;
    const rc = firFilter(firFilter(impulse, h), h).re;
    const mid = h.length - 1;
    expect(rc[mid]).toBeCloseTo(1, 6);
    for (let m = 1; m <= 6; m++) {
      expect(Math.abs(rc[mid + m * sps])).toBeLessThan(5e-3);
      expect(Math.abs(rc[mid - m * sps])).toBeLessThan(5e-3);
    }
  });

  it('handles the t = 1/(4 beta) singularity', () => {
    // beta = 0.25, sps = 4 puts a tap exactly at t = 1 symbol = 1/(4*0.25).
    const h = rrcTaps(0.25, 4, 8);
    for (const v of h) expect(Number.isFinite(v)).toBe(true);
  });

  it('shapeSymbols equals zero-stuffing + convolution', () => {
    const sps = 4;
    const h = rrcTaps(0.5, sps, 6);
    const sym = cvec(5);
    sym.re.set([1, -1, 1, 1, -1]);
    sym.im.set([0.5, 0.5, -0.5, 0, 1]);
    const up = cvec(5 * sps);
    for (let i = 0; i < 5; i++) {
      up.re[i * sps] = sym.re[i];
      up.im[i * sps] = sym.im[i];
    }
    const ref = firFilter(up, h);
    const fast = shapeSymbols(sym, h, sps);
    // Reference has (sps-1) trailing zeros that never get signal; compare the common span.
    for (let i = 0; i < fast.re.length; i++) {
      expect(fast.re[i]).toBeCloseTo(ref.re[i] ?? 0, 12);
      expect(fast.im[i]).toBeCloseTo(ref.im[i] ?? 0, 12);
    }
  });
});

describe('PRNG', () => {
  it('is reproducible', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('Gaussian has zero mean and unit variance', () => {
    const g = new Gaussian(mulberry32(123));
    const n = 200_000;
    let s = 0;
    let s2 = 0;
    for (let i = 0; i < n; i++) {
      const v = g.next();
      s += v;
      s2 += v * v;
    }
    expect(Math.abs(s / n)).toBeLessThan(0.01);
    expect(s2 / n).toBeCloseTo(1, 1);
  });
});
