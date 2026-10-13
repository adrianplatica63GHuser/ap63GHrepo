/**
 * A small seedable random source for the big dev seed.                       (Slice #39.20)
 *
 * mulberry32, as scripts/seed-dev-data/seed.ts uses: the same `--seed <n>` gives the same
 * choices, so a run can be repeated exactly. Not for anything but dummy data.
 */
export type Rng = {
  /** [0, 1) */
  next(): number;
  between(a: number, b: number): number;
  /** an integer in [a, b], both ends included */
  int(a: number, b: number): number;
  pick<T>(xs: readonly T[]): T;
  /** true with probability p */
  chance(p: number): boolean;
  shuffle<T>(xs: readonly T[]): T[];
  /** a value from `xs` by weight: [[value, weight], …] */
  weighted<T>(xs: readonly (readonly [T, number])[]): T;
  /** roughly normal (Irwin–Hall of 6), mean and standard deviation */
  normal(mean: number, sd: number): number;
};

export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    between: (a, b) => a + next() * (b - a),
    int: (a, b) => Math.floor(a + next() * (b - a + 1)),
    pick: (xs) => {
      if (xs.length === 0) throw new Error("rng.pick: empty list");
      return xs[Math.floor(next() * xs.length)];
    },
    chance: (p) => next() < p,
    shuffle: (xs) => {
      const a = [...xs];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    weighted: (xs) => {
      const total = xs.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of xs) {
        r -= w;
        if (r < 0) return v;
      }
      return xs[xs.length - 1][0];
    },
    normal: (mean, sd) => {
      let s = 0;
      for (let i = 0; i < 6; i++) s += next();
      return mean + (s - 3) * sd * Math.SQRT2;
    },
  };
  return rng;
}
