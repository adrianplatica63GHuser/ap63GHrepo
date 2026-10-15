/**
 * @jest-environment node
 *
 * The user manual's source format and its numbering check.                                 (Slice #39.37)
 *
 * The parser on small sources made by hand — every block and inline kind — and each rule of `validateManual` and
 * `compareManuals` broken alone; then the real manual: no issue in either language, the same sections and
 * figures in both, every figure's picture present in public/manual/figures, and every id `manualHref` builds
 * resolving to a section of the screen.
 */

import { existsSync } from "fs";
import { join } from "path";
import {
  buildManual,
  compareManuals,
  parseChapter,
  parseInline,
  validateManual,
  type ManualIssueCode,
} from "@/lib/manual/format";
import { getManual, manualHref, manualIssues, manualLocale, manualTarget } from "@/lib/manual/manual";

const chapter = (n: number, body: string) => `# ${n} Capitolul ${n} {#c${n}}\n\n${body}`;
const manualOf = (...texts: string[]) => buildManual("ro-RO", texts.map((text, i) => ({ source: `c${i + 1}`, text })));
const codes = (texts: string[]) => {
  const { manual, issues } = manualOf(...texts);
  return [...issues, ...validateManual(manual)].map((i) => i.code);
};

describe("parseInline", () => {
  it("reads bold and cross-references and leaves everything else as written", () => {
    expect(parseInline("Apăsați **Salvează**, apoi vedeți [[start-sidebar]] „aici”.")).toEqual([
      { kind: "text", text: "Apăsați " },
      { kind: "bold", text: "Salvează" },
      { kind: "text", text: ", apoi vedeți " },
      { kind: "ref", id: "start-sidebar" },
      { kind: "text", text: " „aici”." },
    ]);
    expect(parseInline("")).toEqual([]);
  });
});

describe("parseChapter", () => {
  const src = [
    "# 2 Primii pași {#start}",
    "",
    "Un paragraf",
    "pe două rânduri.",
    "",
    "## 2.1 Bara laterală {#start-sidebar}",
    "- unu",
    "- doi **gras**",
    "1. primul",
    "2. al doilea",
    "| Secțiunea | Ce cuprinde |",
    "|---|---|",
    "| Domeniu | Listele |",
    "![2.1 Bara laterală deschisă](sidebar.png){#fig-sidebar}",
    "### 2.1.1 Secțiunile {#start-sidebar-sections}",
  ].join("\n");

  it("reads every kind of block, in order, with its line", () => {
    const { chapter: c, issues } = parseChapter(src, "test");
    expect(issues).toEqual([]);
    expect(c?.id).toBe("start");
    expect(c?.blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "heading", "list", "list", "table", "figure", "heading"]);
    const para = c?.blocks[1];
    expect(para?.kind === "paragraph" && para.inlines).toEqual([{ kind: "text", text: "Un paragraf pe două rânduri." }]);
    const [bullets, numbered] = [c?.blocks[3], c?.blocks[4]];
    expect(bullets?.kind === "list" && [bullets.ordered, bullets.items.length]).toEqual([false, 2]);
    expect(numbered?.kind === "list" && [numbered.ordered, numbered.items.length]).toEqual([true, 2]);
    const fig = c?.blocks[6];
    expect(fig).toMatchObject({ kind: "figure", number: "2.1", caption: "Bara laterală deschisă", file: "sidebar.png", id: "fig-sidebar", line: 14 });
    const sub = c?.blocks[7];
    expect(sub).toMatchObject({ kind: "heading", level: 3, number: "2.1.1", id: "start-sidebar-sections" });
  });

  it("refuses a malformed heading, figure and table, and a source with no chapter heading", () => {
    expect(parseChapter("# 1 Fără id", "x").issues.map((i) => i.code)).toContain("bad-heading");
    expect(parseChapter("# 1 Ok {#a}\n![1.1 fără id](a.png)", "x").issues.map((i) => i.code)).toEqual(["bad-figure"]);
    expect(parseChapter("# 1 Ok {#a}\n| a | b |\n| c | d |", "x").issues.map((i) => i.code)).toEqual(["bad-table"]);
    expect(parseChapter("# 1 Ok {#a}\n| a | b |\n|---|---|\n| c |", "x").issues.map((i) => i.code)).toEqual(["bad-table"]);
    expect(parseChapter("Doar text.", "x").issues.map((i) => i.code)).toEqual(["no-chapter-heading"]);
    expect(parseChapter("# 1 A {#a}\n# 2 B {#b}", "x").issues.map((i) => i.code)).toEqual(["second-chapter-heading"]);
  });
});

describe("validateManual — the numbering rules", () => {
  const ok = chapter(1, "## 1.1 A {#c1-a}\n\nVezi [[fig-x]].\n\n![1.1 X](x.png){#fig-x}\n\n## 1.2 B {#c1-b}\n### 1.2.1 B1 {#c1-b1}");

  it("passes a manual whose numbers run without gaps", () => {
    expect(codes([ok, chapter(2, "## 2.1 C {#c2-a}")])).toEqual([]);
  });

  const cases: [string, string[], ManualIssueCode][] = [
    ["a chapter out of order", [chapter(2, "")], "chapter-number"],
    ["a section gap", [chapter(1, "## 1.1 A {#a}\n## 1.3 C {#c}")], "section-number"],
    ["a section repeated", [chapter(1, "## 1.1 A {#a}\n## 1.1 B {#b}")], "section-number"],
    ["a subsection under no section", [chapter(1, "### 1.0.1 A {#a}")], "section-number"],
    ["a subsection gap", [chapter(1, "## 1.1 A {#a}\n### 1.1.2 B {#b}")], "section-number"],
    ["a figure numbered out of turn", [chapter(1, "[[fa]] [[fb]]\n![1.2 A](a.png){#fa}\n![1.1 B](b.png){#fb}")], "figure-number"],
    ["an id used twice", [chapter(1, "## 1.1 A {#c1}")], "duplicate-id"],
    ["an id that is not kebab-case", [chapter(1, "## 1.1 A {#Bad_Id}")], "bad-id"],
    ["a cross-reference to nothing", [chapter(1, "Vezi [[nowhere]].")], "unresolved-ref"],
    ["a figure nothing points at", [chapter(1, "![1.1 A](a.png){#fig-a}")], "unreferenced-figure"],
  ];
  it.each(cases)("refuses %s", (_name, texts, code) => {
    expect(codes(texts)).toContain(code);
  });

  it("finds references inside lists and tables too", () => {
    const viaList = chapter(1, "- vezi [[fig-a]]\n![1.1 A](a.png){#fig-a}");
    const viaTable = chapter(1, "| a |\n|---|\n| [[fig-a]] |\n![1.1 A](a.png){#fig-a}");
    expect(codes([viaList])).toEqual([]);
    expect(codes([viaTable])).toEqual([]);
  });
});

describe("compareManuals — the two languages", () => {
  const ro = buildManual("ro-RO", [{ source: "ro", text: chapter(1, "## 1.1 Bara {#c1-a}") }]).manual;
  it("passes the same headings under other titles", () => {
    const en = buildManual("en-GB", [{ source: "en", text: "# 1 Chapter one {#c1}\n## 1.1 The bar {#c1-a}" }]).manual;
    expect(compareManuals(ro, en)).toEqual([]);
  });
  it("refuses a section the other language lacks, or another id", () => {
    const fewer = buildManual("en-GB", [{ source: "en", text: "# 1 Chapter one {#c1}" }]).manual;
    expect(compareManuals(ro, fewer).map((i) => i.code)).toEqual(["languages-differ"]);
    const other = buildManual("en-GB", [{ source: "en", text: "# 1 Chapter one {#c1}\n## 1.1 The bar {#c1-b}" }]).manual;
    expect(compareManuals(ro, other)[0].message).toContain("{#c1-b}");
  });
});

describe("the real manual", () => {
  it("has no issue: parsing, numbering, references, and the two languages against each other", () => {
    expect(manualIssues().map((i) => `${i.source}:${i.line ?? ""} ${i.code} — ${i.message}`)).toEqual([]);
  });

  it("holds the thirteen chapters of Ask first 4, in order", () => {
    expect(getManual("ro-RO").chapters.map((c) => `${c.number} ${c.title}`)).toEqual([
      "1 Introducere",
      "2 Primii pași",
      "3 Persoane fizice",
      "4 Persoane juridice",
      "5 Proprietăți",
      "6 Acte",
      "7 Legături, versiuni și istoric",
      "8 Harta proprietăților",
      "9 Instrumente",
      "10 Import",
      "11 Rapoarte",
      "12 Administrare și Setări",
      "13 Ajutor și învățare",
    ]);
  });

  it("ends every chapter with its examples, as Adrian asked", () => {
    for (const c of getManual("ro-RO").chapters.filter((x) => x.id !== "learning")) {
      const sections = c.blocks.filter((b) => b.kind === "heading" && b.level === 2);
      const last = sections[sections.length - 1];
      expect([c.id, last?.kind === "heading" && /^Exemple/.test(last.title)]).toEqual([c.id, true]);
    }
  });

  it("has a picture in public/manual/figures for every figure", () => {
    const files = getManual("ro-RO").chapters.flatMap((c) => c.blocks.flatMap((b) => (b.kind === "figure" ? [b.file] : [])));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f) => !existsSync(join(process.cwd(), "public", "manual", "figures", f)))).toEqual([]);
  });

  it("links by id and shows the current number", () => {
    expect(manualHref("start-sidebar")).toBe("/manual?s=start-sidebar");
    expect(manualHref()).toBe("/manual");
    expect(manualTarget("ro-RO", "start-sidebar")).toMatchObject({ kind: "section", number: "2.2", chapterId: "start" });
    expect(manualTarget("en-GB", "fig-sidebar")).toMatchObject({ kind: "figure", number: "2.1" });
    expect(manualLocale("en-GB")).toBe("en-GB");
    expect(manualLocale("ro-RO")).toBe("ro-RO");
    expect(manualLocale("fr-FR")).toBe("ro-RO");
  });

  it("spells its Romanian with comma-below ș and ț, never the cedilla look-alikes", () => {
    const text = getManual("ro-RO").chapters.map((c) => JSON.stringify(c.blocks)).join("");
    expect(text.match(/[ŞşŢţ]/g) ?? []).toEqual([]);
  });
});
