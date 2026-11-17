import { CVec, cvec, downsample } from '../dsp/core/complex';
import { firFilter, residualIsiDb, rrcTaps, shapeSymbols } from '../dsp/core/filters';
import { Gaussian, mulberry32 } from '../dsp/core/prng';
import { addAwgn, n0FromEbN0 } from '../dsp/channel/awgn';
import {
  Impairments,
  NO_IMPAIRMENTS,
  applyCarrierImpairments,
  hasCarrierImpairment,
} from '../dsp/channel/impairments';
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
import { capacityPerHz, shannonEbN0LimitDb, theoreticalBer, theoreticalSer } from '../dsp/theory/ber';
import { gardnerTiming } from '../dsp/sync/timing';
import { PREAMBLE_LEN, carrierRecovery, preamble } from '../dsp/sync/carrier';
import { wrapPi } from '../dsp/sync/loop';

export interface LinkParams {
  mod: ModId;
  ebN0dB: number;
  /** RRC roll-off. */
  beta: number;
  /** Samples per symbol. */
  sps: number;
  /** RRC span in symbols. */
  span: number;
  /** Payload symbols per frame (a known preamble is prepended). */
  nSym: number;
  seed: number;
  imp?: Impairments;
  timingSync?: boolean;
  carrierSync?: boolean;
}

interface CoreResult {
  c: Constellation;
  bits: Uint8Array;
  txWave: CVec;
  rxWave: CVec;
  mf: CVec;
  /** Payload symbols after the receiver (timing + carrier recovery when enabled). */
  rxSym: CVec;
  labels: Uint16Array;
  bitErrors: number;
  symbolErrors: number;
  delay: number;
  taps: Float64Array;
  /** Per frame symbol (preamble + payload): phase error and timing error of the receiver. */
  phaseErr: Float64Array;
  timingErr: Float64Array;
}

function concat(a: CVec, b: CVec): CVec {
  const y = cvec(a.re.length + b.re.length);
  y.re.set(a.re);
  y.re.set(b.re, a.re.length);
  y.im.set(a.im);
  y.im.set(b.im, a.re.length);
  return y;
}

/**
 * The complete link, at waveform level:
 *   [preamble | Gray-mapped payload] -> RRC -> timing offset -> CFO / phase noise -> AWGN
 *   -> matched RRC -> (Gardner timing recovery) -> (carrier PLL) -> slicer -> bits
 */
function runCore(p: LinkParams, h?: Float64Array): CoreResult {
  const c = getConstellation(p.mod);
  const imp = p.imp ?? NO_IMPAIRMENTS;
  const rng = mulberry32(p.seed);
  const gauss = new Gaussian(mulberry32((p.seed ^ 0x9e3779b9) >>> 0));
  const taps = h ?? rrcTaps(p.beta, p.sps, p.span);
  const pre = preamble();
  const nTot = PREAMBLE_LEN + p.nSym;

  const bits = randomBits(p.nSym * c.k, rng);
  const txSym = concat(pre, mapBits(bits, c));

  // Timing offset: the transmit pulse is delayed by tau*T relative to the receiver's clock.
  const txTaps = imp.timing !== 0 ? rrcTaps(p.beta, p.sps, p.span, imp.timing * p.sps) : taps;
  const txWave = shapeSymbols(txSym, txTaps, p.sps);

  let channelIn = txWave;
  let truePhase: Float64Array | null = null;
  if (hasCarrierImpairment(imp)) {
    const pg = new Gaussian(mulberry32((p.seed ^ 0x2545f491) >>> 0));
    const r = applyCarrierImpairments(txWave, imp, p.sps, pg);
    channelIn = r.y;
    truePhase = r.phase;
  }
  const rxWave = addAwgn(channelIn, n0FromEbN0(p.ebN0dB, c.k), gauss);
  const mf = firFilter(rxWave, taps);
  const delay = taps.length - 1; // two filters, each with (taps-1)/2 group delay

  let sym: CVec;
  let tauHat: Float64Array | null = null;
  if (p.timingSync) {
    // Wide timing loop for the first half of the preamble, so carrier acquisition
    // (data-aided over the preamble) sees settled timing for its second half.
    const t = gardnerTiming(mf, delay, p.sps, nTot, p.beta, PREAMBLE_LEN / 2);
    sym = t.sym;
    tauHat = t.tauHat;
  } else {
    sym = downsample(mf, delay, p.sps, nTot);
  }

  let phaseHat: Float64Array | null = null;
  if (p.carrierSync) {
    const r = carrierRecovery(sym, c, pre);
    sym = r.out;
    phaseHat = r.phaseHat;
  }

  // Receiver errors vs. the truth, per symbol (for the sync scope).
  const phaseErr = new Float64Array(nTot);
  const timingErr = new Float64Array(nTot);
  const peak0 = (txTaps.length - 1) / 2 + imp.timing * p.sps;
  for (let k = 0; k < nTot; k++) {
    let ph = 0;
    if (truePhase) {
      const idx = Math.min(truePhase.length - 1, Math.max(0, Math.round(k * p.sps + peak0)));
      ph = truePhase[idx];
    }
    phaseErr[k] = wrapPi((phaseHat ? phaseHat[k] : 0) - ph);
    timingErr[k] = (tauHat ? tauHat[k] : 0) - imp.timing;
  }

  const rxSym = { re: sym.re.slice(PREAMBLE_LEN), im: sym.im.slice(PREAMBLE_LEN) };
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
  return {
    c,
    bits,
    txWave,
    rxWave,
    mf,
    rxSym,
    labels,
    bitErrors,
    symbolErrors,
    delay,
    taps,
    phaseErr,
    timingErr,
  };
}

export interface SyncStats {
  /** RMS residual phase error over the payload, degrees. */
  phaseRmsDeg: number;
  /** RMS residual timing error over the payload, in T. */
  timingRms: number;
  /** Symbol after which the smoothed errors stay inside (10 deg, 0.1 T) for good; -1 if never. */
  lockAt: number;
}

function syncStats(phaseErr: Float64Array, timingErr: Float64Array): SyncStats {
  const n = phaseErr.length;
  let sp = 0;
  let st = 0;
  for (let k = PREAMBLE_LEN; k < n; k++) {
    sp += phaseErr[k] ** 2;
    st += timingErr[k] ** 2;
  }
  const m = Math.max(1, n - PREAMBLE_LEN);
  // Lock = the symbol after which the 16-symbol moving average of both errors never
  // leaves (10 deg, 0.1 T) again. Averaging keeps single noisy symbols from counting.
  const W = 16;
  const limP = (10 * Math.PI) / 180;
  let accP = 0;
  let accT = 0;
  let lastBad = -1;
  for (let k = 0; k < n; k++) {
    accP += phaseErr[k];
    accT += timingErr[k];
    if (k >= W) {
      accP -= phaseErr[k - W];
      accT -= timingErr[k - W];
    }
    const m = Math.min(k + 1, W);
    if (Math.abs(accP / m) > limP || Math.abs(accT / m) > 0.1) lastBad = k;
  }
  const lockAt = lastBad < n - 64 ? lastBad + 1 : -1;
  return { phaseRmsDeg: (Math.sqrt(sp / m) * 180) / Math.PI, timingRms: Math.sqrt(st / m), lockAt };
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
  phaseErr: Float64Array;
  timingErr: Float64Array;
  sync: SyncStats;
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
    eye: eyeTraces(r.mf.re, r.delay + PREAMBLE_LEN * p.sps, p.sps, p.nSym, 250),
    phaseErr: r.phaseErr,
    timingErr: r.timingErr,
    sync: syncStats(r.phaseErr, r.timingErr),
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

export type LinkConfig = Omit<LinkParams, 'ebN0dB' | 'nSym' | 'seed'>;

/**
 * Monte Carlo BER at one Eb/N0, run on the full waveform-level link
 * (not a symbol-level shortcut), frame after frame until enough errors are seen.
 */
export function simulateBerPoint(base: LinkConfig, ebN0dB: number, opts: BerPointOptions, seed = 1): BerPoint {
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
