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

    const tabs = fs.readFileSync(
      path.join(SRC, "app/documents/_components/document-detail-tabs.tsx"), "utf8");
    expect(tabs).toContain("DOCUMENT_STATUS_CLASS[status]");

    const page = fs.readFileSync(path.join(SRC, "app/documents/[id]/page.tsx"), "utf8");
    expect(page).toContain("documentStatus({");
  });
});

describe("only the import claims an IMPORT origin", () => {
  // Pattern rather than the exact literal: `origin:"IMPORT"`, single quotes and
  // a quoted key all read identically to a reviewer and slipped past the
  // string version of this guard.
  it("has exactly one writer, and it is the import's type auto-create", () => {
    const writers = productionFilesContaining(/origin['"]?\s*:\s*['"]IMPORT['"]/);
    expect(writers).toEqual(["app/admin/import/_components/bulk-import-dialog.tsx"]);
  });

  it("sends it on the POST that creates the type", () => {
    const src = fs.readFileSync(
      path.join(SRC, "app/admin/import/_components/bulk-import-dialog.tsx"),
      "utf8",
    );
    expect(src).toContain('JSON.stringify({ name: trimmedLabel, origin: "IMPORT" })');
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
    expect(queries).toContain(
      ".set(sanitizeDocumentTypeTemplateFields(stripDocumentTypeOrigin(data)))",
    );
  });

  /**
   * ⚠️ **Object identity stopped saying anything in Slice #27.03.** This used
   * to assert `LIST_UPDATE_SCHEMAS[key] === LIST_SCHEMAS[key]` for every list
   * but document-types, which held while the update map was a spread with one
   * override. #27.03 made `sortOrder` optional-without-a-default on EVERY
   * update schema — a plain rename was silently resetting the column, because
   * no admin form sends it — so every entry is now a distinct object and the
   * old assertion would pass for the wrong reason on nine lists.
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
      const dropped = createKeys.filter((k) => !updateKeys.includes(k)).sort();
      expect([key, dropped]).toEqual([key, ["sortOrder"]]);
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
