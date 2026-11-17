import { CVec, cvec } from '../core/complex';
import { interpCubic, loopGains } from './loop';

/**
 * Gardner TED S-curve slope at zero error, per unit of T, for RRC-filtered
 * unit-energy symbols. Fit to measurements (QPSK and 16-QAM agree within 3%):
 * beta = 0.2 / 0.35 / 0.5 / 1.0  ->  Kd = 0.60 / 1.07 / 1.50 / 2.64.
 * The TED needs excess bandwidth: its gain vanishes as beta -> 0.
 */
export const gardnerKd = (beta: number) => 3 * beta - 0.36 * beta * beta;

/** Largest clock-rate error the tracking loop's integrator may represent (fraction of T per symbol). */
const MAX_RATE = 0.01;

export interface TimingResult {
  sym: CVec;
  /** Estimated timing offset per symbol, in T, relative to the nominal sampling instant. */
  tauHat: Float64Array;
}

/**
 * Non-data-aided symbol timing recovery: Gardner TED + loop filter + cubic
 * interpolator, running on the matched-filter output. Gear-shifted: a wide
 * first-order loop for acquisition, then a narrow second-order loop.
 *
 *   e[k] = Re{ conj(y[k - 1/2]) (y[k] - y[k-1]) }
 *
 * Sampling late gives e > 0, so the next strobe is pulled earlier.
 * Insensitive to carrier phase, so it can run before carrier recovery.
 */
export function gardnerTiming(
  mf: CVec,
  start: number,
  sps: number,
  nSym: number,
  beta: number,
  /** Symbols run with the wide acquisition bandwidth before switching to tracking. */
  acqSymbols = 0,
  bnAcq = 0.04,
  bnTrack = 0.01,
): TimingResult {
  const acq = loopGains(bnAcq, gardnerKd(beta));
  const trk = loopGains(bnTrack, gardnerKd(beta));
  const sym = cvec(nSym);
  const tauHat = new Float64Array(nSym);
  const last = mf.re.length - 3;
  let t = start;
  let integ = 0;
  let pr = 0;
  let pi = 0;
  for (let k = 0; k < nSym; k++) {
    if (t > last) {
      tauHat.fill(tauHat[k - 1] ?? 0, k);
      break;
    }
    const yr = interpCubic(mf.re, t);
    const yi = interpCubic(mf.im, t);
    sym.re[k] = yr;
    sym.im[k] = yi;
    tauHat[k] = (t - start - k * sps) / sps;
    let adj = 0;
    if (k > 0) {
      const mr = interpCubic(mf.re, t - sps / 2);
      const mi = interpCubic(mf.im, t - sps / 2);
      const e = mr * (yr - pr) + mi * (yi - pi);
      if (k < acqSymbols) {
        // First-order during acquisition: no integrator to wind up on noise.
        adj = acq.kp * e;
      } else {
        // Second-order tracking; the integrator (clock-rate error) is bounded to +-1%.
        integ = Math.max(-MAX_RATE, Math.min(MAX_RATE, integ + trk.ki * e));
        adj = trk.kp * e + integ;
      }
    }
    pr = yr;
    pi = yi;
    t += sps * (1 - adj);
  }
  return { sym, tauHat };
}
