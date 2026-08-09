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

/** Files carrying a literal, excluding this test (which quotes them all). */
function filesContaining(needle: string): string[] {
  return FILES
    .filter((f) => rel(f) !== "__tests__/document-type-origin-single-source.test.ts")
    .filter((f) => fs.readFileSync(f, "utf8").includes(needle))
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

  it("keeps the type list's black as the table's own body colour", () => {
    // Not a literal black: "added by hand is black" on a list where every cell
    // is already this colour means the row is untouched by the coding.
    expect(DOCUMENT_TYPE_STATUS_CLASS.new).toBe("text-ink dark:text-zinc-300");
  });
});

describe("only the import claims an IMPORT origin", () => {
  it("has exactly one writer, and it is the import's type auto-create", () => {
    const writers = filesContaining('origin: "IMPORT"')
      .filter((f) => !f.startsWith("__tests__/"));
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

  it("strips origin in updateValue too, for every caller that is not the route", () => {
    const queries = fs.readFileSync(
      path.join(SRC, "lib/admin/value-lists/queries.ts"),
      "utf8",
    );
    expect(queries).toContain("const { origin: _ignoredOrigin, ...safe }");
    expect(queries).toContain(".set(safe)");
  });

  it("differs from the create schemas for document-types alone", () => {
    for (const key of VALID_LIST_KEYS) {
      if (key === "document-types") {
        expect(LIST_UPDATE_SCHEMAS[key]).not.toBe(LIST_SCHEMAS[key]);
      } else {
        expect(LIST_UPDATE_SCHEMAS[key]).toBe(LIST_SCHEMAS[key]);
      }
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
