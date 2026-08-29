/**
 * THE one writer that turns a classifier's answer into a document type row.
 *                                                              (Slice #29.06)
 *
 * WHAT IT REPLACES
 * ----------------
 * Two creators, neither of which could win a race and neither of which agreed
 * with the other about when two names are the same name:
 *
 *   - `ensureDocType` (the import wizard) POSTed to the value-lists route and
 *     tested `if (res.ok)`. A 500, a 2xx with no id, or a thrown fetch fell
 *     through a bare `catch {}` to the catch-all type with nothing said to
 *     anyone — so a document whose type create LOST A RACE was filed under
 *     NECLASIFICAT and looked exactly like a document the model could not
 *     classify (findings F1 and F7 of the 29.01 report).
 *   - `ai-interpret` called `createValue` directly, bypassing the route, the
 *     Zod schema and HTTP — and sent no `origin`, so a type no human ever
 *     typed displayed as "Adăugat manual" (finding F2).
 *
 * Everything that classifies a document now comes through here. The import
 * wizard reaches it over `POST /api/document-types/resolve`; `ai-interpret`
 * calls it in-process. The MATCHING half is pure and shared with the wizard's
 * own client-side pass — see `matchDocumentType` — so a match made on the
 * client and a match made here cannot come to different answers.
 *
 * HOW IT WINS THE RACE
 * --------------------
 * The report offered two fixes: answer 409 with the existing row and have the
 * client adopt it, or make the create itself idempotent. This is the second,
 * because with one writer it fixes BOTH callers and neither has to carry retry
 * logic — and because a client cannot hold a retry across a page that the user
 * may close mid-import.
 *
 * Two mechanisms, and a seventh adversarial round is why there are two:
 *
 *   1. **A Postgres advisory lock on the NORMALISED NAME, held across the read
 *      and the insert.** ⚠️ **The retry alone was NOT sufficient, and the
 *      version of this comment it replaces claimed it was.**
 *      `createDocumentTypeRow` re-reads the taken keys immediately before its
 *      insert, so two concurrent creates of one label do not collide at all:
 *      the loser sees the winner's key, computes `..._2`, and commits a SECOND
 *      ROW WITH THE SAME DISPLAY NAME. No error is raised, so no retry can
 *      fire — finding F7, two types from one document, surviving inside its own
 *      fix. Serialising per name closes it: the loser takes the lock after the
 *      winner has committed, re-reads inside it, name-matches, and adopts.
 *   2. **The retry loop**, still needed for the case the lock does not cover:
 *      two DIFFERENT names that slug to one key ("Café" and "Caf"). They hash
 *      to different lock keys, so they run concurrently and the loser's insert
 *      can hit 23505. Round two re-reads, still does not name-match, and
 *      `nextFreeKey` — now seeing the taken key — picks `_2`, so the create
 *      succeeds. That collision costs one extra row, never the attempt budget.
 *      (Measured: it usually costs nothing at all, because the key generator
 *      re-reads inside the same transaction and simply picks `_2` first time.)
 *
 * ⚠️ **The lock number is computed in TypeScript by `advisoryLockKeys`**, the
 * helper the property importer already uses, for the reason stated at its
 * definition: `hashtext` is an internal Postgres function with no compatibility
 * promise, and a server upgrade that changed it would silently stop serialising
 * rather than fail. The key is `doctype:<normalised name>` — the SAME
 * normalisation the matching rule uses, so two spellings of one name take one
 * lock, and a prefix that keeps this lock space clear of the parcel one.
 *
 * ⚠️ **`pg_advisory_xact_lock`, not a row lock and not a unique index.** There
 * is no row to lock — the whole problem is that the row does not exist yet —
 * and a unique index on a normalised-name expression, which would be the
 * stronger fix, needs a migration this slice does not carry (it is named in the
 * handover). The lock is released by COMMIT or ROLLBACK with nothing to clean
 * up; and it serialises creates of a single label and nothing else. The
 * ordinary run, where the type already exists, never reaches it — the match
 * happens before the transaction is opened.
 *
 * ⚠️ **It does NOT serialise the ADMIN door.** `POST /api/admin/value-lists/
 * document-types` — the Reference Data form and the discovery review dialog —
 * takes no lock and performs no name check at all; its duplicate-name refusal
 * is a CLIENT-side test against a list that may be five minutes old. Two rows
 * with one display name are still reachable that way, and the fix is the same
 * unique index on the normalised name, in the migration this slice does not
 * carry. Named here rather than left implied, and in the handover.
 *
 * ⚠️ **`MAX_ATTEMPTS` IS A BUDGET AND NOT A CORRECTNESS TERM.** Every 23505
 * means another row now holds the key this round computed, so the next round's
 * `nextFreeKey` skips it: the loop advances by one key per collision and needs
 * at most as many rounds as there are writers racing on ONE SLUG with
 * DIFFERENT names — the only case that reaches it at all, now that same-name
 * writers are serialised. It was three, which is the number of import tasks the
 * wizard runs at once; a fourth simultaneous writer (a second tab, or the
 * in-process `ai-interpret` resolve overlapping them) exhausted it and threw,
 * reproducing finding F1 inside its own fix. Eight is comfortably above any
 * number this application can produce, and the throw stays as the backstop
 * against a loop nobody has thought of. Exhausting it RETHROWS the last
 * Postgres error, deliberately — the caller's job is to say the create failed,
 * and it cannot say that about an error this function swallowed.
 */

import { asc, sql } from "drizzle-orm";
import { lookupDocumentType } from "@/db/schema";
import { db, type DbTransaction } from "@/db";
import {
  createDocumentTypeRow,
  PREFERRED_KEY_TAKEN,
  type LookupRow,
} from "@/lib/admin/value-lists/queries";
import { pgErrorCode } from "@/lib/api/errors";
import { advisoryLockKeys } from "@/lib/properties/import-property-plan";
import { canonicalTypeKey } from "@/lib/import/classify-prompts";
import { documentTypeIsIdCard } from "@/lib/import/id-card";
import {
  normaliseDocumentTypeName,
  resolveAgainstTypes,
  type ClassifierAnswer,
  type DocumentTypeCandidate,
} from "./document-type-match";

/**
 * What happened, in the caller's words.
 *
 * ⚠️ **`unclassified` carries `id: null` rather than the catch-all's id**, and
 * that is finding F1's fix at its root. Which row a caller falls back to is the
 * CALLER's question — the import wizard files it on the catch-all row
 * (`catchAllType`, key UNCLASSIFIED) and `ai-interpret` leaves the document on
 * the type it already had
 * — and a resolver that answered with the catch-all would make "the model had
 * no idea" and "we picked the catch-all for you" one indistinguishable answer
 * again, which is the whole defect.
 */
export type DocumentTypeResolution =
  | {
      outcome: "matched-key" | "matched-name" | "created" | "adopted";
      id: string;
      key: string;
      name: string;
      /**
       * Is the row this resolved to an identity-card type? (Slice #32.07)
       *
       * ⚠️ **THE SERVER'S ANSWER TO A QUESTION ONLY THE CLIENT USED TO ASK, AND
       * IT CLOSES THE ONE BLIND SPOT #27.05 LEFT OPEN.** `idCardTypeIds` is
       * computed in the BROWSER, inside `enrichDiscoverSteps`, by walking the
       * type list the run read at its start — so it can only judge a type whose
       * discovery read has ALREADY been paid for. For a type this function
       * MINTS mid-run, `docTypeIdCardRef` has no entry (its own docblock says
       * so), the wizard's test collapses to the scan's signal alone, and the
       * scan's signal is exactly the one that is false on a card the scan
       * mislabelled. The permanent write is caught afterwards by
       * `absorbTypeList`; the billed read is not.
       *
       * ⚠️ **AND IT IS A MARK RATHER THAN A REFUSAL, WHICH WAS THE SLICE'S OWN
       * DECISION TO MAKE.** Refusing to mint a type whose proposed NAME reads
       * as an identity card would refuse the case the archive most needs: a
       * card scanned into an archive that has no CARTE_IDENTITATE row yet. That
       * card would land on the catch-all, `getPersonIdCardLink` — which matches
       * `ID_CARD_TYPE_KEYS` — would find nothing, and the identity-card flow
       * would be broken by the guard meant to protect it. A minted card type is
       * CORRECT; a minted card type with a FORM is what must never happen, and
       * that is refused at `createDocumentTypeRow` and at the two doors that
       * can fill one in later.
       *
       * Computed from the ROW's stored key and name, which is why it travels
       * rather than being recomputed by the caller: the wizard's copy of the
       * name is its own label where the server gave none, and its copy of the
       * key is `""` where the body carried no string.
       */
      isIdCard: boolean;
    }
  | { outcome: "unclassified"; id: null };

const MAX_ATTEMPTS = 8;

/**
 * What one pass through the lock decided.
 *
 * ⚠️ **A discriminated union rather than three optional keys**, because
 * TypeScript widens `{a} | {b} | {c}` returned from one callback into a single
 * object with every key optional, and an `in` test then narrows to
 * "possibly undefined" instead of to the branch. Measured, not guessed.
 */
type LockedCreate =
  | { kind: "adopted"; row: DocumentTypeCandidate }
  | { kind: "declined" }
  | { kind: "created"; row: LookupRow };

/**
 * ⚠️ **Read in `listValues`' order, byte for byte, and the order is
 * load-bearing.** Two `lookup_document_type` rows can share a display name —
 * only `key` is UNIQUE — and `matchDocumentType` takes the first that matches.
 * The import wizard matches against the list as `GET /api/admin/value-lists/
 * document-types` served it, which is `listValues`' order; this is that same
 * ORDER BY, restated rather than imported because `listValues` returns whole
 * rows for nine different tables and this needs three columns of one. A plain
 * `ORDER BY name` would agree with it on every archive except one where a type
 * is NAMED the same as the catch-all — and "except one" is exactly the shape
 * of thing this codebase keeps learning to measure rather than assume.
 */
async function readTypes(conn: DbTransaction | typeof db = db): Promise<DocumentTypeCandidate[]> {
  return conn
    .select({
      id:   lookupDocumentType.id,
      key:  lookupDocumentType.key,
      name: lookupDocumentType.name,
    })
    .from(lookupDocumentType)
    .orderBy(
      sql`CASE WHEN key = 'UNCLASSIFIED' THEN 0 ELSE 1 END`,
      asc(lookupDocumentType.name),
    );
}

function textOf(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export async function resolveClassifiedDocumentType(
  answer: ClassifierAnswer,
): Promise<DocumentTypeResolution> {
  /**
   * ⚠️ **Whether we have already lost a race, and it is what makes "adopted"
   * honest.** Without it a second round's name match would report
   * `matched-name` — true in the letter and wrong in the substance: nothing
   * matched when this call started, and the row it is now returning is one
   * another writer made while it was working. The import result screen counts
   * on the difference to know which types this run actually created.
   */
  let raced = false;

  for (let attempt = 1; ; attempt += 1) {
    const rows = await readTypes();
    const resolution = resolveAgainstTypes(rows, answer);
    if (resolution.kind === "match") {
      return {
        // ⚠️ **`raced` alone decides, and it used to be `raced && by name`.**
        // (Slice #29.07.) The old test was written when a lost race could only
        // ever be re-found by NAME — two writers of one label, whose keys came
        // from the same slug. Since a canonical key can now be contended
        // directly, the second round's match is by KEY, and reporting that as
        // `matched-key` would tell the result screen the type already existed
        // when this run's own sibling had just made it. A match after a race is
        // an adoption however it was found: nothing matched when this call
        // started, and a row that existed before it started would have been
        // returned on attempt 1 without ever reaching the create.
        outcome: raced
          ? "adopted"
          : resolution.how === "key"
            ? "matched-key"
            : "matched-name",
        id:       resolution.row.id,
        key:      resolution.row.key,
        name:     resolution.row.name,
        isIdCard: documentTypeIsIdCard(resolution.row),
      };
    }
    if (resolution.kind === "declined") return { outcome: "unclassified", id: null };
    const label = resolution.name;

    try {
      // ⚠️ **EVERYTHING FROM THE LOCK TO THE INSERT IS ONE TRANSACTION, and it
      // has to be.** The read above it is a fast path taken without any lock —
      // on the ordinary run the type already exists and this block is never
      // entered — but once we intend to CREATE, the decision has to be retaken
      // inside the lock, because a concurrent writer may have committed the row
      // between that read and this line. That is not a theoretical window: it
      // is the observed one, two identity cards classified identically 400 ms
      // apart.
      const created: LockedCreate = await db.transaction(async (tx): Promise<LockedCreate> => {
        // ⚠️ **`advisoryLockKeys`, NOT Postgres's `hashtext`, and an eighth
        // review round is why — the argument was already written down in this
        // repo and this slice had to be pointed at it.** The property importer
        // takes the app's other advisory lock and states the reason in as many
        // words: `hashtext` is an internal function with no compatibility
        // promise, so a server upgrade that changed it would break nothing
        // loudly — it would just start hashing the same name to a different
        // lock, two concurrent creates would quietly stop serialising, and the
        // duplicate this transaction exists to prevent would return months
        // later with no diff to blame. A hash computed in TypeScript cannot
        // drift out from under the code that depends on it.
        //
        // ⚠️ **The `doctype:` prefix IS load-bearing now.** With the same
        // two-`int4` overload the property importer uses, both locks live in
        // one lock space, so the prefix is what keeps a document type's lock
        // from colliding with a parcel's. (Under the one-`int8` overload they
        // were separate spaces and the prefix bought nothing — which is what
        // the comment this replaces wrongly credited it with.)
        //
        // Keyed on the same normalisation the matching rule uses, so
        // "Contract de arendă" and "Contract de arenda" take ONE lock.
        const [lockA, lockB] = advisoryLockKeys(
          `doctype:${normaliseDocumentTypeName(label)}`,
        );
        await tx.execute(sql`select pg_advisory_xact_lock(${lockA}::int4, ${lockB}::int4)`);
        // The second look, and the one that decides. A racer that committed
        // while we were waiting for the lock is visible here and is ADOPTED —
        // which is the whole point, and which no amount of retrying could
        // achieve, because its create raises no error to retry.
        const inside = resolveAgainstTypes(await readTypes(tx), answer);
        if (inside.kind === "match") return { kind: "adopted", row: inside.row };
        // ⚠️ **`declined` is impossible here and is still handled.** The label
        // came from `resolveAgainstTypes` moments ago and nothing about the
        // answer has changed — but the ROWS have, and `declinesAgainst` reads
        // them: renaming the catch-all to this very label between the two reads
        // would land here. Creating a second row meaning "no answer" is the one
        // thing that must not happen, so it is answered as what it is.
        if (inside.kind === "declined") return { kind: "declined" };
        return {
          kind: "created",
          // ⚠️ **THE CANONICAL KEY IS OFFERED WHERE THERE IS ONE, AND THAT IS
          // FINDING F6.** (Slice #29.07.) Until now the key was slugged from
          // `inside.name` — the model's free-text LABEL — even when the model
          // had ALSO handed back a key this codebase defines and whitelists.
          // Measured in the 29.01 report: the classifier answered
          // CARTE_IDENTITATE for both identity cards, no catalogue row carried
          // that key because the seed was missing rows, and the documents
          // landed under `CARTE_DE_IDENTITATE` — so `ID_CARD_TYPE_KEYS`,
          // `type-config.ts` and `getPersonIdCardLink`, all of which match the
          // literal canonical key, were looking at a key that would never
          // appear in that database again.
          //
          // ⚠️ **`canonicalTypeKey` re-derives it HERE rather than trusting
          // `answer.typeKey`.** This function is reached over HTTP from the
          // import wizard (`POST /api/document-types/resolve`), so the key on
          // the wire is whatever a client sent; only the catalogue decides
          // whether it is one of ours, and UNCLASSIFIED is refused there for
          // the reason `matchDocumentType` refuses it.
          //
          // ⚠️ **The NAME is still the model's label, and writing the
          // catalogue's stored name instead was tried and rejected — it
          // recreates finding F7 on the archive this slice was written for.**
          // Adrian's archive already holds the rows F6 produced: `Carte de
          // Identitate` keyed CARTE_DE_IDENTITATE. An answer of
          // `{ key: CARTE_IDENTITATE, label: "Buletin" }` name-matches nothing
          // there, so it creates — and creating it as `Carte de Identitate`
          // would put a SECOND row of that display name in every document's
          // dropdown, which the label ("Buletin") does not. The key is the part
          // the codebase has an opinion about; the name is what the model read.
          // What that costs is stated rather than hidden: a misread label
          // lands a badly-named row on a canonical key, and since carve-outs
          // match the key, that row becomes the archive's identity-card (or
          // sale-contract, …) type under a wrong name. Adrian renames it from
          // Reference Data, where a rename cannot touch the key — which is the
          // cheap half of the trade, and the other way round is not repairable
          // at all.
          row: await createDocumentTypeRow(
            tx,
            { name: inside.name, origin: "IMPORT" },
            canonicalTypeKey(answer.typeKey),
          ),
        };
      });

      if (created.kind === "declined") return { outcome: "unclassified", id: null };
      if (created.kind === "adopted") {
        return {
          outcome:  "adopted",
          id:       created.row.id,
          key:      created.row.key,
          name:     created.row.name,
          isIdCard: documentTypeIsIdCard(created.row),
        };
      }
      const createdKey  = textOf(created.row.key, "");
      const createdName = textOf(created.row.name, label);
      return {
        outcome:  "created",
        id:       created.row.id,
        key:      createdKey,
        name:     createdName,
        // The values that were actually written, not the answer's — a create
        // whose preferred key was refused carries a slug, and the NAME is the
        // model's label rather than the catalogue's stored name (see the
        // create block above for why that trade is the right way round).
        isIdCard: documentTypeIsIdCard({ key: createdKey, name: createdName }),
      };
    } catch (err) {
      // ⚠️ **TWO WAYS TO LOSE THIS RACE, AND THEY GET THE SAME ANSWER.**
      // (Slice #29.07 added the second.) A 23505 means another writer took the
      // key this round computed. `PREFERRED_KEY_TAKEN` means another writer
      // took the CANONICAL key this round was asked for — no Postgres error is
      // raised there, because `nextFreeKey` would happily have answered
      // `..._2`; `createDocumentTypeRow` refuses to, precisely so this loop
      // gets a chance to see the row and adopt it. Both are "go round again",
      // and both advance: the next `readTypes()` sees the committed row.
      const lostARace =
        pgErrorCode(err) === "23505" ||
        (err instanceof Error && err.message === PREFERRED_KEY_TAKEN);
      if (!lostARace || attempt >= MAX_ATTEMPTS) throw err;
      raced = true;
    }
  }
}
