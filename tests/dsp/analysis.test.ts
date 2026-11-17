import { describe, expect, it } from 'vitest';
import { wilsonInterval } from '../../src/dsp/metrics/metrics';
import { residualIsiDb, rrcTaps } from '../../src/dsp/core/filters';
import { getConstellation, minDistance } from '../../src/dsp/modulation/constellation';
import { capacityPerHz, ebN0ForBer, shannonEbN0LimitDb, theoreticalBer, theoreticalSer } from '../../src/dsp/theory/ber';
import { qfunc } from '../../src/dsp/theory/qfunc';
import { simulateLink } from '../../src/engine/link';

describe('Wilson interval', () => {
  it('contains the point estimate and narrows with n', () => {
    const [lo1, hi1] = wilsonInterval(10, 1000);
    const [lo2, hi2] = wilsonInterval(100, 10000);
    expect(lo1).toBeLessThan(0.01);
    expect(hi1).toBeGreaterThan(0.01);
    expect(hi2 - lo2).toBeLessThan(hi1 - lo1);
  });

  it('is non-degenerate at zero errors', () => {
    const [lo, hi] = wilsonInterval(0, 1000);
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(0.002); // ~3.8/n
    expect(hi).toBeLessThan(0.005);
  });
});

describe('RRC truncation ISI', () => {
  it('falls as the filter span grows', () => {
    const a = residualIsiDb(rrcTaps(0.35, 8, 4), 8);
    const b = residualIsiDb(rrcTaps(0.35, 8, 8), 8);
    const c = residualIsiDb(rrcTaps(0.35, 8, 16), 8);
    expect(b).toBeLessThan(a);
    expect(c).toBeLessThan(b);
    expect(c).toBeLessThan(-40);
  });
});

describe('theory helpers', () => {
  it('minimum distances match closed forms', () => {
    expect(minDistance(getConstellation('bpsk'))).toBeCloseTo(2, 12);
    expect(minDistance(getConstellation('8psk'))).toBeCloseTo(2 * Math.sin(Math.PI / 8), 12);
    expect(minDistance(getConstellation('16qam'))).toBeCloseTo(2 / Math.sqrt(10), 12);
  });

  it('SER: BPSK exact, Gray QAM BER ~ SER / k at high SNR', () => {
    expect(theoreticalSer('bpsk', 6)).toBeCloseTo(qfunc(Math.sqrt(2 * 10 ** 0.6)), 6);
    const db = 14;
    const ratio = theoreticalBer('16qam', db) / (theoreticalSer('16qam', db + 10 * Math.log10(4)) / 4);
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(1.05);
  });

  it('BPSK needs ~9.59 dB for BER 1e-5', () => {
    expect(ebN0ForBer('bpsk', 1e-5)).toBeCloseTo(9.59, 1);
  });

  it('Shannon limit approaches -1.59 dB as eta -> 0 and is 0 dB at eta = 1', () => {
    expect(shannonEbN0LimitDb(1e-6)).toBeCloseTo(-1.592, 2);
    expect(shannonEbN0LimitDb(1)).toBeCloseTo(0, 9);
    expect(capacityPerHz(0, 0)).toBeCloseTo(1, 9);
  });
});

describe('measured SER agrees with theory', () => {
  it.each([
    ['qpsk', 4],
    ['16qam', 8],
  ] as const)('%s at %d dB', (mod, db) => {
    let se = 0;
    let ns = 0;
    let th = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const r = simulateLink({ mod, ebN0dB: db, beta: 0.35, sps: 4, span: 8, nSym: 4000, seed });
      se += r.symbolErrors;
      ns += 4000;
      th = r.serTheory;
    }
    expect(se).toBeGreaterThan(1500);
    const ratio = se / ns / th;
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });
});
