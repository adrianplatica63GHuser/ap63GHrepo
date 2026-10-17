/**
 * /api/judicial-persons/anaf                                                                          (Slice #39.64)
 *
 * GET ?cui=<CUI> — what ANAF's free register says about one company, read into the form's fields, with the archive's
 * „Tip" proposed from its legal form. Nothing is written: the form shows the changes and „Salvează" stays the user's.
 *
 *   200 { kind: "found", version, company, proposedType: { id, name } | null }
 *   200 { kind: "notFound", version }
 *   400 { code: "badCui" }          — not a CUI
 *   502 { code: "anafDown" }        — ANAF unreachable, slow, or answering in another shape
 *
 * The call is the server's (ANAF does not answer a browser across origins), spaced a second apart (lookup.ts).
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { ANAF_VERSION, normalizeCui, proposedTypeName, typeIdByName } from "@/lib/anaf/company";
import { AnafUnavailable, lookupAnafCompany } from "@/lib/anaf/lookup";
import { listValues } from "@/lib/admin/value-lists/queries";

export async function GET(request: NextRequest): Promise<Response> {
  const cui = normalizeCui(new URL(request.url).searchParams.get("cui"));
  if (!cui) return Response.json({ code: "badCui", error: "Not a CUI" }, { status: 400 });
  try {
    const answer = await lookupAnafCompany(cui);
    if (answer.kind === "notFound") return Response.json({ kind: "notFound", version: ANAF_VERSION });
    const name = proposedTypeName(answer.company.legalForm);
    const types = (await listValues("judicial-person-types")).map((t) => ({ id: t.id, name: String(t.name ?? "") }));
    const id = typeIdByName(types, name);
    return Response.json({
      kind: "found",
      version: ANAF_VERSION,
      company: answer.company,
      proposedType: id && name ? { id, name: types.find((t) => t.id === id)?.name ?? name } : null,
    });
  } catch (err) {
    if (err instanceof AnafUnavailable) {
      console.warn("[anaf]", err.message);
      return Response.json({ code: "anafDown", error: err.message }, { status: 502 });
    }
    return unexpectedError(err, "GET /api/judicial-persons/anaf");
  }
}
