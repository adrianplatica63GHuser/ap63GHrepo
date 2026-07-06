/**
 * GET /api/properties/[id]/calculation-source   (Slice #20.09)
 *
 * Returns the calculation_run that created this property (if any).
 * Used by the property metadata tab to show a provenance link when
 * provenance = 'ALGORITHM'.
 *
 * Response: { source: { runId, runCode, status } } or { source: null }
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import {
  getPropertyCalculationSource,
  getPropertyPrincipalObjectId,
} from "@/lib/calculation/runs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  try {
    const principalObjectId = await getPropertyPrincipalObjectId(id);
    if (!principalObjectId) {
      return Response.json({ error: "Property not found" }, { status: 404 });
    }
    const source = await getPropertyCalculationSource(principalObjectId);
    return Response.json({ source });
  } catch (err) {
    return unexpectedError(err, `GET /api/properties/${id}/calculation-source`);
  }
}
