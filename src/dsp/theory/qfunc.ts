/**
 * Complementary error function, Chebyshev fit (Numerical Recipes `erfcc`),
 * fractional error < 1.2e-7 everywhere — ample for BER curves down to 1e-12.
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 +
        t * (0.37409196 +
        t * (0.09678418 +
        t * (-0.18628806 +
        t * (0.27886807 +
        t * (-1.13520398 +
        t * (1.48851587 +
        t * (-0.82215223 +
        t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Gaussian tail probability Q(x) = P(N(0,1) > x). */
export function qfunc(x: number): number {
  return 0.5 * erfc(x / Math.SQRT2);
}
