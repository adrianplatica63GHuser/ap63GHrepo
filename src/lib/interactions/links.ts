/**
 * The module's address for a person — scoped; with a row chosen, or a new record ready.   (Slice #38.89)
 *
 * The person's „Interacțiuni" tile opens the screen through these: `?person=` is the scope (38.84), `?select=` the row
 * the screen opens with in „Editează selecția" (38.87), `?new=1` a new record with the person filled (38.85).
 */
export function interactionsHref(personId: string, extra?: { select?: string; new?: true }): string {
  const p = new URLSearchParams({ person: personId });
  if (extra?.select) p.set("select", extra.select);
  if (extra?.new) p.set("new", "1");
  return `/interactions?${p.toString()}`;
}
