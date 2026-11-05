/**
 * Slice 41.90 — the calm row is one recipe (`@/lib/ui/quiet-row`): the four lists (40.60), „Legături" (40.96) and,
 * since 41.90, „Pagini"'s rows read it; nowhere else writes it out.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { QUIET_ROW, QUIET_ROW_BUTTONS, QUIET_ROW_MARK } from "@/lib/ui/quiet-row";

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__") files(p, out);
    } else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

describe("41.90 — the calm row, written once", () => {
  it("the recipe: 35 % at rest, full when hovered, focused, pressed, expanded, or with no hover", () => {
    for (const c of ["opacity-35", "group-hover/row:opacity-100", "group-focus-within/row:opacity-100", "has-[[aria-pressed=true]]:opacity-100", "has-[[aria-expanded=true]]:opacity-100", "[@media(hover:none)]:opacity-100"]) {
      expect(QUIET_ROW_BUTTONS.split(" ")).toContain(c);
    }
    expect(QUIET_ROW).toBe("group/row");
    expect(QUIET_ROW_MARK).toBe("quiet");
  });
  it("no file under src writes `opacity-35` but the recipe's own", () => {
    const writers = files(join(ROOT, "src")).filter((f) => readFileSync(f, "utf8").includes("opacity-35")).map((f) => f.slice(ROOT.length + 1).replace(/\\/g, "/"));
    expect(writers).toEqual(["src/lib/ui/quiet-row.ts"]);
  });
  it("„Pagini”'s rows are calm: the row is the group, its buttons the recipe, marked as „Legături”'s are", () => {
    const pages = read("src", "app", "documents", "_components", "pages-panel.tsx");
    expect(pages).toMatch(/`\$\{QUIET_ROW\} cursor-pointer border-b/);
    expect(pages).toMatch(/className=\{`flex items-center justify-end gap-1 \$\{QUIET_ROW_BUTTONS\}`\}\s+data-page-actions=""\s+data-row-buttons=\{QUIET_ROW_MARK\}/);
    expect(read("src", "components", "tiles", "one-line-rows.tsx")).toContain("data-row-buttons={quiet ? QUIET_ROW_MARK : undefined}");
  });
});
