/**
 * The import writes ONE title to TWO columns.                   (Slice #32.06)
 *
 * WHY THIS SUITE EXISTS AT ALL
 * ----------------------------
 * `#32.06` keys the Pre-existing stage on `document.import_title`, which the
 * import writes at creation from `titleForEntry(entry)` — the same expression
 * that produces `document.title`. The whole fix rests on those two being ONE
 * value: if the column the archive is keyed on ever stops being what the folder
 * side computes, the stage matches nothing, reports every already-imported
 * folder as new, and imports all of it again — silently, for ever, looking
 * exactly like an empty archive.
 *
 * ⚠️ **THIS IS NOT A HYPOTHETICAL, IT IS THE #26.08 DEFECT REPEATING.** That
 * slice keyed the archive on the title the dialog wrote, and the two
 * expressions diverged: `titleForEntry` fell back to the folder name when
 * `folderNameToTitleHint` trimmed to nothing, while the dialog wrote the empty
 * string. Documents were stored untitled, the lookup refuses untitled
 * documents, and the folders were duplicated on every run. The comment on the
 * write says the two must be one expression; nothing made it true.
 *
 * ⚠️ **A SOURCE SCAN IS EVIDENCE, NOT PROOF**, and it is what is available:
 * `bulk-import-dialog.tsx` is one of the two largest files in the import path
 * and nothing in `src/__tests__/` renders it. The assertions below are written
 * to fail on the edit somebody would actually make — a second call to
 * `titleForEntry`, a `?? ""` fallback, the field dropped from the POST body.
 * The behaviour of the key itself is pinned properly in
 * `import-preexisting-lookup.test.ts`, where it is a pure function.
 *
 * Added by the #32.06 adversarial review, which observed that the write path
 * carried a paragraph explaining why it could not drift and nothing enforcing
 * it.
 */

import fs from "node:fs";
import path from "node:path";

import { documentCreateSchema, documentUpdateSchema } from "@/lib/documents/validation";

const DIALOG = path.join(
  "src", "app", "admin", "import", "_components", "bulk-import-dialog.tsx",
);
const QUERIES = path.join("src", "lib", "documents", "queries.ts");
const LOOKUP  = path.join("src", "lib", "documents", "preexisting-lookup.ts");

function read(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

/** The same strip `import-run-stage.test.ts` records the reason for. */
function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("the import's title write (#32.06)", () => {
  const body = withoutComments(read(DIALOG));

  it("sends importTitle off the SAME payload field as title", () => {
    // Both read `payload.title`. Two separate calls to `titleForEntry` would
    // type-check, read correctly, and be the #26.08 defect again.
    expect(body).toContain("title: payload.title ?? null,");
    expect(body).toContain("importTitle: payload.title ?? null,");
  });

  it("computes that value with titleForEntry, once", () => {
    expect(body).toContain("const title = titleForEntry(entry);");
    // `createDocument` is called in exactly one place, with that binding.
    const calls = [...body.matchAll(/await createDocument\(/g)];
    expect(calls).toHaveLength(1);
    const call = body.slice(calls[0].index!, body.indexOf("});", calls[0].index!));
    // ⚠️ **THE SHORTHAND, WITH ITS DELIMITERS.** `toContain("title,")` is a
    // substring of `title: entry.name ?? title,` — a seventh review round made
    // exactly that edit and every assertion here passed, while every page group
    // was stored under its folder NAME and keyed against its folder HINT, so no
    // page group would ever match again. That is the #26.08 defect this suite's
    // header says it was written to prevent.
    expect(call).toMatch(/[{,]\s*title\s*,/);
  });

  it("does not let importTitle fall back to an empty string", () => {
    // `?? ""` is the shape of the #26.08 defect: an empty title keys against
    // every untitled document in the archive, which `matchArchiveDocuments`
    // then has to refuse — so the document simply never matches anything and
    // the folder is re-imported for ever. `?? null` is the honest absence.
    expect(body).not.toMatch(/importTitle:\s*[^,\n]*\?\?\s*""/);
  });
});

// ---------------------------------------------------------------------------
// The three hops between the dialog and the column
// ---------------------------------------------------------------------------
//
// ⚠️ **THE THIRD REVIEW ROUND ADDED THIS BLOCK, and the way it found the gap is
// the point: it deleted `importTitle: input.importTitle ?? null` from
// `inputToValues` and ran the real compiler. `tsc --noEmit` exited 0.** The
// column is nullable with no default, so drizzle's `$inferInsert` makes the
// field optional and the type system has nothing to say. Nothing is written,
// every document keys on `title`, the AI rewrites `title`, and #32.05's
// duplicate-import defect is back in full — silently, for ever, looking exactly
// like an empty archive.
//
// The block above guards the hop the reviewer could already read in one screen.
// These are the three it does not: the schema that must CARRY the field, the
// mapper that must WRITE it, and the query that must READ it. Each is one line,
// each is type-clean when deleted, and each on its own turns the whole slice
// into a no-op.

describe("the server hops keep importTitle (#32.06)", () => {
  it("carries importTitle through the create schema", () => {
    // Behavioural, not a source scan: this is the hop that can be checked
    // properly, so it is.
    const parsed = documentCreateSchema.safeParse({
      documentTypeId: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      title: "Contract.pdf",
      importTitle: "Contract.pdf",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.importTitle).toBe("Contract.pdf");
  });

  it("still refuses importTitle on the update schema", () => {
    // Write-once. A PATCH that could move it is a key that shifts under the
    // stage reading it — the class of defect #32.06 exists to remove, not to
    // relocate.
    const parsed = documentUpdateSchema.safeParse({ title: "x", importTitle: "HACK" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "importTitle" in parsed.data).toBe(false);
  });

  it("writes the column on create", () => {
    const body = withoutComments(read(QUERIES));
    expect(body).toContain("importTitle: input.importTitle ?? null,");
  });

  it("reads the column back on the archive side", () => {
    // `document.title` here instead of `document.importTitle` type-checks —
    // both are `text | null` — and reverts the archive side to pre-#32.06
    // behaviour with nothing to notice it.
    const body = withoutComments(read(LOOKUP));
    expect(body).toContain("importTitle: document.importTitle,");
    expect(body).toContain("title: document.title,");
  });
});
