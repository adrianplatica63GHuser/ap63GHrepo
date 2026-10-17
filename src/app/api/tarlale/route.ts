/**
 * GET /api/tarlale — every tarla with its locality and counts.                    (Slice #39.67, migration_112)
 */
import { unexpectedError } from "@/lib/api/errors";
import { listTarlale } from "@/lib/tarla/queries";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ items: await listTarlale() });
  } catch (err) {
    return unexpectedError(err, "GET /api/tarlale");
  }
}
