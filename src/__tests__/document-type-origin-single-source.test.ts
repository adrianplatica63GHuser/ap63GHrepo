/**
 * `origin` is written once, read in one place, and coloured in one place.
 *                                                            (Slice #26.12)
 *
 * Same shape of guard as `button-styles-single-source.test.ts` and
 * `activity-cue-single-source.test.ts`, and it exists because this slice's
 * whole premise — do not store a status, derive it — only holds while the
 * derivation has exactly one home. Three ways it could quietly stop holding:
 *
 *   1. **A second component hand-writes the colours.** The Documents list, a
 *      dropdown, a report: any of them could reach for blue-and-green and get
 *      the rule subtly wrong (colouring by origin alone, so a hand-added type
 *      with a form stays black). Nothing would fail; a colour that disagrees
 *      with the word beside it reads as a design choice.
 *
 *   2. **A second caller claims IMPORT.** Origin is the ONE fact that cannot be
 *      recomputed, so a path that invents it is unfalsifiable afterwards.
 *
 *   3. **The PUT starts writing it.** This is the one that nearly happened:
 *      the value-lists update is a full-replace `.set(parsed.data)`, and the
 *      admin edit form sends only `{ name }`. Had `origin` stayed on the shared
 *      schema with a `.default("MANUAL")`, renaming an imported type would have
 *      silently re-originated it. Two guards stop that — the update schema
 *      cannot name the column, and `updateValue` strips it anyway — and both
 *      are pinned here, because a guard nobody tests is a guard somebody
 *      deletes as redundant.
 *
 * The SQL bind at the end is the fourth: the TS value set and the CHECK
 * constraint are one decision written in two languages, and only a test can
 * hold them together.
 */

import fs from "fs";
import path from "path";
import {
  DOCUMENT_TYPE_ORIGINS,
  DOCUMENT_TYPE_STATUS_CLASS,
  DOCUMENT_STATUS_CLASS,
} from "@/lib/documents/status";
import {
  LIST_SCHEMAS,
  LIST_UPDATE_SCHEMAS,
  documentTypeSchema,
  documentTypeUpdateSchema,
  stripDocumentTypeOrigin,
} from "@/lib/admin/value-lists/validation";
import { VALID_LIST_KEYS } from "@/lib/admin/value-lists/config";
import { propertyCreateSchema } from "@/lib/properties/validation";

const SRC = path.join(process.cwd(), "src");
const STATUS_MODULE = "lib/documents/status.ts";

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const FILES = walk(SRC);

function rel(file: string): string {
  return path.relative(SRC, file).split(path.sep).join("/");
}

const SELF = "__tests__/document-type-origin-single-source.test.ts";

/** Same, minus the test tree — for tokens a test must quote in order to assert on them. */
function productionFilesContaining(needle: string | RegExp): string[] {
  return filesContaining(needle).filter((f) => !f.startsWith("__tests__/"));
}

/** Files matching a literal or a pattern, excluding this test (which quotes them all). */
function filesContaining(needle: string | RegExp): string[] {
  return FILES
    .filter((f) => rel(f) !== SELF)
    .filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return typeof needle === "string" ? src.includes(needle) : needle.test(src);
    })
    .map(rel)
    .sort();
}

describe("the status colours have one home", () => {
  // ⚠️ `DOCUMENT_STATUS_CLASS.new` is deliberately NOT in this list. Its value
  // — the neutral zinc pill — is shared with the calculation-history badges,
  // which are a different feature with the same idea of "nothing yet". Pinning
  // it would fail on arrival and teach the next person to add an allowlist
  // entry instead of reading the rule. The three that DO carry the meaning are
  // pinned, and they are the three a second component would reach for.
  const OWNED = [
    DOCUMENT_TYPE_STATUS_CLASS.aiScanned,
    DOCUMENT_TYPE_STATUS_CLASS.aiCompleted,
    DOCUMENT_STATUS_CLASS.imported,
    DOCUMENT_STATUS_CLASS.aiProcessed,
  ];

  it.each(OWNED)("%s appears only in the status module", (classes) => {
    expect(filesContaining(classes)).toEqual([STATUS_MODULE]);
  });

  // ⚠️ A literal guard catches COPIED CLASSES. It does not catch a component
  // that imports the map and indexes it with its own rule — which is the bug
  // the header describes, and which duplicates no literal at all:
  //   DOCUMENT_TYPE_STATUS_CLASS[row.origin === "IMPORT" ? "aiScanned" : "new"]
  // renders a hand-added type WITH a form in black. So the map may only be
  // indexed where the status is decided, plus the one component that receives
  // an already-decided status as a prop.
  it("lets nothing outside the status module pick a type class by hand", () => {
    expect(productionFilesContaining("DOCUMENT_TYPE_STATUS_CLASS[")).toEqual([STATUS_MODULE]);
  });

  // The document map is indexed by the BADGE rather than by a function here,
  // because the status arrives at that component already decided (page.tsx
  // derives it server-side). One component, named.
  it("lets only the badge index the document class map", () => {
    expect(productionFilesContaining("DOCUMENT_STATUS_CLASS[")).toEqual([
      "app/documents/_components/document-detail-tabs.tsx",
    ]);
  });

  // …and the derivation is not dead code. Without this, deleting the call from
  // the modal leaves every other assertion in both new files green.
  it("is actually called by the two surfaces that show it", () => {
    const modal = fs.readFileSync(
      path.join(SRC, "app/admin/value-lists/_components/value-list-modal.tsx"), "utf8");
    expect(modal).toContain("documentTypeNameClass({");
    expect(modal).toContain("documentTypeStatus({");
    // Slice #27.07 — and the FILTER, over the same derivation. Same argument as
    // the two above: without this, swapping the call for a hand-written
    // `parseTemplateFields(row.templateFields).length === 0` leaves every other
    // assertion in this file and in `document-status.test.ts` green, and the
    // list quietly grows a second rule that agrees with the colour beside it
    // right up until one of the two is edited. (`documentTypeAwaitsForm`'s tie
    // to `documentTypeStatus` is asserted over every template shape there; this
    // is the half that says the modal is on the tied side of it.)
    expect(modal).toContain("documentTypeAwaitsForm({");

    const tabs = fs.readFileSync(
      path.join(SRC, "app/documents/_components/document-detail-tabs.tsx"), "utf8");
    expect(tabs).toContain("DOCUMENT_STATUS_CLASS[status]");

    const page = fs.readFileSync(path.join(SRC, "app/documents/[id]/page.tsx"), "utf8");
    expect(page).toContain("documentStatus({");
  });
});

describe("only the import claims an IMPORT origin", () => {
  /**
   * ⚠️ **REPOINTED, NOT RELAXED.   (Slice #29.06)**
   *
   * The single writer used to be `ensureDocType` in the import wizard, and this
   * guard named that file. #29.06 moved it: a classifier's answer now becomes a
   * `lookup_document_type` row in exactly one place, `resolveClassifiedDocument-
   * Type`, which the wizard reaches over `POST /api/document-types/resolve` and
   * `ai-interpret` calls in-process. The claim this test makes is unchanged and
   * is now stronger — before the move, `ai-interpret` created types too and
   * sent no origin at all, so a type no human typed read "Adăugat manual"
   * (finding F2 of the 29.01 report).
   *
   * Deleting either assertion instead of repointing it would remove the only
   * thing standing between the archive and a third writer, which is the whole
   * argument in this file's header: origin cannot be recomputed, so a path that
   * invents it is unfalsifiable afterwards.
   *
   * ⚠️ **WIDENED TO TWO, NOT RELAXED TO "AT LEAST ONE".   (Slice #34.02)**
   *
   * #34.02 gave `lookup_tarla` and `lookup_institution` the same column, and
   * the tarla auto-seed inside `createPropertyIn` is the second writer of the
   * literal. Widening a guard to make a build green is exactly the move this
   * file's header warns about, so the shape of the assertion is unchanged —
   * still an exact `toEqual` over a CLOSED list, still sorted, so a third
   * writer fails it the same way a second one did. What changed is that the
   * list has two entries and each has to be argued for:
   *
   *   lib/documents/resolve-document-type.ts  a classifier's answer becomes a
   *                                           document type. #29.06.
   *   lib/properties/queries.ts               a folder name becomes a tarla
   *                                           code. #34.02 — and this one is
   *                                           STRONGER than the first, because
   *                                           it takes no origin parameter and
   *                                           reads no payload, where the
   *                                           document-type path accepts
   *                                           `origin` from the request body.
   *
   * ⚠️ **`MENTIONS_ALLOWED` is deliberately NOT the list used here.** That map
   * is about the document-type column and keeps its own two-writer assertion
   * below (`keeps both writers inside an import`), which requires every writer
   * to live under `lib/import/` or `app/admin/import/`. The tarla seed lives in
   * `lib/properties/` and is not a document-type writer at all, so folding it
   * into that map would break a true statement about a different column to
   * accommodate this one.
   */
  /** The document-type writer. Its own two assertions below name it directly. */
  const ORIGIN_WRITER = "lib/documents/resolve-document-type.ts";
  /** The tarla writer. #34.02. */
  const TARLA_ORIGIN_WRITER = "lib/properties/queries.ts";
  const ORIGIN_WRITERS = [ORIGIN_WRITER, TARLA_ORIGIN_WRITER];

  // Pattern rather than the exact literal: `origin:"IMPORT"`, single quotes and
  // a quoted key all read identically to a reviewer and slipped past the
  // string version of this guard.
  it("has exactly two writers, and each is argued for above", () => {
    const writers = productionFilesContaining(/origin['"]?\s*:\s*['"]IMPORT['"]/);
    expect([...writers].sort()).toEqual([...ORIGIN_WRITERS].sort());
  });

  /**
   * ⚠️ **The tarla writer must not grow a parameter.   (Slice #34.02)**
   *
   * The sibling assertion below makes this point for document types, and it
   * matters more here: the whole reason `lookup_tarla.origin` is trustworthy
   * where `lookup_document_type.origin` is not is that `createPropertyIn` has
   * no way to be TOLD an origin. A refactor that added one — "so the Add
   * Property form can say MANUAL" is the plausible story — would put the value
   * back on the wire, and no test that only counts files would notice.
   *
   * Whitespace removed, for the reason the document-type assertion states: a
   * call that wraps onto three lines is the same call.
   */
  it("writes the tarla literal into the insert, and takes no origin argument", () => {
    const src = fs.readFileSync(path.join(SRC, TARLA_ORIGIN_WRITER), "utf8");
    expect(src.replace(/\s+/g, "")).toContain(
      '.insert(lookupTarla).values({indicativ:propFields.tarlaSola,origin:"IMPORT"})',
    );

    // ⚠️ **THE FULL POSITIVE SIGNATURE, NOT A NEGATIVE REGEX, and a review
    // round wrote three refactors that beat the negative version.** It was
    // `expect(/function createPropertyIn\([^)]*origin/.test(src)).toBe(false)`,
    // which a `seedOrigin` parameter walks past (the regex is case-sensitive),
    // and which an arrow-function rewrite turns into an assertion that CANNOT
    // FAIL — `export const createPropertyIn = async (tx, input, origin = …)`
    // has no `function createPropertyIn(` in it at all, so the test goes green
    // against a parameter literally named `origin`. That is the exact defect
    // this file records at "THE ASSERTION THIS REPLACED COULD NOT FAIL", one
    // slice later. Pinning what the signature IS makes every one of those red.
    expect(src).toContain(
      "export async function createPropertyIn(\n" +
        "  tx: DbTransaction,\n" +
        "  input: PropertyCreate,\n" +
        "  updatedBy: string | null = null,\n" +
        "): Promise<PropertyFull> {",
    );
  });

  /**
   * …and the third door the negative regex missed: the PAYLOAD.
   *                                        (Slice #34.02, review round)
   *
   * A parameter is not the only way an origin could reach that insert. `origin`
   * could be added to `PropertyCreate` — a DIFFERENT file, derived from
   * `createInsertSchema(property)` — and read off `propFields`, with the pinned
   * literal kept in an `else`. Nothing above checks the create input's shape,
   * and the comment beside the write claims it. So it is checked here, at
   * runtime rather than by reading source: the schema must DROP an `origin` a
   * client sends, which is the property that actually matters.
   */
  it("drops an origin a client puts in the property create payload", () => {
    const parsed = propertyCreateSchema.parse({ nickname: "X", origin: "MANUAL" });
    expect(parsed).not.toHaveProperty("origin");
  });

  /**
   * ⚠️ **The value is passed into the row builder, and it is NOT a
   * parameter.** (`createDocumentTypeRow` since the advisory lock landed —
   * `createValue` before it, and an eighth review round caught this sentence
   * still naming the old one.)
   * That is the rule #29.06 settled: origin says who CHOSE the name — a machine
   * chose it, so IMPORT — and every answer reaching this function is by
   * construction a machine's, so a third caller cannot forget it the way
   * `ai-interpret` did. An assertion that only counted files would stay green
   * over a refactor that made it an argument again.
   */
  it("passes it into the create rather than taking it from the caller", () => {
    const src = fs.readFileSync(path.join(SRC, ORIGIN_WRITER), "utf8");
    // ⚠️ **ONE substring, with ALL whitespace REMOVED, and two review rounds
    // are why it is shaped exactly like this.** (Slice #29.07.)
    //
    //   - The literal one-line form this started as broke when the call grew a
    //     third argument (`preferredKey`) and wrapped onto four lines — a
    //     green-to-red that said nothing about origin.
    //   - Rewriting it as two independent `toContain`s was strictly weaker:
    //     two substrings anywhere in the file need not be in one expression,
    //     and a round proved it by moving `origin: "IMPORT"` into an unused
    //     constant, dropping it from the call, and watching this test and its
    //     regex sibling both stay green while every auto-created type fell back
    //     to the MANUAL default — finding F2 verbatim.
    //   - Collapsing runs of whitespace to ONE SPACE then pinned the argument
    //     LAYOUT: hoisting the third argument onto the same line as the second
    //     turns `( tx,` into `(tx,` and the test red for a behaviour-neutral
    //     edit. A third round found that one.
    //
    // Removing whitespace entirely is what leaves only the thing being
    // asserted: this call, these two properties, in this order.
    const flat = src.replace(/\s+/g, "");
    expect(flat).toContain('createDocumentTypeRow(tx,{name:inside.name,origin:"IMPORT"}');
  });

  /**
   * …and it cannot become a parameter.   (Slice #29.06, second review round)
   *
   * ⚠️ **THE ASSERTION THIS REPLACED COULD NOT FAIL, and the round that found
   * that is the reason this one is shaped the way it is.** It checked that the
   * two callers do not contain the IMPORT literal — which the "exactly one
   * writer" assertion above already guarantees for every production file, so it
   * could only fail when that one did. Worse, it could not catch what its own
   * header claimed to be about: a caller passing an origin through a variable,
   * a spread, or a differently-named key would satisfy it.
   *
   * What actually makes "one writer" mean something is that the writer takes NO
   * origin from anybody. `resolveClassifiedDocumentType` has exactly one
   * parameter, and it is the classifier's answer — a key and a label. Add a
   * second and this fails, which is the moment somebody should have to argue
   * for it.
   */
  it("takes the classifier's answer and nothing else", () => {
    const src = fs.readFileSync(path.join(SRC, ORIGIN_WRITER), "utf8");
    expect(src).toContain(
      "export async function resolveClassifiedDocumentType(\n  answer: ClassifierAnswer,\n): Promise<DocumentTypeResolution> {",
    );
  });
});

describe("a rename cannot re-originate a document type", () => {
  it("keeps origin out of the update schema entirely", () => {
    const created = documentTypeSchema.parse({ name: "Contract", origin: "IMPORT" });
    expect(created.origin).toBe("IMPORT");

    const updated = documentTypeUpdateSchema.parse({ name: "Contract", origin: "IMPORT" });
    expect(updated).not.toHaveProperty("origin");
  });

  it("does not silently default origin on a create that omits it", () => {
    // The fallback belongs to createValue, so exactly one place decides what
    // an unstated origin means. A `.default()` here would be a second.
    const created = documentTypeSchema.parse({ name: "Contract" });
    expect(created).not.toHaveProperty("origin");
  });

  it("routes PUT through the update schemas, never the create ones", () => {
    const route = fs.readFileSync(
      path.join(SRC, "app/api/admin/value-lists/[list]/[id]/route.ts"),
      "utf8",
    );
    expect(route).toContain("LIST_UPDATE_SCHEMAS[list].safeParse");
    expect(route).not.toContain("LIST_SCHEMAS[list]");
  });

  // Behaviour, not two substrings anywhere in a 300-line file: the previous
  // version of this test would have stayed green after a refactor that moved
  // the strip out of the branch that needs it.
  it("strips origin for every caller that is not the route", () => {
    const stripped = stripDocumentTypeOrigin({
      name: "Contract", sortOrder: 0, origin: "IMPORT",
    });
    expect(stripped).not.toHaveProperty("origin");
    expect(stripped).toEqual({ name: "Contract", sortOrder: 0 });
    // A payload with no origin is passed through untouched.
    expect(stripDocumentTypeOrigin({ name: "Contract" })).toEqual({ name: "Contract" });
  });

  it("is the strip the document-types update path actually uses", () => {
    const queries = fs.readFileSync(
      path.join(SRC, "lib/admin/value-lists/queries.ts"), "utf8");
    // Slice #27.03 composed a second guard around this one —
    // `sanitizeDocumentTypeTemplateFields` — so the call is no longer the
    // outermost thing in the `.set(...)`. Pinned as the exact composed
    // expression rather than loosened to a bare substring: the two guards are
    // both load-bearing on the same write, and a test that would stay green
    // with either of them unwrapped is not guarding the write.
    //
    // ⚠️ **Slice #32.07 HOISTED the composed expression into a local**, because
    // its own identity-card guard has to read the same value before the write
    // rather than reconstruct it. So the pin is now two halves — the
    // composition, and the write that uses it — and BOTH are asserted, because
    // either one alone would stay green with a third writer setting the column
    // from something else.
    //
    // ⚠️ **AND THE SOURCE IS COMMENT-STRIPPED FIRST, which a round caught this
    // file never doing.** `.set(values)` also appears inside a COMMENT in
    // `queries.ts` — one arguing about what `updateValue` can be handed — so the
    // write half of the pin was satisfiable without the write: delete line
    // `.set(values)` and replace it with `.set({ ...data })`, dropping BOTH
    // guards, and this test stayed green because the comment and the `const`
    // survived. A pin that a comment can satisfy is not a pin.
    const code = queries
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).toContain(
      "const values = sanitizeDocumentTypeTemplateFields(stripDocumentTypeOrigin(data));",
    );
    expect(code).toContain(".set(values)");
  });

  /**
   * …and the create HONOURS what it was passed.       (Slice #29.07, round 3)
   *
   * ⚠️ **"One writer sends IMPORT" says nothing if the builder ignores it, and
   * nothing was pinning the builder.** Every assertion above is about the
   * SENDER: exactly one file spells `origin: "IMPORT"`, and it passes it into
   * the row builder. Change `createDocumentTypeRow`'s line to a flat
   * `const origin = "MANUAL"` and all of them stay green while every
   * machine-created type reads "Adăugat manual" and no screen can repair it —
   * finding F2, reached one module to the left of where this file was looking.
   * The conditional is the whole guarantee, so it is pinned as an expression.
   */
  it("keeps the caller's origin when the caller sent a valid one", () => {
    const queries = fs.readFileSync(
      path.join(SRC, "lib/admin/value-lists/queries.ts"), "utf8");
    expect(queries.replace(/\s+/g, "")).toContain(
      'constorigin:DocumentTypeOrigin=isDocumentTypeOrigin(data.origin)?data.origin:"MANUAL"',
    );
  });

  /**
   * ⚠️ **Object identity stopped saying anything in Slice #27.03.** This used
   * to assert `LIST_UPDATE_SCHEMAS[key] === LIST_SCHEMAS[key]` for every list
   * but document-types, which held while the update map was a spread with one
   * override. #27.03 made `sortOrder` optional-without-a-default on every
   * update schema that HAS one — a plain rename was silently resetting the
   * column, because no admin form sends it — so those entries are each a
   * distinct object and the old assertion would pass for the wrong reason on
   * nine lists. (Slice #34.01 took the field off `person-roles` entirely, so
   * that one entry IS the bare create schema again — the single list where
   * object identity still holds, and one more reason the old assertion cannot
   * simply be restored.)
   *
   * What this file is actually about survives unchanged and is asserted
   * behaviourally: document-types is the only list whose update schema drops a
   * COLUMN, and that column is `origin`. (The `sortOrder` half has its own
   * tests in `document-type-template-editor.test.ts`.)
   */
  it("is the only list whose update schema drops a create-only column", () => {
    expect(documentTypeSchema.parse({ name: "Contract", origin: "IMPORT" }).origin)
      .toBe("IMPORT");
    expect(LIST_UPDATE_SCHEMAS["document-types"]).toBe(documentTypeUpdateSchema);

    for (const key of VALID_LIST_KEYS) {
      const createKeys = Object.keys(LIST_SCHEMAS[key].parse({ name: "X", indicativ: "T1" }));
      const updateKeys = Object.keys(
        LIST_UPDATE_SCHEMAS[key].parse({ name: "X", indicativ: "T1", origin: "IMPORT" }),
      );
      // `sortOrder` is absent from every update parse by design; `origin` is
      // absent from document-types' by design. Nothing else may go missing.
      //
      // `person-roles` is the one list with nothing to drop: Slice #34.01 took
      // `sortOrder` off BOTH its schemas, because the column was written on
      // every save and read by no `ORDER BY` that reaches a screen. Written
      // as a per-key
      // expectation rather than an exemption, so that a list which loses the
      // field by accident still fails here.
      const dropped = createKeys.filter((k) => !updateKeys.includes(k)).sort();
      expect([key, dropped]).toEqual([key, key === "person-roles" ? [] : ["sortOrder"]]);
      expect([key, updateKeys.includes("origin")]).toEqual([key, false]);
    }
  });
});

describe("only an import may stamp ai_interpreted_at", () => {
  /**
   * ⚠️ **This is the load-bearing claim of the whole document side, and until
   * an adversarial round asked, nothing tested it.**
   *
   * `documentStatus` reads New vs Imported off `document.ai_interpreted_at`,
   * and that is only honest because #26.09 removed the AI Interpret button:
   * every remaining writer is inside an import run. Add a second writer a user
   * can reach — a button, a bulk action, a repair script — and every "Introdus
   * manual" document silently starts reading "Importat".
   *
   * An allowlist rather than a pattern, on the model of
   * activity-cue-single-source.test.ts: a NEW file that so much as mentions the
   * column fails this test, which forces whoever added it to say in one line
   * whether it writes. That is the whole point — the guard is a speed bump on a
   * decision, not a regex that pretends to understand the code.
   */
  const MENTIONS_ALLOWED: Record<string, string> = {
    // ── The two writers. Both inside an import run. ──
    "lib/import/ai-interpret-run.ts":
      "WRITES — the run's own PATCH, stamp passed in by the caller",
    "app/admin/import/_components/id-card-person-dialog.tsx":
      "WRITES — the identity-card step, one PATCH alongside the card fields",

    // ── Everything else only declares, forwards or reads it. ──
    "db/schema/index.ts":                                "the column",
    "lib/documents/validation.ts":                       "the PATCH body schema",
    "lib/documents/queries.ts":                          "the generic PATCH builder",
    "lib/documents/status.ts":                           "the derivation — reads",
    "app/documents/[id]/page.tsx":                       "reads it into the badge",
    "app/documents/_components/document-detail-tabs.tsx": "prop type, forwards it",
    "app/documents/_components/document-form.tsx":       "prop type + the comments explaining the removed button",
    "lib/import/id-card.ts":                             "comment only — records that the WHEN lives on the column",
    // Slice #27.05. ⚠️ **WRITES NOTHING, and the mention is the point:** discover
    // mode stamps nothing, which is exactly what lets it be re-run, so the
    // one-per-type rule that stops a second call is about MONEY and not about
    // this column. #26.11 refused that gate once and the comment is what stops
    // it being reintroduced as an optimisation.
    "lib/import/discover-run.ts":                        "comment only — records that discovery is NOT gated on the column",
    "app/api/documents/[id]/ai-interpret/route.ts":      "comments — the route stamps nothing itself",
    // Slice #27.06. ⚠️ **BOTH WRITE NOTHING, and in both the mention is the
    // point rather than a leak.** The re-read is `runAiInterpret` called a
    // second time, so the stamp is re-written by the writer already listed
    // above — the caller passes a `stamp` argument and nothing else. What these
    // two comments record is the thing #27.06's constraint forbids: a SECOND
    // stamp, or a re-read counter, saying twice what the column already says
    // once. `refill` is a queue position that lives in a dialog's state and
    // dies with it, and its own header says so in as many words. Delete these
    // comments and the next reader's obvious optimisation — "the row needs to
    // know it was re-read, put it on the document" — has nothing standing in
    // front of it. (The dialog's second mention is the measured note that
    // `aiInterpretedAt` is deliberately absent from the version snapshot, which
    // is why the click is priced at "cel mult" N document versions rather than
    // a flat N.)
    "app/admin/import/_components/bulk-import-dialog.tsx":
      "comments only — records that the re-read re-stamps through runAiInterpret and adds no stamp of its own",
    "lib/import/import-outcome.ts":
      "comment only — records that RefillState is a queue position, NOT a second copy of the column",

    // ── Tests. ──
    "__tests__/import-ai-interpret-run.test.ts": "pins the run's PATCH",
    "__tests__/document-status.test.ts":         "pins the derivation",
  };

  it("has no writer, and no new mention, outside that list", () => {
    const mentions = FILES
      .filter((f) => rel(f) !== SELF)
      .filter((f) => /ai_?[Ii]nterpreted_?[Aa]t/.test(fs.readFileSync(f, "utf8")))
      .map(rel)
      .sort();
    const unlisted = mentions.filter((f) => !(f in MENTIONS_ALLOWED));
    expect(unlisted).toEqual([]);
  });

  // ⚠️ **Round two caught this asserting nothing.** It used to filter
  // MENTIONS_ALLOWED — the literal declared twelve lines above — and check the
  // paths in it, so moving `ai-interpret-run.ts` out of `lib/import/` while
  // leaving the key string alone passed happily. It reads the filesystem now.
  //
  // What this still cannot catch, stated plainly rather than papered over: a
  // new writer inside one of the two listed files, or a write built through
  // `lib/documents/queries.ts`'s generic PATCH builder from a variable that
  // never spells the column. `PATCH /api/documents/[id]` accepts
  // `aiInterpretedAt` (validation.ts) and always has. The allowlist above is a
  // speed bump on a decision, not a proof — its job is to make a second writer
  // something a human had to type a reason for.
  it("keeps both writers inside an import, and they exist", () => {
    const writers = Object.entries(MENTIONS_ALLOWED)
      .filter(([, why]) => why.startsWith("WRITES"))
      .map(([file]) => file);
    expect(writers.length).toBe(2);
    for (const file of writers) {
      expect(fs.existsSync(path.join(SRC, file))).toBe(true);
      expect(file.startsWith("lib/import/") || file.startsWith("app/admin/import/")).toBe(true);
    }
  });
});

describe("migration_077's two CHECKs are the same decision as the schema unions", () => {
  /**
   * ⚠️ **Three tables now write the same two words, and only one of them was
   * bound to its SQL.   (Slice #34.02)**
   *
   * The document-type bind below exists because "the TS value set and the CHECK
   * constraint are one decision written in two languages, and only a test can
   * hold them together". #34.02 wrote that decision in four more places —
   * migration_077's two CHECKs and `schema/index.ts`'s two inline
   * `$type<"MANUAL" | "IMPORT">()` unions — plus two more in
   * `supabase_repair_missing_tables.sql`, which is the copy nothing executes on
   * a migrated database (its `IF EXISTS (… conname …)` guard short-circuits),
   * so a repair file with a DIFFERENT value set would diff clean and ship.
   * All six are bound here.
   */
  /**
   * ⚠️ **THE IMPORTED PRODUCTION CONSTANT, NEVER A LOCAL COPY, and a review
   * round found this file breaking its own thesis.** The first version declared
   * `const ORIGIN_VALUES = ["MANUAL", "IMPORT"]` here — a fourth home for the
   * decision, inside the file whose entire argument is that there must be one.
   * Add a third origin and the 069 block below would go red (correct) while
   * these went green against a stale literal.
   */
  const ORIGIN_VALUES = [...DOCUMENT_TYPE_ORIGINS];

  /**
   * ⚠️ **COMMENTS ARE STRIPPED BEFORE EVERY SCAN BELOW.** This file already
   * wrote the rule down once — "a pin that a comment can satisfy is not a pin"
   * — and a review round watched the hole reopen here: the first version of the
   * union check counted `/\$type<…>\(\)/` matches across the whole schema and
   * got FOUR, the fourth being prose in a comment that quotes the syntax. It
   * survived only because that one comment happened not to contain the import
   * word.
   *
   * ⚠️ **The stripping is now PROPHYLACTIC, and saying so is the point.** The
   * counts became per-table slices (below), and no comment in either SQL file
   * quotes `CHECK (origin IN (…))` or the `ADD COLUMN` line today — measured:
   * every assertion here returns the same result stripped and unstripped. The
   * reason to keep it is that all three `origin` columns' comments already
   * discuss `$type` in prose, and a future one quoting the whole
   * `origin: text("origin").$type<…>()` line INSIDE a `pgTable` block would
   * satisfy the slice regex. An earlier draft of this paragraph claimed the SQL
   * headers already carried the pattern; they do not, and a fabricated premise
   * in this file of all files is worse than none.
   */
  const stripSqlComments = (sql: string): string =>
    sql.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
  const stripTsComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

  const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
  const valuesOf = (list: string): string[] =>
    list.split(",").map((v) => v.trim().replace(/^'|'$/g, "")).filter(Boolean);

  /**
   * ⚠️ **ANCHORED TO ITS TABLE, NOT COUNTED.** `expect(checks.length).toBe(2)`
   * passes if `chk_li_origin` were attached to `lookup_citizenship` instead of
   * `lookup_institution` — and it goes red the day a FOURTH lookup table
   * legitimately gets the column, which is a describe named after
   * migration_077 failing because migration_081 touched something else. Naming
   * the table in the pattern removes both.
   */
  const checkOn = (sql: string, table: string, constraint: string): string[] | null => {
    const re = new RegExp(
      `ALTER TABLE ${table}\\s+ADD CONSTRAINT ${constraint} CHECK \\(origin IN \\(([^)]*)\\)\\)`,
    );
    const m = re.exec(sql);
    return m ? valuesOf(m[1]) : null;
  };

  it("migration_077 constrains each lookup table by name", () => {
    const sql = stripSqlComments(read("src/db/migration_077_reference_data_origin.sql"));
    expect(checkOn(sql, "lookup_tarla", "chk_lt_origin")).toEqual(ORIGIN_VALUES);
    expect(checkOn(sql, "lookup_institution", "chk_li_origin")).toEqual(ORIGIN_VALUES);
  });

  it("the Supabase repair file agrees, on the same tables", () => {
    // ⚠️ **The copy with the weakest guard over it.** Verify-Rebuild step 8
    // builds a FULLY MIGRATED database, so the `IF EXISTS (… conname …)` guard
    // short-circuits and these two ADD CONSTRAINTs never execute there — a
    // repair file with a different value set would diff clean and ship. (The
    // ALTERs and UPDATEs above them do run, as no-ops.)
    const sql = stripSqlComments(read("src/db/supabase_repair_missing_tables.sql"));
    expect(checkOn(sql, "lookup_tarla", "chk_lt_origin")).toEqual(ORIGIN_VALUES);
    expect(checkOn(sql, "lookup_institution", "chk_li_origin")).toEqual(ORIGIN_VALUES);
    expect(checkOn(sql, "lookup_document_type", "chk_ldt_origin")).toEqual(ORIGIN_VALUES);
  });

  it("every column that gains origin defaults to the value an unstated one means", () => {
    // Both files, and per table — a DEFAULT of 'IMPORT' in the repair file
    // would otherwise diff clean, which is finding 7 of the same round.
    //
    // ⚠️ The subject is carried into the expectation, this file's own
    // convention: a bare `expect(true).toBe(false)` here would name neither of
    // the two files nor either of the two tables, and cost a round to place.
    for (const file of [
      "src/db/migration_077_reference_data_origin.sql",
      "src/db/supabase_repair_missing_tables.sql",
    ]) {
      const sql = stripSqlComments(read(file));
      for (const table of ["lookup_tarla", "lookup_institution"]) {
        const found = new RegExp(
          `ALTER TABLE ${table}\\s+ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT '${DOCUMENT_TYPE_ORIGINS[0]}'`,
        ).test(sql);
        expect([file, table, found]).toEqual([file, table, true]);
      }
    }
  });

  it("the drizzle union on each table spells the same values, in the same order", () => {
    const schema = stripTsComments(read("src/db/schema/index.ts"));
    for (const table of ["lookupDocumentType", "lookupTarla", "lookupInstitution"]) {
      // Slice the table's own pgTable block, so a union on a different table
      // can neither satisfy nor break this. The subject rides along in every
      // expectation, so a red names which of the three it was.
      const start = schema.indexOf(`export const ${table} = pgTable(`);
      expect([table, start > -1]).toEqual([table, true]);
      const end = schema.indexOf("\n});", start);
      expect([table, end > start]).toEqual([table, true]);
      const block = schema.slice(start, end);
      const m = /origin: text\("origin"\)\.\$type<([^>]*)>\(\)/.exec(block);
      expect([table, m !== null]).toEqual([table, true]);
      expect([
        table,
        (m?.[1] ?? "").split("|").map((v) => v.trim().replace(/^"|"$/g, "")),
      ]).toEqual([table, ORIGIN_VALUES]);
    }
  });
});

describe("the TypeScript value set and the CHECK constraint are one decision", () => {
  it("matches migration_069's CHECK, value for value", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "src/db/migration_069_document_type_origin.sql"),
      "utf8",
    );
    const match = /CHECK \(origin IN \(([^)]*)\)\)/.exec(sql);
    expect(match).not.toBeNull();
    const inSql = (match?.[1] ?? "")
      .split(",")
      .map((v) => v.trim().replace(/^'|'$/g, ""))
      .filter(Boolean);
    expect(inSql).toEqual([...DOCUMENT_TYPE_ORIGINS]);
  });

  it("defaults the column to the value the app falls back to", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "src/db/migration_069_document_type_origin.sql"),
      "utf8",
    );
    expect(sql).toContain("origin text NOT NULL DEFAULT 'MANUAL'");
    expect(DOCUMENT_TYPE_ORIGINS[0]).toBe("MANUAL");
  });
});
