/**
 * „Țară"'s options: the blank, a stored value the list lacks, then „Țara adresei" in its order.      (Slice 41.51)
 *
 * Pure, so it is tested without the dropdown (country-select.tsx). The address keeps the country's NAME as text, so
 * a stored value the list does not hold — „ROMÂNIA" read off an old card, a country typed before the list existed —
 * is offered as one more option, first after the blank: the select shows it and a save writes it back unchanged.
 */
export type CountryOption = { value: string; label: string };

export function countryOptions(list: readonly CountryOption[], current: unknown): CountryOption[] {
  const now = typeof current === "string" ? current : "";
  const extra = now.trim() !== "" && !list.some((o) => o.value === now) ? [{ value: now, label: now }] : [];
  return [{ value: "", label: "—" }, ...extra, ...list];
}
