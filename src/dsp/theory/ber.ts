import { ModId, modInfo } from '../modulation/constellation';
import { qfunc } from './qfunc';

const db2lin = (db: number) => Math.pow(10, db / 10);

/**
 * Exact M-PSK symbol error probability via Craig's formula:
 *   Ps = (1/pi) * integral_0^{(M-1)pi/M} exp(-Es/N0 * sin^2(pi/M) / sin^2(theta)) dtheta
 */
export function pskSer(M: number, esN0: number): number {
  const upper = ((M - 1) * Math.PI) / M;
  const s2 = Math.sin(Math.PI / M) ** 2;
  const n = 400; // Simpson intervals (even)
  const h = upper / n;
  const f = (th: number) => {
    const st = Math.sin(th);
    return st === 0 ? 0 : Math.exp((-esN0 * s2) / (st * st));
  };
  let acc = f(0) + f(upper);
  for (let i = 1; i < n; i++) acc += (i % 2 ? 4 : 2) * f(i * h);
  return (acc * h) / 3 / Math.PI;
}

/**
 * Theoretical bit error probability over AWGN with Gray coding.
 *  - BPSK / QPSK: exact, Q(sqrt(2 Eb/N0)).
 *  - M-PSK (M >= 8): exact SER (Craig) / k — the Gray approximation, tight for Pb < 1e-2.
 *  - Square M-QAM: Cho & Yoon's Gray-coded approximation (first terms of the exact sum).
 */
export function theoreticalBer(id: ModId, ebN0dB: number): number {
  const { kind, M } = modInfo(id);
  const k = Math.log2(M);
  const gb = db2lin(ebN0dB);

  if (M === 2 || M === 4) return qfunc(Math.sqrt(2 * gb));

  if (kind === 'psk') return pskSer(M, k * gb) / k;

  const sq = Math.sqrt(M);
  const a = Math.sqrt((3 * k * gb) / (M - 1));
  const terms = Math.min(2, sq / 2 - 1);
  let s = 0;
  for (let i = 0; i <= terms; i++) s += qfunc((2 * i + 1) * a);
  return (4 / k) * (1 - 1 / sq) * s;
}

export function isExactTheory(id: ModId): boolean {
  return id === 'bpsk' || id === 'qpsk';
}
