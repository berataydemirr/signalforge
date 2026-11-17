import { CVec, cvec } from '../core/complex';
import { mulberry32 } from '../core/prng';
import { Constellation, sliceLabel } from '../modulation/constellation';
import { loopGains } from './loop';

export const PREAMBLE_LEN = 192;

let preambleCache: CVec | null = null;

/** Fixed, known QPSK preamble (unit energy) sent at the start of every frame. */
export function preamble(): CVec {
  if (preambleCache) return preambleCache;
  const rng = mulberry32(0x5eed);
  const p = cvec(PREAMBLE_LEN);
  for (let i = 0; i < PREAMBLE_LEN; i++) {
    const a = Math.PI / 4 + (Math.PI / 2) * Math.floor(rng() * 4);
    p.re[i] = Math.cos(a);
    p.im[i] = Math.sin(a);
  }
  preambleCache = p;
  return p;
}

export interface CarrierResult {
  out: CVec;
  /** Phase estimate per symbol (rad, unwrapped). */
  phaseHat: Float64Array;
}

/**
 * Second-order carrier PLL at symbol rate.
 *  - Acquisition: data-aided on the known preamble (wide loop, no phase ambiguity).
 *  - Tracking: decision-directed (Costas-type) on the payload (narrow loop).
 * Phase detector: e = Im{ y conj(a) } / |a|^2  (~ phase error in rad).
 * The integrator absorbs a frequency offset, so the loop tracks CFO with zero steady-state error.
 */
export function carrierRecovery(
  sym: CVec,
  c: Constellation,
  pre: CVec,
  bnAcq = 0.05,
  bnTrack = 0.01,
): CarrierResult {
  const n = sym.re.length;
  const out = cvec(n);
  const phaseHat = new Float64Array(n);
  const acq = loopGains(bnAcq);
  const trk = loopGains(bnTrack);
  const nPre = pre.re.length;
  let phi = 0;
  let integ = 0;
  for (let k = 0; k < n; k++) {
    const cs = Math.cos(phi);
    const sn = Math.sin(phi);
    const yr = sym.re[k] * cs + sym.im[k] * sn;
    const yi = sym.im[k] * cs - sym.re[k] * sn;
    out.re[k] = yr;
    out.im[k] = yi;
    phaseHat[k] = phi;

    let ar: number;
    let ai: number;
    if (k < nPre) {
      ar = pre.re[k];
      ai = pre.im[k];
    } else {
      const l = sliceLabel(c, yr, yi);
      ar = c.re[l];
      ai = c.im[l];
    }
    const e = (yi * ar - yr * ai) / (ar * ar + ai * ai);
    const g = k < nPre ? acq : trk;
    integ += g.ki * e;
    phi += g.kp * e + integ;
  }
  return { out, phaseHat };
}
