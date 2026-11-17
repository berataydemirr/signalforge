import { CVec, downsample } from '../dsp/core/complex';
import { firFilter, residualIsiDb, rrcTaps, shapeSymbols } from '../dsp/core/filters';
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
  minDistance,
} from '../dsp/modulation/constellation';
import { Psd, evmPercent, eyeTraces, snrFromEvmDb, welchPsd, wilsonInterval } from '../dsp/metrics/metrics';
import {
  capacityPerHz,
  shannonEbN0LimitDb,
  theoreticalBer,
  theoreticalSer,
} from '../dsp/theory/ber';

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
  symbolErrors: number;
  delay: number;
  taps: Float64Array;
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
  let symbolErrors = 0;
  for (let s = 0; s < p.nSym; s++) {
    for (let j = 0; j < c.k; j++) {
      if (bits[s * c.k + j] !== rxBits[s * c.k + j]) {
        symbolErrors++;
        break;
      }
    }
  }
  return { c, bits, txSym, txWave, rxWave, mf, rxSym, labels, rxBits, bitErrors, symbolErrors, delay, taps };
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
  /** 95% Wilson confidence interval of the frame BER. */
  berCi: [number, number];
  symbolErrors: number;
  ser: number;
  serTheory: number;
  /** Noise density per complex sample, and std. dev. per real dimension. */
  n0: number;
  sigma: number;
  dmin: number;
  nTaps: number;
  /** Residual ISI from RRC truncation, dB re. peak. */
  isiDb: number;
  /** Highest TX PSD level outside the occupied band, dB re. passband. */
  stopbandDb: number;
  /** Shannon capacity of the occupied band at this Es/N0, bit/s/Hz. */
  capacity: number;
  /** Shannon limit on Eb/N0 for eta = k bit/s/Hz (Nyquist-band signalling), dB. */
  shannonLimitDb: number;
  psdTx: Psd;
  psdRx: Psd;
  eye: Float64Array[];
}

function stopbandLevelDb(psd: Psd, sps: number, beta: number): number {
  const edge = (1 + beta) / 2 + 0.1; // a little beyond the band edge
  let max = -Infinity;
  for (let i = 0; i < psd.freq.length; i++) if (Math.abs(psd.freq[i] * sps) > edge) max = Math.max(max, psd.db[i]);
  return max;
}

/** One frame through the link, plus every measurement the scopes need. */
export function simulateLink(p: LinkParams): LinkResult {
  const r = runCore(p);
  const nBits = p.nSym * r.c.k;
  const evm = evmPercent(r.rxSym, labelsToSymbols(r.labels, r.c));
  const esN0dB = p.ebN0dB + 10 * Math.log10(r.c.k);
  const n0 = n0FromEbN0(p.ebN0dB, r.c.k);
  const psdTx = welchPsd(r.txWave, 512);
  return {
    params: p,
    constellation: r.c,
    rxSym: r.rxSym,
    bitErrors: r.bitErrors,
    nBits,
    ber: r.bitErrors / nBits,
    berTheory: theoreticalBer(p.mod, p.ebN0dB),
    berCi: wilsonInterval(r.bitErrors, nBits),
    symbolErrors: r.symbolErrors,
    ser: r.symbolErrors / p.nSym,
    serTheory: theoreticalSer(p.mod, esN0dB),
    evmPct: evm,
    snrEstDb: snrFromEvmDb(evm),
    esN0dB,
    n0,
    sigma: Math.sqrt(n0 / 2),
    dmin: minDistance(r.c),
    nTaps: r.taps.length,
    isiDb: residualIsiDb(r.taps, p.sps),
    stopbandDb: stopbandLevelDb(psdTx, p.sps, p.beta),
    capacity: capacityPerHz(esN0dB, p.beta),
    shannonLimitDb: shannonEbN0LimitDb(r.c.k),
    psdTx,
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
