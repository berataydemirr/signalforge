import { describe, expect, it } from 'vitest';
import { interpCubic, loopGains, wrapPi } from '../../src/dsp/sync/loop';
import { gardnerKd } from '../../src/dsp/sync/timing';
import { simulateBerPoint, simulateLink } from '../../src/engine/link';
import { theoreticalBer } from '../../src/dsp/theory/ber';
import type { Impairments } from '../../src/dsp/channel/impairments';

const base = { beta: 0.35, sps: 8, span: 10, nSym: 3000, seed: 7 };

describe('loop primitives', () => {
  it('cubic interpolation is exact for cubics', () => {
    const x = Float64Array.from({ length: 20 }, (_, i) => 0.1 * i ** 3 - i * i + 2);
    for (const t of [3.25, 7.5, 10.9]) expect(interpCubic(x, t)).toBeCloseTo(0.1 * t ** 3 - t * t + 2, 9);
  });

  it('wrapPi', () => {
    expect(wrapPi(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapPi(-0.5)).toBeCloseTo(-0.5, 12);
    expect(wrapPi(2 * Math.PI + 0.1)).toBeCloseTo(0.1, 9);
  });

  it('loop gains are small and positive for narrow loops', () => {
    const { kp, ki } = loopGains(0.01);
    expect(kp).toBeGreaterThan(0);
    expect(ki).toBeGreaterThan(0);
    expect(ki).toBeLessThan(kp);
    expect(gardnerKd(0.35)).toBeGreaterThan(0.9);
  });
});

describe('impairments without sync break the link', () => {
  it.each<[string, Partial<Impairments>]>([
    ['phase offset', { phaseDeg: 30 }],
    ['frequency offset', { cfo: 0.002 }],
    ['timing offset', { timing: 0.4 }],
  ])('%s', (_, m) => {
    const imp = { cfo: 0, phaseDeg: 0, linewidth: 0, timing: 0, ...m };
    const r = simulateLink({ ...base, mod: '16qam', ebN0dB: 16, imp });
    expect(r.ber).toBeGreaterThan(0.01);
  });
});

describe('receiver recovers the impairments', () => {
  const imp: Impairments = { cfo: 0.003, phaseDeg: 40, linewidth: 1e-4, timing: 0.35 };

  it('locks within the preamble and leaves small residual errors', () => {
    const r = simulateLink({ ...base, mod: 'qpsk', ebN0dB: 12, imp: { ...imp, linewidth: 3e-5 }, timingSync: true, carrierSync: true });
    expect(r.sync.lockAt).toBeGreaterThanOrEqual(0);
    expect(r.sync.lockAt).toBeLessThan(192);
    expect(r.sync.phaseRmsDeg).toBeLessThan(5);
    expect(r.sync.timingRms).toBeLessThan(0.05);
    expect(r.ber).toBeLessThan(1e-3);
  });

  it('tracks strong phase noise with bounded error', () => {
    const r = simulateLink({ ...base, mod: 'qpsk', ebN0dB: 12, imp, timingSync: true, carrierSync: true });
    expect(r.sync.phaseRmsDeg).toBeLessThan(8); // 1e-4 Rs linewidth: ~1.4 deg/symbol random walk
    expect(r.ber).toBeLessThan(1e-3);
  });

  it('16-QAM BER with full sync stays within 1 dB-equivalent of theory', () => {
    const db = 12;
    // Moderate phase noise: at 1e-4 Rs a decision-directed loop on 16-QAM cycle-slips (needs pilots).
    const imp16: Impairments = { ...imp, linewidth: 1e-5 };
    const p = simulateBerPoint(
      { mod: '16qam', beta: 0.35, sps: 4, span: 8, imp: imp16, timingSync: true, carrierSync: true },
      db,
      { targetErrors: 800, maxBits: 3_000_000 },
      11,
    );
    expect(p.ber).toBeLessThan(theoreticalBer('16qam', db - 1));
    expect(p.ber).toBeGreaterThan(theoreticalBer('16qam', db) * 0.85);
  });

  it('sync on an ideal channel costs almost nothing', () => {
    const db = 6;
    const p = simulateBerPoint(
      { mod: 'qpsk', beta: 0.35, sps: 4, span: 8, timingSync: true, carrierSync: true },
      db,
      { targetErrors: 1500, maxBits: 3_000_000 },
      5,
    );
    const ratio = p.ber / theoreticalBer('qpsk', db);
    expect(ratio).toBeGreaterThan(0.88);
    expect(ratio).toBeLessThan(1.25);
  });
});
