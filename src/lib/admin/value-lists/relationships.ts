/**
 * The six ways two objects are tied to each other — the relationship triangle.   (Slice #38.62)
 *
 * Adrian: a tile above the roles list, „a triangle with three equal sides and each corner is one of
 * the three main objects: Property, Person, Document", the corners and the sides explained, and each
 * of the six said to be set up in the application or not — and why not.
 *
 * A corner is a link between two objects of the SAME kind; a side, between two kinds. This module
 * DESCRIBES the code as it is — it changes no relationship, table or list:
 *
 *   - Persoană → Persoană   person_person, a role from „Roluri Persoane" ticked „Persoană → Persoană"
 *                           (`valid_for_person`), read back through its converse names (#37.28);
 *   - Proprietate → Proprietate   property_property, a type from „Legături Proprietate → Proprietate"
 *                           (lookup_property_property_role), read in one direction (#37.10);
 *   - Document → Document   document_document, a type from „Legături Document → Document"
 *                           (lookup_document_document_role);
 *   - Persoană – Proprietate   property_person, a role ticked „Persoană → Proprietate" (`valid_for_property`);
 *   - Persoană – Document   person_document, a role offered only on the document types chosen in the
 *                           role's panel („Act", #38.36) or on the type's own page (#38.39) — no column
 *                           in the roles list;
 *   - Document – Proprietate   property_document, with NO role, by design: the document's type says
 *                           what the link means. #34.05's note, which stood above the link lists until
 *                           this slice, is that entry's text now, in Adrian's words.
 *
 * PURE — no React, no DB. `relationship-triangle.test.ts` holds it against the schema dump.
 */
import type { ListKey } from "./config";

export type ObjectKind = "person" | "property" | "document";

export type RelationshipId =
  | "personPerson"
  | "propertyProperty"
  | "documentDocument"
  | "personProperty"
  | "personDocument"
  | "documentProperty";

export interface Relationship {
  id: RelationshipId;
  /** The two kinds it ties; the same kind twice is a corner. */
  ends: readonly [ObjectKind, ObjectKind];
  /** The table that holds one such link. */
  table: string;
  /** Set up in the application — a list of roles or types says what a link means. */
  configured: boolean;
  /** The list a person configures it in, opened when its corner or side is pressed; none when not configured. */
  list: ListKey | null;
}

/** The three corners first, then the three sides — the order the tile numbers them. */
export const RELATIONSHIPS: readonly Relationship[] = [
  { id: "personPerson", ends: ["person", "person"], table: "person_person", configured: true, list: "person-roles" },
  { id: "propertyProperty", ends: ["property", "property"], table: "property_property", configured: true, list: "property-property-roles" },
  { id: "documentDocument", ends: ["document", "document"], table: "document_document", configured: true, list: "document-document-roles" },
  { id: "personProperty", ends: ["person", "property"], table: "property_person", configured: true, list: "person-roles" },
  { id: "personDocument", ends: ["person", "document"], table: "person_document", configured: true, list: "person-roles" },
  { id: "documentProperty", ends: ["document", "property"], table: "property_document", configured: false, list: null },
];

/** A corner — two objects of the same kind. */
export function isCorner(r: Relationship): boolean {
  return r.ends[0] === r.ends[1];
}
