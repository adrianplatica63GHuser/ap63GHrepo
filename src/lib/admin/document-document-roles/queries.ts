/**
 * `lookup_document_document_role` — READ ONLY.                  (Slice #29.13)
 *
 * ⚠️ **The create, the rename and the delete that used to live here are gone,
 * and the delete is the reason.** It was a bare `db.delete` with no count, and
 * `document_document.relationship_role_id` is ON DELETE SET NULL — so deleting
 * a role that forty associations carried blanked forty relationship tags and
 * answered 204.
 * That is exactly the failure Slice #29.05 exists to prevent, one modal over.
 *
 * The list joined `VALID_LIST_KEYS` instead of gaining a guard of its own (see
 * src/lib/admin/value-lists/config.ts for why), so all three writes are now
 * `createValue` / `updateValue` / `deleteValue` in
 * src/lib/admin/value-lists/queries.ts, and the delete there is refused while
 * anything depends on the row.
 *
 * What is left is this one reader, and it is left because it has a consumer
 * the generic list route does not serve: the association screen's role
 * dropdown, via GET /api/admin/document-document-roles.
 */

import { db } from "@/db";
import { lookupDocumentDocumentRole } from "@/db/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DocumentDocumentRoleRow = {
  id:          string;
  name:        string;
  description: string | null;
  sortOrder:   number;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listDocumentDocumentRoles(): Promise<DocumentDocumentRoleRow[]> {
  return db
    .select({
      id:          lookupDocumentDocumentRole.id,
      name:        lookupDocumentDocumentRole.name,
      description: lookupDocumentDocumentRole.description,
      sortOrder:   lookupDocumentDocumentRole.sortOrder,
    })
    .from(lookupDocumentDocumentRole)
    // ⚠️ **THE THIRD TERM IS `id`, AND IT IS HERE BECAUSE IT IS THERE.**
    //                                                        (Slice #34.14)
    // This reader exists so the association screen's dropdown shows the same
    // list, in the same order, as Reference Data's modal — `listValues`'
    // `document-document-roles` branch, whose ordering #29.13 shaped to match
    // this one. #34.14 closed that branch on the primary key, which makes its
    // key TOTAL; leaving this one at `(sort_order, name)` would mean two rows
    // tied on both can sit one way in the modal and the other way in the
    // dropdown, which is the disagreement #29.13 was written to prevent,
    // reintroduced from the other side. See the header above `listValues`.
    .orderBy(lookupDocumentDocumentRole.sortOrder, lookupDocumentDocumentRole.name, lookupDocumentDocumentRole.id);
}
