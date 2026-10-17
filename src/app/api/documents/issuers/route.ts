/**
 * GET /api/documents/issuers                                                              (Slice #39.72)
 *
 * The juridical persons a document's issuer is picked from:
 *   - no `q`: the persons of a public-body type, by name — the picker's list;
 *   - `?q=…`: every juridical person the search finds (name, nickname, code, CUI), public-body ones first, at most
 *     ISSUER_SEARCH_LIMIT.
 * Both answers carry `publicBodyTypes`, so a screen that makes a new issuer from the AI's reading can give it the type
 * its name suggests. Read-only: a new issuer is made through POST /api/judicial-persons, like any juridical person.
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { listIssuers, listPublicBodyTypes } from "@/lib/documents/issuer-queries";

export async function GET(request: NextRequest): Promise<Response> {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  try {
    const [items, publicBodyTypes] = await Promise.all([listIssuers(q || undefined), listPublicBodyTypes()]);
    return Response.json({ items, publicBodyTypes });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents/issuers");
  }
}
