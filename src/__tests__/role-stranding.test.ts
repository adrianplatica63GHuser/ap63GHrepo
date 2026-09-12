/**
 * @jest-environment node
 */

/**
 * Slice #34.26 — one role, two documents, and the one with no ticks can never
 * offer it again.
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   „Asociază document" offers every role ticked for SOME document type
 *   whenever 0 or 2+ documents are ticked — deliberately, and `role-offers.ts`
 *   refuses to narrow it — so a save mixing a configured type with an
 *   unconfigured one writes a role that the second document's own type will
 *   never offer again, and the screen said nothing at the moment of writing.
 *   It is DORMANT on today's data — `lookup_doc_type_person_role` is empty, so
 *   the multi-document select renders no options and no role can be chosen —
 *   and becomes reachable the day the first document type is configured. The
 *   slice description read that measurement the other way round; `role-offers
 *   .ts` now carries the correction.
 *
 * WHAT THIS FILE PINS, AND WHY EACH ONE
 *   1. The rule itself, behaviourally, in the pure module: a null role reads
 *      nothing, a document whose own type does not offer the role is NAMED, one
 *      document still loading or failed makes the whole answer unknown rather
 *      than partial, and „failed" outranks „loading" so a failure is not masked
 *      by a sibling still in flight.
 *   2. Both screens render the shared note, always mounted, with the condition
 *      in the prop — and the note component stays OUT of `PICKER_FILES`, which
 *      `carried-role-options.test.ts` §3 builds by searching for whitelist
 *      endpoints. A sentence file that named one would break an eight-screen
 *      count two suites away; `no-roles-for-type-note.tsx` records falling into
 *      exactly that trap first.
 *   3. The sentence exists in both locales, carries its ICU parameter, and says
 *      the association still happens — the half that makes it a warning rather
 *      than a refusal, which is the decision `role-offers.ts` now records.
 *   4. A POST naming a document that does not exist is answered as a bad
 *      DOCUMENT, not a bad role. Pinned at the site that decides it — the
 *      document is looked up BEFORE the role door, asserted by position,
 *      because both reads are in the body either way — and at each of the three
 *      places downstream that carry the answer.
 *   5. The role `<label>` is tied to its `<select>` on all eight screens that
 *      hand out a person role, by `htmlFor` or by nesting. Two of them were
 *      neither until this slice; #34.15's handover recorded it as pre-existing
 *      and copied faithfully.
 */

import fs from "fs";
import path from "path";

import {
  documentsStrandingRole,
  type DocumentRoleOffer,
} from "@/lib/admin/value-lists/role-stranding";
import { DocumentNotFoundError } from "@/lib/documents/document-not-found";
import { documentNotFoundToResponse } from "@/lib/api/errors";
import { associationFailureMessage } from "@/lib/ui/association-failure";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(SRC, ...parts), "utf8");
}

function messages(locale: "ro-RO" | "en-GB"): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "messages", `${locale}.json`), "utf8"));
}

function at(obj: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>(
    (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

/**
 * ⚠️ **A BEHAVIOUR guard must read only code** — the rule
 * `role-attachment-door.test.ts` states and this file inherits. Every module
 * scanned below QUOTES what is searched for in its own header — `queryKey`,
 * `enabled`, `assertRoleMayBeAttached`, `documentNotFoundToResponse` all appear
 * in paragraphs explaining the rule rather than performing it — so a guard that
 * read comments would pass on the prose alone.
 *
 * ⚠️ **§2'S COUNT GUARD IS THE ONE EXCEPTION, AND IT IS DELIBERATE.** It reads
 * `role-stranded-note.tsx` UNSTRIPPED, because the search it mirrors
 * (`carried-role-options.test.ts` §3) does not strip either: for that one
 * assertion a mention in a comment really is a failure, and the first draft of
 * that file proved it by quoting the three spellings inside the very warning
 * telling it not to.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const CONFIGURED = "11111111-1111-4111-8111-111111111111";
const OTHER_ROLE = "22222222-2222-4222-8222-222222222222";

const loaded = (...roleIds: string[]): DocumentRoleOffer => ({ state: "loaded", roleIds });
const LOADING: DocumentRoleOffer = { state: "loading" };
const FAILED: DocumentRoleOffer = { state: "failed" };

const SALE = { id: "doc-sale", label: "Contract de vânzare 12/2019" };
const PLAN = { id: "doc-plan", label: "Plan cadastral 4471/2019" };

function offers(map: Record<string, DocumentRoleOffer>) {
  return (id: string): DocumentRoleOffer => map[id] ?? LOADING;
}

// ---------------------------------------------------------------------------
// 1. The rule, behaviourally
// ---------------------------------------------------------------------------

describe("which ticked documents strand this role", () => {
  it("reads nothing at all when no role is chosen", () => {
    // A counter rather than `jest.fn`, so no type argument has to be guessed:
    // what is being asserted is that the lookup is never reached at all.
    let reads = 0;
    const offerFor = (_id: string): DocumentRoleOffer => {
      reads += 1;
      return LOADING;
    };
    expect(documentsStrandingRole([SALE, PLAN], null, offerFor)).toEqual({
      known: true,
      documents: [],
    });
    expect(documentsStrandingRole([SALE, PLAN], "", offerFor)).toEqual({
      known: true,
      documents: [],
    });
    // ⚠️ The laziness is the point: the screen leaves its per-document reads
    // disabled until a role is picked, so the common path costs no query.
    expect(reads).toBe(0);
  });

  /**
   * ⚠️ **THE REPRO FROM `role-offers.ts`, AS A TEST.** Tick „Contract de
   * vânzare" (configured) and „Plan cadastral" (no ticks at all), pick
   * Vânzător: the list offers it, the door allows it, and the plan is where it
   * becomes unofferable.
   */
  it("names the mixed selection's unconfigured document and only that one", () => {
    expect(
      documentsStrandingRole(
        [SALE, PLAN],
        CONFIGURED,
        offers({ [SALE.id]: loaded(CONFIGURED), [PLAN.id]: loaded() }),
      ),
    ).toEqual({ known: true, documents: [PLAN.label] });
  });

  it("says nothing when every ticked type offers the role", () => {
    expect(
      documentsStrandingRole(
        [SALE, PLAN],
        CONFIGURED,
        offers({ [SALE.id]: loaded(CONFIGURED), [PLAN.id]: loaded(CONFIGURED, OTHER_ROLE) }),
      ),
    ).toEqual({ known: true, documents: [] });
  });

  /**
   * ⚠️ **A TYPE WITH TICKS THAT ARE NOT THIS ONE IS THE SAME ONE-WAY DOOR.**
   * The narrower test — „has this type any ticks at all" — is the repro's
   * shape and would have left this half silent. `role-stranding.ts` says why
   * the wider one is the honest question and why it costs the same query.
   */
  it("names a configured type that simply does not tick this role", () => {
    expect(
      documentsStrandingRole(
        [SALE, PLAN],
        CONFIGURED,
        offers({ [SALE.id]: loaded(CONFIGURED), [PLAN.id]: loaded(OTHER_ROLE) }),
      ),
    ).toEqual({ known: true, documents: [PLAN.label] });
  });

  it("keeps the order the documents were ticked in", () => {
    expect(
      documentsStrandingRole(
        [PLAN, SALE],
        CONFIGURED,
        offers({ [SALE.id]: loaded(), [PLAN.id]: loaded() }),
      ),
    ).toEqual({ known: true, documents: [PLAN.label, SALE.label] });
  });

  /**
   * ⚠️ **ONE UNREAD DOCUMENT AND THE WHOLE ANSWER IS UNKNOWN.** A sentence
   * naming one of two documents would be wrong rather than partial — and an
   * unreadable list is not an empty one, which is the rule
   * `role-attachment.ts` states for its own offered set.
   */
  it("withholds the whole answer when one document is still loading", () => {
    expect(
      documentsStrandingRole(
        [SALE, PLAN],
        CONFIGURED,
        offers({ [SALE.id]: loaded(), [PLAN.id]: LOADING }),
      ),
    ).toEqual({ known: false, because: "loading" });
  });

  it("withholds the whole answer when one document's list failed to load", () => {
    expect(
      documentsStrandingRole(
        [SALE, PLAN],
        CONFIGURED,
        offers({ [SALE.id]: loaded(), [PLAN.id]: FAILED }),
      ),
      // ⚠️ It NAMES the document whose list could not be read: that is the only
      // thing the user can act on — re-ticking it is their only move.
    ).toEqual({ known: false, because: "failed", unreadable: [PLAN.label] });
  });

  /**
   * ⚠️ **„failed" OUTRANKS „loading", AND THE ORDER OF THE TICKS MUST NOT
   * DECIDE IT.** Only „failed" prints a sentence; a failure masked by a sibling
   * still in flight would report a moment for a state that is never going to
   * resolve, and the user would be told nothing at all. Both orders, because a
   * rule that returned at the first unread document would pass one of them.
   */
  it.each([
    ["loading first", [SALE, PLAN], { [SALE.id]: LOADING, [PLAN.id]: FAILED }],
    ["failed first", [PLAN, SALE], { [PLAN.id]: FAILED, [SALE.id]: LOADING }],
  ] as const)("reports failed over loading (%s)", (_label, ticked, map) => {
    expect(documentsStrandingRole(ticked, CONFIGURED, offers({ ...map }))).toEqual({
      known: false,
      because: "failed",
      unreadable: [PLAN.label],
    });
  });

  /**
   * ⚠️ **EVERY UNREADABLE DOCUMENT, NOT THE FIRST ONE.** The other reason
   * `documentsStrandingRole` scans the whole list — and the one an optimiser
   * breaks in silence, because returning at the first failure satisfies the
   * „failed outranks loading" cases above completely. Naming one of five
   * unreadable documents is the „some of the selected documents" this design
   * rejects. Order follows the ticks.
   */
  it("names every unreadable document, in the order they were ticked", () => {
    expect(
      documentsStrandingRole(
        [SALE, PLAN],
        CONFIGURED,
        offers({ [SALE.id]: FAILED, [PLAN.id]: FAILED }),
      ),
    ).toEqual({ known: false, because: "failed", unreadable: [SALE.label, PLAN.label] });
  });

  /**
   * ⚠️ **AND THE FAILED ARM IS NEVER BUILT EMPTY**, because the note's gate is
   * `unreadable.length > 0` — a verdict carrying an empty array would render
   * nothing, which is the silence the arm exists to break.
   */
  it("never reports a failure with nothing to name", () => {
    // ⚠️ **`expect.assertions`, BECAUSE THE GUARD BELOW CAN SKIP ITSELF.**
    // `expect(verdict.known).toBe(false)` passes for BOTH `known: false` arms
    // and does not narrow (Jest's `expect` is not an assertion signature), so
    // a rule that answered „loading" here would take the `if` false, run one
    // assertion, and go green under a name promising the opposite. The count
    // is the convention `role-attachment-door.test.ts` already uses for this
    // shape. An adversarial round found it.
    expect.assertions(2);
    const verdict = documentsStrandingRole(
      [SALE, PLAN],
      CONFIGURED,
      offers({ [SALE.id]: loaded(CONFIGURED), [PLAN.id]: FAILED }),
    );
    expect(verdict.known).toBe(false);
    if (!verdict.known && verdict.because === "failed") {
      expect(verdict.unreadable.length).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠️ **NO SPECIAL CASE FOR ONE TICKED DOCUMENT.** With exactly one ticked the
   * screen already offers that document's own whitelist, so the general rule
   * answers `[]` by construction — and would go on saying something true if the
   * screen ever stopped narrowing.
   */
  it("says nothing for a single ticked document whose own list was the offer", () => {
    expect(
      documentsStrandingRole([SALE], CONFIGURED, offers({ [SALE.id]: loaded(CONFIGURED) })),
    ).toEqual({ known: true, documents: [] });
  });

  it("says nothing when nothing is ticked", () => {
    expect(documentsStrandingRole([], CONFIGURED, offers({}))).toEqual({
      known: true,
      documents: [],
    });
  });

  /** The rule module stays pure: an import here is the split collapsing. */
  it("keeps the rule free of the database and of React", () => {
    const rule = read("lib", "admin", "value-lists", "role-stranding.ts");
    expect(stripComments(rule)).not.toMatch(/^import /m);
  });
});

// ---------------------------------------------------------------------------
// 2. Both screens render it, and the note stays out of the picker population
// ---------------------------------------------------------------------------

const ASSOCIATE_DOCUMENT_VIEWS = [
  "app/judicial-persons/[id]/associate-document/associate-document-view.tsx",
  "app/natural-persons/[id]/associate-document/associate-document-view.tsx",
];

describe("the save-time sentence on the person-side associate-document screens", () => {
  /**
   * ⚠️ **ONE COMPONENT, NEVER TWO COPIES** — the drift `carried-roles-merge.ts`
   * and `role-offers.ts` each refuse for their own rule, and these two screens
   * are near-copies of one another, which is how a copy would get made.
   */
  it.each(ASSOCIATE_DOCUMENT_VIEWS)("%s renders the shared note", (file) => {
    const src = read(...file.split("/"));
    expect(src).toContain('from "@/components/forms/role-stranded-note"');
    expect(src).toContain('from "@/lib/admin/value-lists/role-stranding"');
    expect(src).toContain("<RoleStrandedNote");
  });

  /**
   * ⚠️ **MOUNTED UNCONDITIONALLY, WITH THE CONDITION IN THE PROP.** The note
   * owns an `aria-live` region, and a live region that appears together with
   * its content is not reliably announced — the rule `value-list-modal.tsx`
   * holds and `no-roles-for-type-note.tsx` restates. `{cond && <Note/>}` is the
   * obvious shape and is the one that breaks it.
   */
  it.each(ASSOCIATE_DOCUMENT_VIEWS)("%s mounts it unconditionally", (file) => {
    const src = read(...file.split("/"));
    expect(src).not.toMatch(/&&\s*<RoleStrandedNote/);
    // ⚠️ **THE VERDICT WHOLE.** Flattening it to a `string[]` at the call site
    // is what made the first draft render „loading" and „failed" the same way,
    // and „failed" is the one that must speak.
    expect(src).toContain("<RoleStrandedNote verdict={strandedByThisRole} />");
  });

  /**
   * ⚠️ **THE SAME `queryKey` THE SINGLE-SELECTION READ USES.** Ticking a second
   * document must not re-fetch the first, and more than that: two keys for one
   * question is two answers that agree today.
   */
  it.each(ASSOCIATE_DOCUMENT_VIEWS)("%s reads per-document roles under the shared key", (file) => {
    const src = stripComments(read(...file.split("/")));
    expect(src).toContain("useQueries(");
    expect((src.match(/queryKey: \["document-valid-roles", /g) ?? []).length).toBe(2);
  });

  /**
   * ⚠️ **AND ONLY ONCE A ROLE IS CHOSEN.** Without this the screen would fire a
   * read per ticked row on every checkbox click, for a sentence that cannot say
   * anything until a role is picked.
   */
  it.each(ASSOCIATE_DOCUMENT_VIEWS)("%s leaves those reads disabled until a role is chosen", (file) => {
    expect(stripComments(read(...file.split("/")))).toContain('enabled:  selectedRoleId !== ""');
  });

  /**
   * ⚠️ **THE TWO SCREENS STAY BYTE-IDENTICAL.** They were before this slice and
   * `carried-role-options.test.ts` treats them as one decision in two files. A
   * change applied to one of them is the first half of a divergence.
   */
  it("keeps the two screens identical", () => {
    const [a, b] = ASSOCIATE_DOCUMENT_VIEWS.map((f) => read(...f.split("/")));
    expect(a).toEqual(b);
  });

  /**
   * ⚠️ **THE NOTE COMPONENT MUST NOT NAME A WHITELIST ENDPOINT.**
   * `carried-role-options.test.ts` §3 builds `PICKER_FILES` by SEARCHING every
   * `.tsx` under `src/` for these three strings, so that a picker nobody listed
   * still fails the eight-screen count. This file is not a picker; it is what a
   * picker renders beside itself. Naming one here — in code OR in prose, since
   * that search does not strip comments — puts it in that population and breaks
   * a count two suites away. Asserted here rather than left to be discovered
   * there, because the failure would read as being about pickers.
   */
  it("keeps the note out of the picker population", () => {
    const note = read("components", "forms", "role-stranded-note.tsx");
    expect(note).not.toMatch(/usePersonRoleOptions\(|valid-person-roles|doc-type-person-roles\/distinct-roles/);
  });

  /**
   * `status`, not `alert`, on BOTH branches. Not because nothing has gone wrong
   * — on the unreadable branch a GET failed — but because nothing is refused
   * and the choice is intact, which is what separates this from
   * `shared.roleListUnavailable`, an `alert` on all eight screens because there
   * the select is empty and the choice is gone. The component carries the
   * argument.
   */
  it("is the polite half of the pair", () => {
    const note = read("components", "forms", "role-stranded-note.tsx");
    expect(note).toContain('role="status"');
    expect(note).toContain('aria-live="polite"');
    // `sr-only` rather than an empty <div>: these screens lay out in a
    // `flex flex-col gap-6`, where a zero-height flex item still costs a gap.
    expect(note).toContain('"sr-only"');
  });

  /**
   * ⚠️ **ONLY „failed" SPEAKS, AND „loading" MUST NOT.** Without this the note
   * flashes „could not be checked" on every ordinary visit, in the window
   * between picking a role and the reads landing.
   */
  it("speaks for a failed read and stays silent while loading", () => {
    const note = stripComments(read("components", "forms", "role-stranded-note.tsx"));
    // ⚠️ **THE RENDER BRANCH, NOT THE ABSENCE OF THE WORD „loading".** The
    // first draft banned that string anywhere in the stripped component, which
    // passes today and fails a correct future edit — `aria-busy` on a pending
    // live region is the obvious one — with a message about the note speaking
    // while loading, which it still would not be doing.
    expect(note).toContain('verdict.because === "failed" ? verdict.unreadable : []');
    expect(note).toContain("unreadable.length > 0 ? (");
  });
});

// ---------------------------------------------------------------------------
// 3. The sentence itself
// ---------------------------------------------------------------------------

describe("shared.roleStranded", () => {
  it.each(["ro-RO", "en-GB"] as const)("%s has it, with its ICU parameters", (locale) => {
    const s = at(messages(locale), "shared.roleStranded") as string;
    expect([locale, typeof s]).toEqual([locale, "string"]);
    // Without these the placeholders could be renamed and every other assertion
    // here would pass while the screen printed the literal „{documents}".
    expect([locale, s.includes("{documents}")]).toEqual([locale, true]);
    // ⚠️ **`plural`, BECAUSE THE CANONICAL REPRO NAMES EXACTLY ONE DOCUMENT** —
    // one configured type and one that is not. A hard plural would be wrong on
    // the commonest path rather than on an edge; an adversarial round found it.
    expect([locale, s.includes("{count, plural,")]).toEqual([locale, true]);
  });

  it.each(["ro-RO", "en-GB"] as const)("%s has the could-not-check sentence", (locale) => {
    const s = at(messages(locale), "shared.roleStrandedUnknown") as string;
    expect([locale, typeof s]).toEqual([locale, "string"]);
    // ⚠️ **IT NAMES THE DOCUMENTS TOO.** The note's header argues that „some of
    // the selected documents" leaves the user to work out which, on a screen
    // whose ticked rows span pages — and the first draft of this branch said
    // exactly that, because the verdict carried no labels.
    expect([locale, s.includes("{documents}")]).toEqual([locale, true]);
    expect([locale, s.includes("{count, plural,")]).toEqual([locale, true]);
  });

  /**
   * ⚠️ **BOTH SENTENCES SAY THE ASSOCIATION STILL HAPPENS, AND THE SECOND MUST
   * NOT SAY THE ROLE IS OPTIONAL.** That clause belongs to
   * `shared.roleListUnavailable`, where the select is empty and no role CAN be
   * chosen. This sentence is unreachable unless a role HAS been chosen and the
   * save will write it, so „rolul este oricum opțional" would read as „nothing
   * is at stake" at the one moment something is. An adversarial round found the
   * first draft borrowing it.
   */
  it("says in Romanian that the chosen role is written anyway, and never that it is optional", () => {
    const s = at(messages("ro-RO"), "shared.roleStrandedUnknown") as string;
    expect(s).toContain("Asocierea se va face");
    expect(s).not.toContain("opțional");
  });

  it("is what the note actually passes", () => {
    const note = read("components", "forms", "role-stranded-note.tsx");
    expect(note).toContain("count: stranded.length,");
    expect(note).toContain('documents: stranded.join(", "),');
    // ⚠️ **AND THE OTHER BRANCH'S ARGUMENTS TOO.** `stranded` is in scope on
    // the unreadable branch, is the same type, and is the name the paired
    // branch uses — so a copy-paste there passes `count: 0` and an empty list,
    // which renders the `other` arm with nothing after the colon, every suite
    // green.
    expect(note).toContain("count: unreadable.length,");
    expect(note).toContain('documents: unreadable.join(", "),');
  });

  /**
   * ⚠️ **IT SAYS THE ASSOCIATION STILL HAPPENS, AND THAT IS THE DECISION RATHER
   * THAN A COURTESY.** `role-offers.ts` records why this is a sentence and not
   * a refusal: a refusal would take away an attachment that is legitimate,
   * visible and correctly displayed. A rewording that dropped this half would
   * turn the warning into a block the code does not perform.
   */
  it("says in Romanian that the association is still made", () => {
    expect(at(messages("ro-RO"), "shared.roleStranded")).toContain("Asocierea se va face");
  });
});

// ---------------------------------------------------------------------------
// 4. A bad document reads as a bad document
// ---------------------------------------------------------------------------

describe("a POST naming a document that does not exist", () => {
  /**
   * ⚠️ **THE DOCUMENT IS LOOKED UP BEFORE THE ROLE DOOR, AND POSITION IS THE
   * WHOLE ASSERTION.** Both reads are in the body either way; what makes the
   * answer right is which one gets to throw first. The offered set for a
   * missing document is `[]`, and an empty offered set refuses every role — so
   * after the door there is nothing left to attribute correctly.
   */
  it("is decided before the role is", () => {
    const body = stripComments(read("lib", "documents", "queries.ts"));
    const fn = body.slice(body.indexOf("export async function associatePersonsToDocument("));
    const missing = fn.indexOf("DocumentNotFoundError");
    const door = fn.indexOf("assertRoleMayBeAttached(");
    const insert = fn.indexOf(".insert(");
    expect(missing).toBeGreaterThanOrEqual(0);
    expect(door).toBeGreaterThan(missing);
    expect(insert).toBeGreaterThan(door);
  });

  /** 404 and a `code`, because 400 is what the other two refusals answer. */
  it("is answered 404 with a code of its own", async () => {
    const res = documentNotFoundToResponse(new DocumentNotFoundError("doc-1"));
    expect(res?.status).toBe(404);
    expect(await res?.json()).toMatchObject({ code: "DOCUMENT_NOT_FOUND" });
  });

  it("ignores everything that is not it", () => {
    expect(documentNotFoundToResponse(new Error("boom"))).toBeNull();
    expect(documentNotFoundToResponse(null)).toBeNull();
    expect(documentNotFoundToResponse({ code: "DOCUMENT_NOT_FOUND" })).toBeNull();
  });

  /** Tried before the role refusal in the one route that can produce it. */
  it("is tried first in the route's catch", () => {
    const route = stripComments(read("app", "api", "documents", "[id]", "persons", "route.ts"));
    const missing = route.indexOf("documentNotFoundToResponse(");
    const refusal = route.indexOf("roleNotOfferedToResponse(");
    expect(missing).toBeGreaterThanOrEqual(0);
    expect(refusal).toBeGreaterThan(missing);
  });

  /**
   * ⚠️ **MATCHED ON `code`, AND THE SENTENCE IS ROMANIAN.** The route's `error`
   * is English by design — it is written for a hand-made request — so a screen
   * that fell through to it would show English to a user reaching this in the
   * ordinary course: a document deleted in another session.
   */
  it("reaches the screen in Romanian", () => {
    const ro = at(messages("ro-RO"), "shared.documentNotFound") as string;
    expect(typeof ro).toBe("string");
    expect(
      associationFailureMessage({ error: "That document does not exist.", code: "DOCUMENT_NOT_FOUND" }, 404, "ROL", ro),
    ).toBe(ro);
  });

  it.each(["ro-RO", "en-GB"] as const)("%s has shared.documentNotFound", (locale) => {
    expect([locale, typeof at(messages(locale), "shared.documentNotFound")]).toEqual([locale, "string"]);
  });

  /**
   * ⚠️ **THE FOURTH ARGUMENT IS OPTIONAL, AND THE SEVEN OTHER SCREENS RELY ON
   * IT.** Their routes cannot produce this code; a required parameter would
   * make all eight carry a sentence one of them can show. Omitted, the code
   * falls through exactly as an unrecognised one always has.
   */
  it("falls through for a caller that passes no sentence for it", () => {
    expect(
      associationFailureMessage({ error: "That document does not exist.", code: "DOCUMENT_NOT_FOUND" }, 404, "ROL"),
    ).toBe("That document does not exist.");
  });

  it("is the document screen that passes it", () => {
    const src = read("app", "documents", "[id]", "associate-person", "associate-person-view.tsx");
    expect(src).toContain('tShared("documentNotFound")');
  });
});

// ---------------------------------------------------------------------------
// 5. The role label is tied to its select, on every screen that has one
// ---------------------------------------------------------------------------

/**
 * The eight screens that hand out a person role — the same population
 * `carried-role-options.test.ts` §3 builds, and SEARCHED here for the same
 * reason: a ninth screen fails this instead of shipping an unlabelled control.
 */
const ROLE_PICKER_SOURCE = /usePersonRoleOptions\(|valid-person-roles|doc-type-person-roles\/distinct-roles/;

/**
 * ⚠️ **`__tests__` IS SKIPPED, AND THE EXCLUSION IS NOT COSMETIC.** This file
 * quotes all three picker spellings — in `ROLE_PICKER_SOURCE` and in §2's
 * absence guard — so scanning itself would report itself. It is saved today
 * only by the `.tsx` filter, and the day someone adds a `.tsx` component test
 * under `src/__tests__` the count below fails with a message about picker
 * screens. Both sibling suites carry this skip; the first draft here did not.
 */
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(full);
    return e.isFile() && full.endsWith(".tsx") ? [full] : [];
  });
}

const ROLE_PICKER_FILES = walk(SRC)
  .filter((f) => ROLE_PICKER_SOURCE.test(fs.readFileSync(f, "utf8")))
  .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
  .sort();

/**
 * The `<label>` element that contains `{t("labelRole")}`, whole.
 *
 * ⚠️ **READ AS ONE ELEMENT, NEVER AS „the file contains `htmlFor`".** Four of
 * these screens have other labelled inputs — „Nume", „Cod", „Căutare" — and a
 * `toContain` over the whole source is satisfied by any of them while the role
 * control stays unlabelled, which is the state #34.15 shipped.
 */
function roleLabelElement(src: string): string {
  const marker = src.indexOf('{t("labelRole")}');
  if (marker < 0) throw new Error("no labelRole on this screen");
  const open = src.lastIndexOf("<label", marker);
  const close = src.indexOf("</label>", marker);
  if (open < 0 || close < 0) throw new Error("labelRole is not inside a <label>");
  return src.slice(open, close + "</label>".length);
}

describe("the role label", () => {
  it("is on all eight screens that hand out a person role", () => {
    expect(ROLE_PICKER_FILES).toEqual([
      "app/documents/[id]/associate-person/associate-person-view.tsx",
      "app/judicial-persons/[id]/associate-document/associate-document-view.tsx",
      "app/judicial-persons/[id]/associate-person/associate-person-view.tsx",
      "app/judicial-persons/[id]/associate-property/associate-property-view.tsx",
      "app/natural-persons/[id]/associate-document/associate-document-view.tsx",
      "app/natural-persons/[id]/associate-person/associate-person-view.tsx",
      "app/natural-persons/[id]/associate-property/associate-property-view.tsx",
      "app/properties/[id]/associate-person/associate-person-view.tsx",
    ]);
  });

  /**
   * ⚠️ **EITHER SPELLING COUNTS, AND BOTH ARE REAL.** Four of these screens
   * name the control with `htmlFor`; two wrap the `<select>` inside the
   * `<label>`, which associates it just as well and is not worth rewriting. The
   * two „Asociază persoană" screens for person-to-person references had
   * NEITHER until Slice #34.26 — #34.15 built the judicial one as a copy of the
   * natural one and copied that faithfully, recording it in its handover as
   * pre-existing. Clicking the word „Rol" did nothing and a screen reader read
   * the control unlabelled.
   */
  it.each(ROLE_PICKER_FILES)("%s ties it to its select", (file) => {
    const label = roleLabelElement(read(...file.split("/")));
    const named = /htmlFor=/.test(label);
    const wrapped = label.includes("<select");
    expect([file, named || wrapped]).toEqual([file, true]);
  });
});
