/**
 * Helpers for translating common error shapes into JSON Response objects.
 * Used by the /api/people route handlers (and any future entity API).
 */

import type { ZodError } from "zod/v4";
import { RoleNotOfferedError } from "@/lib/admin/value-lists/role-attachment";
import { DocumentNotFoundError } from "@/lib/documents/document-not-found";

/** Postgres errors come through pg with a numeric SQLSTATE code. */
type PgError = {
  code?: string;
  message?: string;
  constraint?: string;
  detail?: string;
};

function unwrapPgError(err: unknown): PgError {
  // Drizzle wraps the real Postgres error in an outer "Failed query: ..."
  // Error, with the actual error (code/constraint/message) attached as
  // `.cause`. Without unwrapping this, `e.code`/`e.constraint` are always
  // undefined and every DB constraint violation (CNP/CUI dupes, any
  // unique/check/FK violation) silently falls through to the generic 500
  // instead of its specific message.
  const top = err as PgError & { cause?: unknown };
  const cause = top?.cause as PgError | undefined;
  return cause ?? top;
}

/**
 * The SQLSTATE of a Postgres error, through the same unwrapping
 * `dbErrorToResponse` does, or `undefined` for anything that is not one.
 *
 * Exported for the one caller that needs to answer a specific violation with
 * something richer than this file can build: the value-lists DELETE route
 * turns a 23503 into the same "what depends on this row" body its own
 * pre-check produces (Slice #29.05). Without it that route would have to
 * re-implement the `.cause` unwrap, and the two would drift.
 */
export function pgErrorCode(err: unknown): string | undefined {
  return unwrapPgError(err)?.code;
}

/**
 * The CONSTRAINT a Postgres error names, through the same unwrapping.
 *                                                              (Slice #34.09)
 *
 * ⚠️ **Added because `dbErrorToResponse` cannot answer this class and should
 * not be taught to.** Its 23505 branch tests `e.constraint?.includes("cnp")`
 * and `("cui")` and otherwise answers a 409 whose body carries `error` and
 * `constraint` and NO `code` — and a body with no `code` is exactly what
 * `failureFromResponse` maps to the generic Romanian sentence. The value-lists
 * routes need the opposite: one specific index (`lookup_document_type_name_
 * normalised_unique`) recognised exactly, so the RACE that beats
 * `documentTypeNameTakenBy` arrives as the same sentence the stale-list case
 * does. Exported for the same reason `pgErrorCode` was: without it each route
 * would re-implement the `.cause` unwrap and the two would drift.
 *
 * Exact equality is the caller's business, not this function's — `includes` on
 * a constraint name is how you match an index you did not mean.
 */
export function pgErrorConstraint(err: unknown): string | undefined {
  return unwrapPgError(err)?.constraint;
}

/**
 * Translate a Postgres / Drizzle error into a JSON Response, or return
 * `null` if the error doesn't match any known DB pattern (caller should
 * then fall through to a generic 500).
 */
export function dbErrorToResponse(err: unknown): Response | null {
  const top = err as PgError & { cause?: unknown };
  const e: PgError = unwrapPgError(err);
  const message = e?.message ?? top?.message ?? String(err);

  // RAISE EXCEPTION from our `natural_person_lock_cnp` trigger (SQLSTATE P0001).
  if (message.includes("CNP cannot be changed")) {
    return Response.json({ error: message }, { status: 400 });
  }

  // RAISE EXCEPTION from our `judicial_person_lock_cui` trigger (SQLSTATE P0001).
  if (message.includes("CUI cannot be changed")) {
    return Response.json({ error: message }, { status: 400 });
  }

  // Unique violation. Since Slice #29.04 CNP/CUI collisions come from the
  // plain partial unique indexes natural_person_cnp_unique /
  // judicial_person_cui_unique (restored by migration_070), which carry
  // `e.constraint` — the `.includes("cnp")` / `.includes("cui")` tests below
  // are what make that work, and renaming either index would break the 409.
  //
  // The message-text fallback is kept deliberately. It cost nothing, and it
  // is what let this function keep answering 409 across the swap from the
  // migration_025 triggers (which raised 23505 with no `constraint` property)
  // back to the indexes.
  if (e.code === "23505") {
    if (e.constraint?.includes("cnp") || message.includes("CNP")) {
      return Response.json(
        { error: "A person with this CNP already exists" },
        { status: 409 },
      );
    }
    if (e.constraint?.includes("cui") || message.includes("CUI")) {
      return Response.json(
        { error: "A judicial person with this CUI already exists" },
        { status: 409 },
      );
    }
    return Response.json(
      { error: "Unique constraint violated", constraint: e.constraint },
      { status: 409 },
    );
  }

  // Check constraint violation
  if (e.code === "23514") {
    return Response.json(
      { error: "Database constraint violated", constraint: e.constraint },
      { status: 400 },
    );
  }

  // Foreign key violation. Carries `constraint` for the same reason the 23505
  // and 23514 branches do: without it the body says only that SOMETHING
  // referenced the row, which is not enough for a caller to say what. Since
  // Slice #29.04 made reference-data deletes real, this is now a reachable
  // response rather than a theoretical one — deleting a document type any
  // document uses lands here.
  //
  // ⚠️ **`code` ADDED BY SLICE #34.28, AND THE `error` PROSE IS STILL ENGLISH
  // ON PURPOSE.** That is the shape `roleNotOfferedToResponse` and
  // `documentNotFoundToResponse` below already ship: the sentence is written
  // for a hand-made request, and `code` is the contract a screen matches so it
  // can print its own Romanian. Matching «Foreign key violation» instead is how
  // you recognise something you did not mean — `pgErrorConstraint`'s header
  // makes the same point about `includes` on a constraint name — so the wording
  // is free to change and `FOREIGN_KEY_VIOLATION` is not.
  //
  // ⚠️ **A BARE LITERAL AT EACH END, NOT A SHARED CONSTANT, AND THAT IS THE
  // SHAPE RATHER THAN AN OVERSIGHT.** `ROLE_NOT_OFFERED` and
  // `DOCUMENT_NOT_FOUND` are written out here and written out again in
  // `association-failure.ts`. **What decides is WHERE the constant would have to
  // live, not which side reads it** — an eighth review round caught this
  // paragraph saying the value-lists codes are shared constants „because their
  // two ends are both server-side", which is simply untrue: four client
  // components import `DOCUMENT_TYPE_NAME_TAKEN_CODE` or `failures.ts`. Those
  // constants live in light modules that a client component can import. This
  // one's other end is `safe-mutate.ts`, which every form component imports, and
  // its home would be THIS module — which constructs `RoleNotOfferedError` and
  // `DocumentNotFoundError` — so an `export const` here would pull all of that
  // into the client bundle to carry one string. `src/__tests__/foreign-key-
  // refusal.test.ts` asserts the two spellings agree, which is the part a
  // shared constant would have bought.
  //
  // ⚠️ **THE REACHABLE CASE IS A SAVE, NOT A DELETE, AND #34.17 MEASURED IT.**
  // Two windows leave a property version naming a lookup row the form cannot
  // check: a value list whose fetch keeps FAILING leaves every id `pending`,
  // and a row deleted inside the five-minute `staleTime` still reads
  // `resolved`. In both, „Make current" is offered, the PATCH goes, and this is
  // what comes back — on a screen whose every other sentence is Romanian.
  // `safeMutate` is what turns it into one; see `src/lib/api/safe-mutate.ts`.
  //
  // ⚠️ **ADDING `code` HERE IS ADDITIVE, AND THE ARGUMENT IS A PROPERTY RATHER
  // THAN A LIST — BECAUSE TWO DRAFTS OF THIS PARAGRAPH TRIED THE LIST AND BOTH
  // WERE SHORT.** The first said „both were checked" and named two; #34.28's
  // first review round found two more, and the SECOND round found three more
  // again. So state the property instead, which is checkable in one grep and
  // does not go stale: **no reader of `code` anywhere in this repo tests
  // `FOREIGN_KEY_VIOLATION`, so every one of them falls through exactly as it
  // did when the body had no `code` at all.** That is one grep, and it is the
  // whole argument. ⚠️ **Do NOT turn it back into a list of consumers:** three
  // drafts tried, and review rounds found the list short every time — two, then
  // four, then seven, and a seventh round found `discover-review-dialog.tsx`
  // reading `code` off a value-lists door that calls this function. Roughly
  // twenty-five sites read a `code` off some API body; counting the ones that
  // can receive THIS body is a question nobody has answered correctly yet, and
  // the property above makes it unnecessary. The one reader that IS gated on
  // this code is `safeMutate`, which this slice adds and which is the point.
  //
  // ⚠️ **THE SCREENS THAT STILL PAINT IT IN ENGLISH.** #34.28 translated the FK
  // case for the four forms that go through `safeMutate`; every screen that
  // hand-rolls its own fetch still shows „Foreign key violation" verbatim. What
  // a follow-up slice should know before ranking them — a seventh review round
  // corrected an earlier draft of this paragraph that had the ranking upside
  // down:
  //   • `groups-list-view.tsx` and `stamps-list-view.tsx` are the WORST and have
  //     nothing to do with foreign keys. They have **no `res.redirected` check
  //     at all**, so an expired session makes a create return the sign-in page
  //     as a 200 and the write is lost in silence. That is the failure
  //     `safeMutate` exists for. Move these first.
  //   • `group-editor.tsx` and `stamp-applicator.tsx` have the `"__SESSION__"`
  //     sentinel and so are safe from that, but their FK window is much narrower
  //     than it looks: `lib/groups/queries.ts` and `lib/stamps/queries.ts`
  //     resolve entity ids to principal ids with a SELECT and `.filter(Boolean)`
  //     first, so a principal already deleted is silently DROPPED from the write
  //     rather than refused — a different defect, and one nobody is told about.
  //     Only a delete committing inside the transaction reaches 23503.
  //   • `property-step-dialog.tsx` was named in an earlier draft as „the one
  //     with a properly reachable 23503", and that was simply wrong. The Zod
  //     body of `/api/admin/import/property` accepts `tarlaSola`, `parcela`,
  //     `nickname`, `corners` and a `confirm` block and **no lookup id at all**;
  //     `createPropertyIn` therefore writes `propertyTypeId`/`useCategoryId` as
  //     null on that path, and `tarlaId` is resolved by a SELECT inside the same
  //     transaction. The screen never holds a lookup id, so the stale-list race
  //     cannot happen there — only the same in-transaction window as above.
  //   So no screen outside the four forms has #34.17's measured race. The fix
  //   for all of them is to move onto `safeMutate` rather than bolt a second
  //   sentinel beside the one two of them have; it is its own slice, and it is
  //   in the #34.28 handover.
  if (e.code === "23503") {
    return Response.json(
      { error: "Foreign key violation", code: "FOREIGN_KEY_VIOLATION", constraint: e.constraint },
      { status: 400 },
    );
  }

  return null;
}

/**
 * The 400 for a role no whitelist offers, or `null` for anything else.
 *                                                              (Slice #34.15)
 *
 * ⚠️ **A separate function rather than a branch inside `dbErrorToResponse`,
 * because this is not a database error.** Nothing has been written when it
 * throws: `assertRoleMayBeAttached` runs before the insert, so this is the
 * request being refused, not a constraint reporting a collision. The five
 * association routes funnel every throw into `unexpectedError` (500), so
 * without this they would answer 500 to a request that is simply invalid.
 *
 * ⚠️ **THE `error` SENTENCE IS ENGLISH, LIKE EVERY OTHER ONE THESE ROUTES
 * ANSWER WITH, AND NOTHING A USER READS COMES FROM IT.** `Invalid JSON body`
 * and „A person with this CNP already exists" are the shipped shape; this one
 * is written for the caller that can only be a hand-made request, and it names
 * the kind so that caller can tell which door refused it.
 *
 * ⚠️ **`code` IS THE PART WITH CONSUMERS, AND THERE ARE NINE.** The eight
 * association screens go through `associationFailureMessage`
 * (`src/lib/ui/association-failure.ts`), which matches `ROLE_NOT_OFFERED` and
 * prints `shared.roleNotOffered`; the AI party linker matches it too and prints
 * one of its own two sentences. Matching on the prose instead is how you
 * recognise something you did not mean — the same point `pgErrorConstraint`'s
 * header makes about `includes` on a constraint name — so the wording above is
 * free to change and `code` is not.
 *
 * ⚠️ **The reachable case is NOT devtools, which is why those nine exist.**
 * Nothing invalidates one browser's role list when an administrator unticks a
 * role in another, so a screen left open goes on offering the role it loaded.
 * Submitting then is this 400, to an ordinary user, in the ordinary course.
 */
export function roleNotOfferedToResponse(err: unknown): Response | null {
  if (!(err instanceof RoleNotOfferedError)) return null;
  return Response.json(
    {
      error: `That role is not valid for this kind of association (${err.kind}).`,
      code:  "ROLE_NOT_OFFERED",
      kind:  err.kind,
    },
    { status: 400 },
  );
}

/**
 * The 404 for a document that does not exist, or `null` for anything else.
 *                                                              (Slice #34.26)
 *
 * ⚠️ **IT IS TRIED BEFORE `roleNotOfferedToResponse`, AND THAT IS THE POINT.**
 * The two cannot both be thrown — `associatePersonsToDocument` checks the
 * document first and returns — but the order in the route's catch is the thing
 * a reader checks, so it is stated rather than left to the throw site.
 *
 * ⚠️ **404, NOT 400.** Nothing about the request's SHAPE is wrong: the id is a
 * well-formed uuid naming a row that is not there. 400 is what this route
 * already answers for a body it cannot parse and for a role no whitelist
 * offers, and giving the three the same status is how a screen ends up guessing
 * which of them happened.
 *
 * ⚠️ **`code` IS THE PART WITH A CONSUMER**, for the reason
 * `roleNotOfferedToResponse` states at length: the English `error` is written
 * for a hand-made request, and `associationFailureMessage` matches
 * `DOCUMENT_NOT_FOUND` to print `shared.documentNotFound` instead. Matching the
 * prose is how you recognise something you did not mean.
 *
 * ⚠️ **THE REACHABLE CASE IS A DOCUMENT DELETED IN ANOTHER SESSION**, not
 * devtools — the same race the whole of #34.15's 400 exists for. It reaches
 * this route from the document's own „Asociază persoană" screen, which 404s at
 * mount but not afterwards, and from `ai-party-linker-dialog.tsx`, which POSTs
 * here while the dialog is open.
 *
 * ⚠️ **THE TWO PERSON-SIDE „Asociază document" SCREENS ARE NOT AMONG THEM, AND
 * AN ADVERSARIAL ROUND CAUGHT THIS PARAGRAPH SAYING THEY WERE.** They POST to
 * `/api/people/[id]/documents` → `associateDocumentsToPerson`, which reads the
 * archive-wide list and never touches the document, so a document deleted under
 * them still fails on the foreign key and still answers 500. That is the older,
 * wider defect; this one is #34.15's, created the day the offered set for
 * `document-person` became document-derived. Closing the other means an
 * existence check over every id in `documentIds` and is in the handover.
 */
export function documentNotFoundToResponse(err: unknown): Response | null {
  if (!(err instanceof DocumentNotFoundError)) return null;
  return Response.json(
    {
      error: "That document does not exist.",
      code:  "DOCUMENT_NOT_FOUND",
    },
    { status: 404 },
  );
}

/** Standard 400 response from a Zod parse failure. */
export function zodErrorToResponse(err: ZodError): Response {
  return Response.json(
    { error: "Validation failed", details: err.flatten() },
    { status: 400 },
  );
}

/** Catch-all 500 response. Logs the underlying error to the server console. */
export function unexpectedError(err: unknown, context?: string): Response {
  console.error(`[${context ?? "unexpected"}] error:`, err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
