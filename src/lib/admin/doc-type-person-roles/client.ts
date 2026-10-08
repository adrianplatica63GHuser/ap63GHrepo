/**
 * The one module that reads and writes a role's document types — the rows of
 * `lookup_doc_type_person_role` — from a screen.               (Slice #38.36)
 *
 * A role's panel in „Date de referință → Roluri" uses it today, and the
 * document type's „Roluri" tab (#38.39) will show the same rows from the
 * type's side through the same functions, so the two cannot disagree: one
 * query key, one shape, one set of writes. The routes behind it are
 * `/api/admin/doc-type-person-roles` (GET, POST) and `/[id]` (PATCH
 * „Deține cotă", DELETE).
 *
 * Client-safe: fetch only, no DB.
 */
import { throwRequestFailed } from "@/lib/admin/value-lists/failures";

/** One role on one document type, as the list route sends it. */
export type DocTypePersonRolePair = {
  id: string;
  documentTypeId: string;
  personRoleId: string;
  documentTypeName: string;
  personRoleName: string;
  /** Slice #37.59: this role, on this type, holds a share in the property. */
  holdsShare: boolean;
  /** Slice #38.36: how many person ↔ document links use this role on documents of this type. */
  linkCount: number;
};

/** The cache key every reader of the pairs shares. */
export const PAIRS_QUERY_KEY = ["doc-type-person-roles"] as const;

export async function fetchPairs(): Promise<DocTypePersonRolePair[]> {
  const res = await fetch("/api/admin/doc-type-person-roles");
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return ((await res.json()) as { items: DocTypePersonRolePair[] }).items;
}

/** Offer a role on a document type. A 409 is „already offered" — a code, worded on the screen. */
export async function addPair(data: { documentTypeId: string; personRoleId: string; holdsShare?: boolean }): Promise<void> {
  const res = await fetch("/api/admin/doc-type-person-roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await throwRequestFailed(res, true);
}

/** Tick or untick „Deține cotă" on one pair. */
export async function setPairHoldsShare(id: string, holdsShare: boolean): Promise<void> {
  const res = await fetch(`/api/admin/doc-type-person-roles/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holdsShare }),
  });
  if (!res.ok && res.status !== 204) await throwRequestFailed(res);
}

/**
 * Stop offering a role on a document type. The links that already use the pair
 * stay as they are (Ask first 1: what the grid did); the role is then only no
 * longer offered for that type, which `role-stranded-note` says where it shows.
 */
export async function removePair(id: string): Promise<void> {
  const res = await fetch(`/api/admin/doc-type-person-roles/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) await throwRequestFailed(res);
}

/** A role's pairs, by document type name. */
export function pairsOfRole(pairs: readonly DocTypePersonRolePair[] | undefined, roleId: string): DocTypePersonRolePair[] {
  return (pairs ?? [])
    .filter((p) => p.personRoleId === roleId)
    .sort((a, b) => a.documentTypeName.localeCompare(b.documentTypeName, "ro"));
}

/** A document type's pairs, by role name — the type's side (#38.39). */
export function pairsOfType(pairs: readonly DocTypePersonRolePair[] | undefined, documentTypeId: string): DocTypePersonRolePair[] {
  return (pairs ?? [])
    .filter((p) => p.documentTypeId === documentTypeId)
    .sort((a, b) => a.personRoleName.localeCompare(b.personRoleName, "ro"));
}
