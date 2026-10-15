/**
 * @jest-environment node
 *
 * „Descarcă (Word)”: the manual's .docx — a valid package, numbered headings, figures embedded. (Slice #39.37)
 *
 * The node environment because the writer uses TextEncoder, which jsdom does not provide (#39.35).
 */

import { readZipStore } from "@/lib/docx/zip-store";
import { buildManual } from "@/lib/manual/format";
import { getManual } from "@/lib/manual/manual";
import { manualDocumentXml, pngSize, renderManualDocx, type FigureImage } from "@/lib/manual/render-docx";

const dec = new TextDecoder();
const LABELS = { title: "Manual de utilizare", contents: "Cuprins", figure: "Figura", missingFigure: "Figura lipsește" };

/** A real 3×2 PNG's first 24 bytes are what pngSize reads; the rest need not be a full image for the package. */
function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

const small = buildManual("ro-RO", [
  {
    source: "t",
    text: [
      "# 1 Introducere {#intro}",
      "Vezi Figura [[fig-a]] și secțiunea [[intro-b]] & altele <aici>.",
      "![1.1 Prima figură](a.png){#fig-a}",
      "## 1.1 Ceva {#intro-b}",
      "1. unu",
      "2. doi",
      "- punct",
      "3. din nou",
      "| A | B |",
      "|---|---|",
      "| x | **y** |",
      "![1.2 A doua, lipsă](missing.png){#fig-b}",
      "Și [[fig-b]].",
    ].join("\n"),
  },
]).manual;

describe("pngSize", () => {
  it("reads the IHDR width and height, and refuses what is not a PNG", () => {
    expect(pngSize(png(1600, 900))).toEqual({ width: 1600, height: 900 });
    expect(pngSize(new Uint8Array([1, 2, 3]))).toBeNull();
    const jpeg = new Uint8Array(30);
    jpeg.set([0xff, 0xd8, 0xff]);
    expect(pngSize(jpeg)).toBeNull();
  });
});

describe("the package", () => {
  const figures = new Map<string, FigureImage>([["a.png", { data: png(1600, 900), width: 1600, height: 900 }]]);
  const parts = readZipStore(renderManualDocx({ manual: small, figures, labels: LABELS }));
  const part = (name: string) => dec.decode(parts.find((p) => p.name === name)?.data);
  const doc = part("word/document.xml");

  it("holds the parts a Word document needs, and one media file per figure that arrived", () => {
    expect(parts.map((p) => p.name)).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "word/_rels/document.xml.rels",
      "word/styles.xml",
      "word/numbering.xml",
      "word/document.xml",
      "word/media/figure1.png",
    ]);
    expect(part("[Content_Types].xml")).toContain('Extension="png" ContentType="image/png"');
    expect(part("word/_rels/document.xml.rels")).toContain('Id="rIdFig1"');
    expect(part("word/_rels/document.xml.rels")).toContain('Target="media/figure1.png"');
  });

  it("embeds the figure at its proportions, no wider than the page", () => {
    expect(doc.match(/<w:drawing>/g)?.length).toBe(1);
    expect(doc).toContain('r:embed="rIdFig1"');
    const [, cx, cy] = /<wp:extent cx="(\d+)" cy="(\d+)"\/>/.exec(doc) ?? [];
    expect(Number(cx)).toBe(17 * 360000);
    expect(Number(cy)).toBe(Math.round((900 * 9525 * 17 * 360000) / (1600 * 9525)));
  });

  it("says where a figure's picture is missing, and still captions it", () => {
    expect(doc).toContain("[Figura lipsește: missing.png]");
    expect(doc).toContain("Figura 1.2 — A doua, lipsă");
  });

  it("numbers the headings in their text, styles them for Word's navigation, and lists them in the contents", () => {
    expect(doc).toContain('<w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">1  Introducere</w:t>');
    expect(doc).toContain('<w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t xml:space="preserve">1.1  Ceva</w:t>');
    expect(doc.indexOf("Cuprins")).toBeLessThan(doc.indexOf('w:val="Heading1"'));
    expect(part("word/styles.xml")).toContain('<w:outlineLvl w:val="0"/>');
    expect(part("word/styles.xml")).toContain('<w:lang w:val="ro-RO"/>');
  });

  it("draws a cross-reference as the current number, and escapes the text", () => {
    expect(doc).toContain("Vezi Figura </w:t></w:r><w:r><w:t xml:space=\"preserve\">1.1</w:t>");
    expect(doc).toContain("&amp; altele &lt;aici&gt;.");
  });

  it("restarts every numbered list at 1", () => {
    const { orderedLists } = manualDocumentXml({ manual: small, figures, labels: LABELS });
    expect(orderedLists).toBe(2);
    expect(part("word/numbering.xml").match(/<w:startOverride w:val="1"\/>/g)?.length).toBe(2);
    expect(doc).toContain('<w:numId w:val="101"/>');
    expect(doc).toContain('<w:numId w:val="102"/>');
    expect(doc).toContain('<w:numId w:val="1"/>'); // the bullet between them
  });
});

describe("the real manual, in both languages", () => {
  it.each(["ro-RO", "en-GB"] as const)("%s: a package with every chapter heading, and every figure missing said so", (locale) => {
    const manual = getManual(locale);
    const parts = readZipStore(renderManualDocx({ manual, figures: new Map(), labels: LABELS }));
    const doc = dec.decode(parts.find((p) => p.name === "word/document.xml")?.data);
    for (const c of manual.chapters) expect(doc).toContain(`${c.number}  ${c.title}`);
    const figures = manual.chapters.flatMap((c) => c.blocks.filter((b) => b.kind === "figure"));
    expect(doc.match(/\[Figura lipsește: /g)?.length).toBe(figures.length);
  });
});
