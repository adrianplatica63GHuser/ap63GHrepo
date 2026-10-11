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

// ── Slice #39.05: the person's screen with the action panel (C) ────────────────────────────────────────────────

/**
 * The person's screen with the interactions' action panel (C) expanded, by the address — on a new record
 * (`?log=new`), or on a row (`?log=<interaction id>`). Without the parameter C starts collapsed. Expanding writes
 * nothing. 39.06's names in the Rapoarte screen's history (A) link here.
 */
export const LOG_PARAM = "log";
export const LOG_NEW = "new";

export type PersonBase = "/natural-persons" | "/judicial-persons";

/** A person's screen by the row's `personType` — a company is a judicial person. */
export function personBase(personType: string | null | undefined): PersonBase {
  return personType === "JUDICIAL" ? "/judicial-persons" : "/natural-persons";
}

export function personLogHref(base: PersonBase, personId: string, select?: string): string {
  const p = new URLSearchParams({ [LOG_PARAM]: select ?? LOG_NEW });
  return `${base}/${encodeURIComponent(personId)}?${p.toString()}`;
}

/** What the address asks of C: collapsed, expanded on a new record, or expanded on a row. */
export function readLog(value: string | null | undefined): { expanded: boolean; select: string | null } {
  if (value === null || value === undefined || value === "") return { expanded: false, select: null };
  return { expanded: true, select: value === LOG_NEW ? null : value };
}
