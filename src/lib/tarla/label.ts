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

/**
 * A property's tarla in a picker, its read view and a version of it: the code alone, and „code — description" only on
 * hover (and as the choice's name to a screen reader).                                                     (Slice 40.90)
 *
 * Adrian, 2026-10-27: „wherever you show Tarla: you show <Tarla code - description>; Please show only the <Tarla code>
 * and show <Tarla code - description> only on hover". `code` is what the caller would show — the indicativ, with its
 * locality in brackets where two tarlale share it (#39.67). A tarla without a description has no hover. This is not
 * `tarlaLabel` above: „code — locality" names a tarla on its own page, and a locality is not a description.
 */
export function tarlaPickerOption(code: string, descriere?: string | null): { label: string; title?: string } {
  const description = descriere?.trim();
  return description ? { label: code, title: `${code} — ${description}` } : { label: code };
}
