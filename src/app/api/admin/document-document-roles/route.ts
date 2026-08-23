/**
 * /api/admin/document-document-roles
 *
 * GET — the Document → Document relationship roles, for the association
 *       screen's dropdown (`src/app/documents/[id]/associate-reference/`).
 *
 * ⚠️ **READ-ONLY as of Slice #29.13** — same reasoning, word for word, as its
 * property-property twin: the list is an ordinary value list now, so every
 * write goes through /api/admin/value-lists/document-document-roles and its
 * guarded delete. See that file's header, and
 * src/lib/admin/value-lists/config.ts for why the two lists joined the others
 * rather than gaining a second guard.
 */

import { NextResponse } from "next/server";
import { listDocumentDocumentRoles } from "@/lib/admin/document-document-roles/queries";

export async function GET() {
  try {
    const items = await listDocumentDocumentRoles();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/admin/document-document-roles", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
