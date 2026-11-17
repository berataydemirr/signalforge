/**
 * Validation: the full waveform-level link (RRC shaping, AWGN, matched filter,
 * slicer) must reproduce the closed-form BER curves.
 *
 * The tolerance is set from the statistics: with E errors counted, the relative
 * standard deviation of the BER estimate is about 1/sqrt(E). At E >= 1500, a
 * +-12% band is more than 4 sigma, plus a small allowance for the Gray / union
 * approximations used for 8-PSK and QAM.
 */
import { describe, expect, it } from 'vitest';
import { simulateBerPoint } from '../../src/engine/link';
import { theoreticalBer } from '../../src/dsp/theory/ber';
import type { ModId } from '../../src/dsp/modulation/constellation';

const cases: Array<[ModId, number[]]> = [
  ['bpsk', [2, 4, 6]],
  ['qpsk', [2, 4, 6]],
  ['8psk', [6, 8]],
  ['16qam', [6, 8]],
  ['64qam', [10, 12]],
];

describe.each(cases)('%s BER matches theory', (mod, points) => {
  it.each(points)('at Eb/N0 = %d dB', (db) => {
    const p = simulateBerPoint(
      { mod, beta: 0.35, sps: 4, span: 8 },
      db,
      { targetErrors: 1500, maxBits: 4_000_000 },
      2024,
    );
    const th = theoreticalBer(mod, db);
    expect(p.errors).toBeGreaterThanOrEqual(1500);
    const ratio = p.ber / th;
    expect(ratio).toBeGreaterThan(0.88);
    expect(ratio).toBeLessThan(1.12);
  });
});
