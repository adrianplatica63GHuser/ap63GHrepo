/**
 * POST /api/admin/import/resolve-natural-person   (Slice #23.01.Import)
 *
 * Given the identity fields read off a scanned ID card, decide whether this
 * person already exists — WITHOUT creating or linking anything.
 *
 * Why this route exists at all:
 *
 *   POST /api/admin/import/extract-id-card returns fields and nothing else.
 *   The confirm-or-create dialog shipped for document parties
 *   (ai-party-linker-dialog.tsx) does not do its own matching either — it
 *   receives parties that /api/documents/[id]/ai-interpret has ALREADY
 *   resolved server-side. So porting that dialog to the import wizard needs
 *   the resolution half too, and this is it. Keeping it in its own route
 *   leaves extract-id-card functionally untouched, and makes the matching
 *   reusable by any other caller holding a name and a CNP.
 *
 * The ladder is the same one ai-interpret uses, and the same one CLAUDE.md
 * mandates for every AI-extraction path:
 *
 *   1. Exact CNP match  -> `matchCandidate`. The one signal strong enough to
 *      offer as "this is the same person, confirm it".
 *   2. No CNP, or no CNP hit -> fuzzy name search, returned as
 *      `possibleMatches` and NEVER as a candidate. The UI must label these
 *      unconfirmed; nothing here implies they are the same human being.
 *
 * This route never writes. It cannot create a duplicate person, and it cannot
 * merge two real ones — every consequence is the caller's explicit decision.
 *
 * Response:
 *   {
 *     matchCandidate:  NaturalPersonMatchCandidate | null,
 *     possibleMatches: PersonSearchItem[],   // max 5, unconfirmed
 *     searchedName:    string | null         // what the fuzzy pass actually
 *                                            // looked for, so the UI can say
 *                                            // so instead of implying it
 *                                            // searched something it didn't
 *   }
 */

import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import {
  computeDisplayName,
  findNaturalPersonByCnp,
  searchPersonsAll,
  type NaturalPersonMatchCandidate,
  type PersonSearchItem,
} from "@/lib/persons/queries";

export const runtime = "nodejs";

/** Max fuzzy suggestions shown in the confirm dialog — matches ai-interpret. */
const FUZZY_LIMIT = 5;

const bodySchema = z.object({
  cnp:       z.string().nullish(),
  firstName: z.string().nullish(),
  lastName:  z.string().nullish(),
});

const clean = (v: string | null | undefined): string => (v ?? "").trim();

export async function POST(request: NextRequest): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return zodErrorToResponse(parsed.error);

  const cnp       = clean(parsed.data.cnp);
  const firstName = clean(parsed.data.firstName);
  const lastName  = clean(parsed.data.lastName);

  try {
    // ── 1. Exact CNP ────────────────────────────────────────────────────────
    //
    // Deliberately no format or checksum validation: the rest of the app does
    // not validate CNPs either, and a malformed one simply matches nothing
    // here. Rejecting it would turn "the OCR misread a digit" into an error
    // instead of into the create-new branch, where the user can fix it.
    let matchCandidate: NaturalPersonMatchCandidate | null = null;
    if (cnp) {
      matchCandidate = await findNaturalPersonByCnp(cnp);
    }

    if (matchCandidate) {
      return Response.json({ matchCandidate, possibleMatches: [], searchedName: null });
    }

    // ── 2. Fuzzy name ───────────────────────────────────────────────────────
    //
    // person.displayName is stored as "firstName lastName" (computeDisplayName),
    // and searchPersonsAll does a single ILIKE %pattern% against it — so the
    // full-name pattern only matches when both parts are present, in that
    // order, with nothing between them. An ID card that yielded a middle name,
    // or a stored record entered surname-first, misses entirely.
    //
    // So: try the full name, and if that finds nobody fall back to the surname
    // alone, which is the more distinctive half and survives both problems.
    // Two cheap indexed lookups beat one brittle one, and a missed suggestion
    // here costs a duplicate person later.
    const fullName = computeDisplayName(firstName, lastName);

    let searchedName: string | null = null;
    let possibleMatches: PersonSearchItem[] = [];

    if (fullName) {
      searchedName = fullName;
      const { items } = await searchPersonsAll({
        name: fullName, type: "NATURAL", limit: FUZZY_LIMIT, offset: 0,
      });
      possibleMatches = items;
    }

    if (possibleMatches.length === 0 && lastName && lastName !== fullName) {
      searchedName = lastName;
      const { items } = await searchPersonsAll({
        name: lastName, type: "NATURAL", limit: FUZZY_LIMIT, offset: 0,
      });
      possibleMatches = items;
    }

    return Response.json({ matchCandidate: null, possibleMatches, searchedName });
  } catch (err) {
    return unexpectedError(err, "POST /api/admin/import/resolve-natural-person");
  }
}
