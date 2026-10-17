/**
 * A tarla named the way a person tells two of them apart: „50 — Bragadiru".               (Slice #39.67)
 *
 * Tarla numbers restart in every locality, so the code alone no longer names one tarla wherever more than one
 * locality is in the archive. Without a locality the code stands alone, as before.
 */
export function tarlaLabel(t: { indicativ: string; locality?: string | null }): string {
  const locality = t.locality?.trim();
  return locality ? `${t.indicativ} — ${locality}` : t.indicativ;
}
