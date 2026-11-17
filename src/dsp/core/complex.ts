/** Complex vector in split (structure-of-arrays) form — fast and GC friendly. */
export interface CVec {
  re: Float64Array;
  im: Float64Array;
}

export function cvec(n: number): CVec {
  return { re: new Float64Array(n), im: new Float64Array(n) };
}

/** Mean of |x|^2 over the vector. */
export function meanPower(x: CVec): number {
  const n = x.re.length;
  if (n === 0) return 0;
  let p = 0;
  for (let i = 0; i < n; i++) p += x.re[i] * x.re[i] + x.im[i] * x.im[i];
  return p / n;
}

/** Take every `step`-th sample starting at `start`, `count` samples. */
export function downsample(x: CVec, start: number, step: number, count: number): CVec {
  const y = cvec(count);
  for (let i = 0; i < count; i++) {
    const j = start + i * step;
    y.re[i] = x.re[j];
    y.im[i] = x.im[j];
  }
  return y;
}
