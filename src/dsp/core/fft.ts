/**
 * In-place iterative radix-2 Cooley–Tukey FFT.
 * Forward: X[k] = sum x[n] e^{-j 2 pi k n / N}. Inverse includes the 1/N factor.
 */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (n !== im.length) throw new Error('fft: re/im length mismatch');
  if (n === 0 || (n & (n - 1)) !== 0) throw new Error(`fft: length ${n} is not a power of two`);

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    for (let k = 0; k < half; k++) {
      // Direct twiddle evaluation: no accumulated recurrence error.
      const wr = Math.cos(ang * k);
      const wi = Math.sin(ang * k);
      for (let i = k; i < n; i += len) {
        const b = i + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[i] - xr;
        im[b] = im[i] - xi;
        re[i] += xr;
        im[i] += xi;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}
