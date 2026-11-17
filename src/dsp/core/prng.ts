/** Uniform PRNG in [0, 1). */
export type Rng = () => number;

/**
 * mulberry32 — tiny, fast, seedable 32-bit PRNG.
 * Seeded everywhere so every simulation is reproducible.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal N(0, 1) generator (Box–Muller, caches the spare sample). */
export class Gaussian {
  private spare: number | null = null;

  constructor(private readonly rng: Rng) {}

  next(): number {
    if (this.spare !== null) {
      const s = this.spare;
      this.spare = null;
      return s;
    }
    let u = 0;
    while (u === 0) u = this.rng();
    const v = this.rng();
    const r = Math.sqrt(-2 * Math.log(u));
    const theta = 2 * Math.PI * v;
    this.spare = r * Math.sin(theta);
    return r * Math.cos(theta);
  }
}
