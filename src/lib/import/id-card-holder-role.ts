/**
 * The role an identity card's holder is linked to its Document in.  (Slice #38.44)
 *
 * „Titular act de identitate" — the role the general reader gave a card's
 * holder until #38.44, and the one CARTE_IDENTITATE is paired with under Date
 * de referință. „Creează persoană din CI" links the holder in it on every
 * path, with a property or without one, so a card reads the same whichever
 * way it came in. Looked up by name among the roles the document's type
 * offers; a type that does not offer it gets the link without a role, as
 * before #38.44, rather than no link at all.
 */

export const ID_CARD_HOLDER_ROLE = "Titular act de identitate";

/** The holder role's id among a document's offered roles, or null when its type has none. */
export function holderRoleIdFrom(roles: readonly { id: string; name: string }[]): string | null {
  const want = ID_CARD_HOLDER_ROLE.toLocaleLowerCase("ro-RO");
  return roles.find((r) => r.name.trim().toLocaleLowerCase("ro-RO") === want)?.id ?? null;
}

/**
 * The holder role's id for this Document, read from the roles its type offers
 * — or null when the type offers none, or the read fails: the link is then
 * made without a role, never not made.
 *
 * Here rather than in the dialog because it is not a picker: nothing is
 * offered to the user, so the dialog is not one of the screens that hand out
 * a role (role-attachment-door, carried-role-options and role-stranding count
 * those by the route they read).
 */
export async function holderRoleIdFor(documentId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/valid-person-roles`);
    if (!res.ok || res.redirected) return null;
    return holderRoleIdFrom(((await res.json()) as { items?: { id: string; name: string }[] }).items ?? []);
  } catch {
    return null;
  }
}
