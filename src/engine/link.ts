import { CVec, downsample } from '../dsp/core/complex';
import { firFilter, rrcTaps, shapeSymbols } from '../dsp/core/filters';
import { Gaussian, mulberry32 } from '../dsp/core/prng';
import { addAwgn, n0FromEbN0 } from '../dsp/channel/awgn';
import { countBitErrors, randomBits } from '../dsp/source/bits';
import {
  Constellation,
  ModId,
  detectLabels,
  getConstellation,
  labelsToBits,
  labelsToSymbols,
  mapBits,
} from '../dsp/modulation/constellation';
import { Psd, evmPercent, eyeTraces, snrFromEvmDb, welchPsd } from '../dsp/metrics/metrics';
import { theoreticalBer } from '../dsp/theory/ber';

export interface LinkParams {
  mod: ModId;
  ebN0dB: number;
  /** RRC roll-off. */
  beta: number;
  /** Samples per symbol. */
  sps: number;
  /** RRC span in symbols. */
  span: number;
  /** Symbols per frame. */
  nSym: number;
  seed: number;
}

interface CoreResult {
  c: Constellation;
  bits: Uint8Array;
  txSym: CVec;
  txWave: CVec;
  rxWave: CVec;
  mf: CVec;
  rxSym: CVec;
  labels: Uint16Array;
  rxBits: Uint8Array;
  bitErrors: number;
  delay: number;
}

/**
 * The complete M1 link, at waveform level:
 *   bits -> Gray mapper -> RRC shaping -> AWGN -> matched RRC filter -> sampler -> slicer -> bits
 */
function runCore(p: LinkParams, h?: Float64Array): CoreResult {
  const c = getConstellation(p.mod);
  const rng = mulberry32(p.seed);
  const gauss = new Gaussian(mulberry32((p.seed ^ 0x9e3779b9) >>> 0));
  const taps = h ?? rrcTaps(p.beta, p.sps, p.span);

  const bits = randomBits(p.nSym * c.k, rng);
  const txSym = mapBits(bits, c);
  const txWave = shapeSymbols(txSym, taps, p.sps);
  const rxWave = addAwgn(txWave, n0FromEbN0(p.ebN0dB, c.k), gauss);
  const mf = firFilter(rxWave, taps);
  const delay = taps.length - 1; // two filters, each with (taps-1)/2 group delay
  const rxSym = downsample(mf, delay, p.sps, p.nSym);
  const labels = detectLabels(rxSym, c);
  const rxBits = labelsToBits(labels, c.k);
  const bitErrors = countBitErrors(bits, rxBits);
  return { c, bits, txSym, txWave, rxWave, mf, rxSym, labels, rxBits, bitErrors, delay };
}

export interface LinkResult {
  params: LinkParams;
  constellation: Constellation;
  rxSym: CVec;
  bitErrors: number;
  nBits: number;
  ber: number;
  berTheory: number;
  evmPct: number;
  /** Decision-directed Es/N0 estimate from EVM, dB. */
  snrEstDb: number;
  /** Ideal Es/N0 for the configured Eb/N0, dB. */
  esN0dB: number;
  psdTx: Psd;
  psdRx: Psd;
  eye: Float64Array[];
}

/** One frame through the link, plus every measurement the scopes need. */
export function simulateLink(p: LinkParams): LinkResult {
  const r = runCore(p);
  const nBits = p.nSym * r.c.k;
  const evm = evmPercent(r.rxSym, labelsToSymbols(r.labels, r.c));
  return {
    params: p,
    constellation: r.c,
    rxSym: r.rxSym,
    bitErrors: r.bitErrors,
    nBits,
    ber: r.bitErrors / nBits,
    berTheory: theoreticalBer(p.mod, p.ebN0dB),
    evmPct: evm,
    snrEstDb: snrFromEvmDb(evm),
    esN0dB: p.ebN0dB + 10 * Math.log10(r.c.k),
    psdTx: welchPsd(r.txWave, 512),
    psdRx: welchPsd(r.rxWave, 512),
    eye: eyeTraces(r.mf.re, r.delay, p.sps, p.nSym, 250),
  };
}

export interface BerPoint {
  mod: ModId;
  ebN0dB: number;
  errors: number;
  bits: number;
  ber: number;
}

export interface BerPointOptions {
  /** Stop once this many bit errors are seen (sets the statistical confidence). */
  targetErrors: number;
  /** Hard cap on simulated bits. */
  maxBits: number;
  /** Symbols per simulated frame. */
  frameSym?: number;
}

/**
 * Monte Carlo BER at one Eb/N0, run on the full waveform-level link
 * (not a symbol-level shortcut), frame after frame until enough errors are seen.
 */
export function simulateBerPoint(
  base: Omit<LinkParams, 'ebN0dB' | 'nSym' | 'seed'>,
  ebN0dB: number,
  opts: BerPointOptions,
  seed = 1,
): BerPoint {
  const frameSym = opts.frameSym ?? 4096;
  const taps = rrcTaps(base.beta, base.sps, base.span);
  let errors = 0;
  let bits = 0;
  let frame = 0;
  while (errors < opts.targetErrors && bits < opts.maxBits) {
    const r = runCore({ ...base, ebN0dB, nSym: frameSym, seed: (seed * 7919 + frame * 104729) >>> 0 }, taps);
    errors += r.bitErrors;
    bits += r.bits.length;
    frame++;
  }
  return { mod: base.mod, ebN0dB, errors, bits, ber: bits ? errors / bits : 0 };
}
