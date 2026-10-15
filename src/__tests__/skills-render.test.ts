/**
 * @jest-environment node
 *
 * The review copy of the skills inventory: the stored ZIP, the .docx in it, and the SVG.    (Slice #39.36)
 *
 * The node environment because the renderers use TextEncoder, which jsdom does not provide (#39.35).
 */

import { SKILL_PATHS, SKILLS } from "@/lib/skills/catalogue";
import { inventoryDocumentXml, renderInventoryDocx } from "@/lib/skills/render-docx";
import { escapeXml, renderSkillsSvg, wrapWords } from "@/lib/skills/render-svg";
import { crc32, readZipStore, zipStore } from "@/lib/docx/zip-store";

const enc = new TextEncoder();
const dec = new TextDecoder();

const DOCX_INPUT = {
  skills: SKILLS,
  paths: SKILL_PATHS,
  uncoveredCases: [{ id: "TC-LAYOUT-01", reason: "Layout & widths <not a skill>." }],
  uncoveredScreens: [],
  caseCount: { total: 151, covered: 150 },
};

describe("zip-store", () => {
  it("computes the standard CRC-32 check value", () => {
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("round-trips entries, Romanian text included, byte for byte", () => {
    const entries = [
      { name: "a.txt", data: enc.encode("Adaugă o persoană fizică — ș ț ă î â") },
      { name: "dir/b.bin", data: new Uint8Array([0, 255, 1, 254]) },
      { name: "empty", data: new Uint8Array() },
    ];
    const back = readZipStore(zipStore(entries));
    expect(back.map((e) => e.name)).toEqual(["a.txt", "dir/b.bin", "empty"]);
    expect(dec.decode(back[0].data)).toBe("Adaugă o persoană fizică — ș ț ă î â");
    expect([...back[1].data]).toEqual([0, 255, 1, 254]);
    expect(back[2].data.length).toBe(0);
  });

  it("starts with a local file header and gives the same bytes for the same input", () => {
    const zip = zipStore([{ name: "x", data: enc.encode("y") }]);
    expect([...zip.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(zipStore([{ name: "x", data: enc.encode("y") }])).toEqual(zip);
  });
});

describe("Skills.Inventory.docx", () => {
  const parts = readZipStore(renderInventoryDocx(DOCX_INPUT));
  const doc = dec.decode(parts.find((p) => p.name === "word/document.xml")?.data);

  it("is a WordprocessingML package with its document, styles and numbering", () => {
    expect(parts.map((p) => p.name)).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "word/_rels/document.xml.rels",
      "word/styles.xml",
      "word/numbering.xml",
      "word/document.xml",
    ]);
    expect(doc.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')).toBe(true);
    expect(doc).toContain('w:orient="landscape"');
  });

  it("carries every skill — its number, both names and its key", () => {
    for (const s of SKILLS) {
      expect(doc).toContain(`>${s.number}<`);
      expect(doc).toContain(escapeXml(s.name.en));
      expect(doc).toContain(escapeXml(s.name.ro));
      expect(doc).toContain(s.key);
    }
  });

  it("has one table per level, after the levels and the Paths tables, and one for the uncovered cases", () => {
    expect(doc.match(/<w:tbl>/g)?.length).toBe(2 + 4 + 1);
    for (const p of SKILL_PATHS) expect(doc).toContain(escapeXml(p.name.ro));
  });

  it("escapes what XML would otherwise read as markup", () => {
    expect(doc).toContain("Layout &amp; widths &lt;not a skill&gt;.");
    expect(doc).not.toContain("<not a skill>");
  });

  it("marks the Romanian runs as Romanian, for Word's spelling check", () => {
    expect(doc).toContain('<w:lang w:val="ro-RO"/>');
  });

  it("lists each skill's predecessors and successors by number", () => {
    // 2.1's row names 1.5 and 1.10 before it and 3.1 after it.
    const xml = inventoryDocumentXml(DOCX_INPUT);
    const row = xml.split("<w:tr>").find((r) => r.includes("persons-person-from-id-card"));
    expect(row).toContain(">1.5, 1.10<");
    expect(row).toContain(">3.1<");
  });
});

describe("Skills.Graph.svg", () => {
  const svg = renderSkillsSvg({ skills: SKILLS, paths: SKILL_PATHS });

  it("draws one box per skill and one arrow per predecessor", () => {
    expect(svg.match(/<rect [^>]*rx="8"/g)?.length).toBe(SKILLS.length);
    const arrows = SKILLS.reduce((n, s) => n + s.predecessors.length, 0);
    expect(svg.match(/<line /g)?.length).toBe(arrows);
  });

  it("dashes exactly the arrows that skip a level", () => {
    const level = new Map(SKILLS.map((s) => [s.key, s.level]));
    const skipping = SKILLS.reduce(
      (n, s) => n + s.predecessors.filter((p) => s.level - (level.get(p) ?? s.level) > 1).length,
      0,
    );
    expect(skipping).toBeGreaterThan(0);
    expect(svg.match(/stroke-dasharray/g)?.length).toBe(skipping);
  });

  it("heads the four columns with the levels' Romanian names", () => {
    for (const name of ["DE BAZĂ", "INTERMEDIAR", "AVANSAT", "EXPERT"]) expect(svg).toContain(`>${name}<`);
  });

  it("is well-formed enough to start and end as one svg element", () => {
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });
});

describe("wrapWords", () => {
  it("wraps greedily and keeps a long word whole", () => {
    expect(wrapWords("Adaugă o persoană fizică de mână", 14)).toEqual(["Adaugă o", "persoană", "fizică de mână"]);
    expect(wrapWords("Supercalifragilistic word", 5)).toEqual(["Supercalifragilistic", "word"]);
    expect(wrapWords("   ", 10)).toEqual([]);
  });
});
