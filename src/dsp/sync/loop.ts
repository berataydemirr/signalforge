/**
 * Proportional-plus-integral gains of a second-order digital PLL, from the
 * normalized noise bandwidth BnT and damping zeta (Rice, "Digital Communications:
 * A Discrete-Time Approach", eq. C.61). `kd` is the detector gain (S-curve slope).
 */
export function loopGains(bnT: number, kd = 1, zeta = Math.SQRT1_2): { kp: number; ki: number } {
  const th = bnT / (zeta + 1 / (4 * zeta));
  const d = 1 + 2 * zeta * th + th * th;
  return { kp: (4 * zeta * th) / (d * kd), ki: (4 * th * th) / (d * kd) };
}

/** Cubic Lagrange interpolation of x at fractional index t (zero outside the array). */
export function interpCubic(x: Float64Array, t: number): number {
  const i = Math.floor(t);
  const mu = t - i;
  const xm1 = x[i - 1] ?? 0;
  const x0 = x[i] ?? 0;
  const x1 = x[i + 1] ?? 0;
  const x2 = x[i + 2] ?? 0;
  const c0 = (-mu * (mu - 1) * (mu - 2)) / 6;
  const c1 = ((mu + 1) * (mu - 1) * (mu - 2)) / 2;
  const c2 = (-(mu + 1) * mu * (mu - 2)) / 2;
  const c3 = ((mu + 1) * mu * (mu - 1)) / 6;
  return c0 * xm1 + c1 * x0 + c2 * x1 + c3 * x2;
}

/** Wrap an angle to (-pi, pi]. */
export function wrapPi(a: number): number {
  return a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI));
}
