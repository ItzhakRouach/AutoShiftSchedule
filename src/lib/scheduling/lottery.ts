// Deterministic seeded PRNG (mulberry32) + a deterministic chooser used for
// lottery tie-breaks. Same seed ⇒ identical results (testable).

/** mulberry32: a tiny, fast, deterministic 32-bit PRNG. Returns floats in [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Deterministically order `items` using the rng. Implemented as a stable
 * Fisher–Yates shuffle so the draw order is reproducible for a given seed.
 */
export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** A lottery: pick `count` winners from `items` deterministically via rng. */
export function draw<T>(items: T[], count: number, rng: () => number): T[] {
  if (count >= items.length) return items.slice()
  return shuffle(items, rng).slice(0, count)
}
