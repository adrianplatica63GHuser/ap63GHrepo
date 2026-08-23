/**
 * /api/admin/property-property-roles
 *
 * GET — the Proprietate → Proprietate relationship roles, for the association
 *       screen's dropdown (`src/app/properties/[id]/associate-reference/`).
 *
 * ⚠️ **READ-ONLY as of Slice #29.13, and the POST that was here is gone rather
 * than deprecated.** This list is now an ordinary value list — see
 * `VALID_LIST_KEYS` in src/lib/admin/value-lists/config.ts — so it is created,
 * renamed and deleted through /api/admin/value-lists/property-property-roles,
 * where the delete is refused while associations still carry the row. A second
 * create door with its own zod schema and no guard is exactly the drift this
 * slice removed; a second DELETE door would have been the bug itself, still
 * reachable.
 *
 * What keeps this route alive is the CONSUMER: the associate-reference view
 * fetches `/api/admin/property-property-roles` under the query key
 * `["property-property-roles"]`. Pointing it at the generic list route would
 * be a rename of a working thing for no gain.
 */

import { NextResponse } from "next/server";
import { listPropertyPropertyRoles } from "@/lib/admin/property-property-roles/queries";

export async function GET() {
  try {
    const items = await listPropertyPropertyRoles();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/admin/property-property-roles", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
