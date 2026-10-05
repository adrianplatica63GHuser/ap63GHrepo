/**
 * One document is never evidence for a type's form.            (Slice #37.85)
 *
 * „Descoperire AI" read ONE document with no schema and turned the ticked rows
 * into fields on the TYPE, for every document of it, for ever — from the
 * document form and from the import. A notarial deed has no printed labels, so
 * those reads named fields after its prose. Both doors are gone. What is left
 * that may write `template_fields`: the DocTypeEngine (10–20 samples) through
 * `PUT /api/document-types/[id]/template-fields`, and the Form editor in Date
 * de referință through the value-lists PUT.
 *
 * This reads every client file under `src/app` and `src/components` (route
 * handlers excluded — they serve, they do not ask), code only.
 */
import fs from "fs";
import path from "path";

const SRC = path.join(process.cwd(), "src");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__" && entry.name !== "api") walk(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** Comments out, strings kept — the URLs and bodies are what is read. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const i = line.search(/(^|[^:])\/\//);
      return i >= 0 ? line.slice(0, i + (line[i] === "/" ? 0 : 1)) : line;
    })
    .join("\n");
}

const CLIENT = [...walk(path.join(SRC, "app")), ...walk(path.join(SRC, "components"))].map((f) => ({
  rel: path.relative(SRC, f).split(path.sep).join("/"),
  code: codeOnly(fs.readFileSync(f, "utf8")),
}));

describe("no screen turns one document into a type's form", () => {
  it("reads a real tree", () => {
    expect(CLIENT.length).toBeGreaterThan(100);
    expect(CLIENT.some((f) => f.rel === "app/documents/_components/document-form.tsx")).toBe(true);
  });

  it("no client asks ai-interpret for discover mode", () => {
    const askers = CLIENT.filter((f) => /ai-interpret/.test(f.code) && /mode:\s*["']discover["']/.test(f.code)).map((f) => f.rel);
    expect(askers).toEqual([]);
  });

  it("the template-fields PUT has one screen caller: the DocTypeEngine", () => {
    const callers = CLIENT.filter((f) => /\/api\/document-types\/[^"'`\n]*\/template-fields/.test(f.code)).map((f) => f.rel);
    expect(callers).toEqual(["app/admin/doc-type-engine/_components/doc-type-engine.tsx"]);
  });

  it("the review dialog that did it is gone", () => {
    expect(fs.existsSync(path.join(SRC, "app/documents/_components/discover-review-dialog.tsx"))).toBe(false);
    expect(CLIENT.filter((f) => /DiscoverReviewDialog|discover-review-dialog/.test(f.code)).map((f) => f.rel)).toEqual([]);
  });
});
