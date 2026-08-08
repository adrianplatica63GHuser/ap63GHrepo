/**
 * The property step's decisions, with no database in them.   (Slice #26.07)
 *
 * WHY THIS IS A SEPARATE MODULE FROM `import-property.ts`
 * ──────────────────────────────────────────────────────
 * Everything here is a pure function of values, and everything next door needs
 * a connection. Keeping them together compiled perfectly well and made both of
 * these untestable in one stroke: a suite that wants to ask "what does the plan
 * say when the match already has corners?" would have had to import `@/db`,
 * open a `pg` Pool and pull in drizzle to ask a question about two integers.
 *
 * The split is not filing. `planForMatches` is a table of five outcomes, one of
 * which — `ambiguous` — exists to refuse a state this archive genuinely holds,
 * and the cost of a wrong cell in it is not a crash but a user ticking a box
 * that promises one thing and does another. That is a thing to hold a test
 * against every row of, and now it can be.
 */

import { cadastralValue } from "./cadastral-identity";

/** What the import needs to know about a Property it found. */
export type CadastralMatch = {
  id: string;
  code: string;
  nickname: string | null;
  principalObjectId: string;
  /** As stored — the decoded `47/2`, not the folder's `47per2`. */
  tarlaSola: string | null;
  parcela: string | null;
  /** Rows in `property_corner`. There is no geometry column; this is the shape. */
  cornerCount: number;
};

/** One property folder, as the plan is asked about it. */
export type PropertyFolderInput = {
  folderName: string;
  tarlaSola: string;
  parcela: string;
  offeredCornerCount: number;
};

// ---------------------------------------------------------------------------
// The advisory-lock key
// ---------------------------------------------------------------------------

/**
 * A stable pair of 32-bit lock numbers for a parcel identity.
 *
 * Computed here rather than by Postgres's `hashtext`, and the reason is not
 * taste: `hashtext` is an internal function with no compatibility promise, and
 * a server upgrade that changed it would break nothing loudly — it would just
 * start hashing the same parcel to a different lock, so two concurrent creates
 * would quietly stop serialising and the duplicate this module exists to
 * prevent would return, months later, with no diff to blame. A hash computed in
 * this file cannot drift out from under the code that depends on it.
 *
 * **A PAIR, because `pg_advisory_xact_lock` has a two-`int4` overload.** The
 * other overload takes one `int8`, which in JavaScript means a `bigint` — and
 * this project targets ES2017, where a `bigint` LITERAL does not compile
 * (`TS2737`) and every constant here would have to be written as a
 * `BigInt("0x…")` call. Two 32-bit signed integers say the same thing in
 * numbers the language already has, and `int4` is what `| 0` produces
 * naturally.
 *
 * Two INDEPENDENT hashes rather than the halves of one, so that a collision
 * needs both to collide. FNV-1a and djb2 disagree about almost everything,
 * which is the property being bought.
 *
 * `Math.imul` is not decoration either: a plain `*` on two large 32-bit values
 * exceeds 2^53 and loses low bits to the float mantissa — silently, and the
 * symptom would be extra collisions rather than an error.
 */
export function advisoryLockKeys(identity: string): [number, number] {
  let fnv = 0x811c9dc5 | 0;
  let djb = 5381 | 0;
  for (let i = 0; i < identity.length; i++) {
    const c = identity.charCodeAt(i);
    fnv = Math.imul(fnv ^ c, 0x01000193) | 0;
    djb = (Math.imul(djb, 33) + c) | 0;
  }
  return [fnv, djb];
}

// ---------------------------------------------------------------------------
// The plan — what WOULD happen, before anything does
// ---------------------------------------------------------------------------

/**
 * One property folder, as the confirmation screen needs to describe it.
 *
 * Why a plan exists at all, when `ensurePropertyForFolder` without a `confirm`
 * already writes nothing: because a chosen folder holds up to five property
 * folders, and "creates the Property before any document is created" has to be
 * true of the RUN, not of each folder in turn. Asking about folder one, acting
 * on the answer, and only then discovering that folder four needs a decision
 * leaves a Property created for an import the user then abandons. The plan puts
 * every question on one screen before the first write.
 */
export type PropertyFolderPlan = {
  /** The subfolder, as it is on disk. */
  folderName: string;
  /** What will be WRITTEN — `perToSlash` already applied. */
  tarlaSola: string;
  parcela: string;
  /**
   *  - `create`    — nothing matches; a Property will be created.
   *  - `link`      — exactly one matches; the user must confirm.
   *  - `ambiguous` — more than one matches. Nothing can proceed for this
   *                  folder: the archive already holds two Properties for one
   *                  parcel, and choosing between them is not the import's
   *                  call. See `findPropertiesByCadastralIdentity`.
   */
  action: "create" | "link" | "ambiguous";
  matches: CadastralMatch[];
  /** Corners this folder's coordinate file offers. 0 when it has none. */
  offeredCornerCount: number;
  /**
   * Corners that will be ADDED to an existing Property if the user agrees.
   * Non-zero only when the match has none of its own — the brief's second
   * confirmation, and the only case where an existing Property is written to.
   */
  cornersToAdd: number;
  /**
   * Corners the match already has and will KEEP. Non-zero here means the
   * folder's coordinate file will be read and not used, which the screen says
   * out loud rather than leaving the user to infer from a count that did not
   * change.
   */
  cornersKept: number;
};

/**
 * The decision, given what the database holds. Pure — every branch is a table
 * row in the tests, which is not true of anything that has to reach Postgres
 * to be asked a question.
 */
export function planForMatches(
  folder: { folderName: string; tarlaSola: string; parcela: string; offeredCornerCount: number },
  matches: CadastralMatch[],
): PropertyFolderPlan {
  const base = {
    folderName: folder.folderName,
    tarlaSola: cadastralValue(folder.tarlaSola),
    parcela: cadastralValue(folder.parcela),
    matches,
    offeredCornerCount: folder.offeredCornerCount,
  };

  if (matches.length === 0) {
    return { ...base, action: "create", cornersToAdd: 0, cornersKept: 0 };
  }
  if (matches.length > 1) {
    return { ...base, action: "ambiguous", cornersToAdd: 0, cornersKept: 0 };
  }

  const existing = matches[0];
  return {
    ...base,
    action: "link",
    cornersToAdd: existing.cornerCount === 0 ? folder.offeredCornerCount : 0,
    cornersKept: existing.cornerCount,
  };
}
