/**
 * GET /api/properties/type-uses                                                           (Slice #39.66, migration_111)
 *
 * The pairs of `lookup_property_type_use`: { items: [{ propertyTypeId, useCategoryId }] }. Read by the property form
 * to offer only the uses the chosen type allows — every user's screen, so not under /api/admin. A type with no pairs
 * allows every use (src/lib/properties/type-uses.ts).
 */
import { unexpectedError } from "@/lib/api/errors";
import { listTypeUses } from "@/lib/properties/type-uses-queries";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const items = await listTypeUses();
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/properties/type-uses");
  }
}
