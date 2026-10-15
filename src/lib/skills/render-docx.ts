/**
 * Skills.Inventory.docx — the inventory as a Word document, for Adrian's review.            (Slice #39.36)
 *
 * Ask first 3: English, with the Romanian names beside them; the six Paths; one table per level, each skill with
 * its predecessors and its successors; the cases and screens each skill draws on; and what no skill covers.
 * Generated from the catalogue, never typed: `scripts/skills/render-inventory.ts` writes it.
 *
 * A minimal WordprocessingML package — [Content_Types].xml, the two relationship parts, styles.xml and
 * document.xml — in a stored ZIP (`zip-store.ts`). A4 landscape, so a level's table fits across the page.
 *
 * PURE — `skills-render.test.ts` covers it.
 */

import {
  SKILL_LEVELS,
  type Skill,
  type SkillPath,
} from "@/lib/skills/catalogue";
import { escapeXml } from "@/lib/docx/xml";
import { zipStore } from "@/lib/docx/zip-store";

export type DocxInput = {
  skills: readonly Skill[];
  paths: readonly SkillPath[];
  /** Test cases no skill draws on, with the reason each is left out. */
  uncoveredCases: readonly { id: string; reason: string }[];
  /** Help-registry screens no skill is practised on. */
  uncoveredScreens: readonly string[];
  /** How many catalogue cases there are, and how many the skills draw on. */
  caseCount: { total: number; covered: number };
};

type Run = { text: string; bold?: boolean; italic?: boolean; size?: number; color?: string; ro?: boolean };

function run(r: Run): string {
  const props = [
    r.bold ? "<w:b/>" : "",
    r.italic ? "<w:i/>" : "",
    r.color ? `<w:color w:val="${r.color}"/>` : "",
    r.size ? `<w:sz w:val="${r.size}"/><w:szCs w:val="${r.size}"/>` : "",
    r.ro ? '<w:lang w:val="ro-RO"/>' : "",
  ].join("");
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(r.text)}</w:t></w:r>`;
}

function para(runs: Run[] | string, style?: string, extra = ""): string {
  const rs = typeof runs === "string" ? [{ text: runs }] : runs;
  const pPr = style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extra}</w:pPr>` : "";
  return `<w:p>${pPr}${rs.map(run).join("")}</w:p>`;
}

const BORDERS =
  '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="94A3B8"/><w:left w:val="single" w:sz="4" w:color="94A3B8"/><w:bottom w:val="single" w:sz="4" w:color="94A3B8"/><w:right w:val="single" w:sz="4" w:color="94A3B8"/><w:insideH w:val="single" w:sz="4" w:color="94A3B8"/><w:insideV w:val="single" w:sz="4" w:color="94A3B8"/></w:tblBorders>';

/** A table: widths in twips; each cell a list of paragraphs (XML); the first row repeats as a header. */
function table(widths: number[], header: string[], rows: string[][][]): string {
  const cell = (w: number, content: string[], shade?: string) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ""}</w:tcPr>${content.length ? content.join("") : "<w:p/>"}</w:tc>`;
  const head = `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${header
    .map((h, i) => cell(widths[i], [para([{ text: h, bold: true, size: 18 }])], "E2E8F0"))
    .join("")}</w:tr>`;
  const body = rows
    .map((r) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c, i) => cell(widths[i], c)).join("")}</w:tr>`)
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/>${BORDERS}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths
    .map((w) => `<w:gridCol w:w="${w}"/>`)
    .join("")}</w:tblGrid>${head}${body}</w:tbl>${para("")}`;
}

const small = (text: string, extra: Partial<Run> = {}): Run => ({ text, size: 17, ...extra });

export function inventoryDocumentXml(input: DocxInput): string {
  const { skills, paths } = input;
  const byKey = new Map(skills.map((s) => [s.key, s]));
  const pathName = new Map(paths.map((p) => [p.key, p]));
  const successors = (key: string) => skills.filter((s) => s.predecessors.includes(key));
  const numbers = (list: readonly Skill[]) =>
    list.length ? list.map((s) => s.number).join(", ") : "—";
  const body: string[] = [];

  body.push(para("Skills inventory", "Title"));
  body.push(
    para([
      {
        text: `${skills.length} skills a business user needs to master this archive, in four levels and ${paths.length} Paths. Generated from src/lib/skills/catalogue.ts (Slice 39.36) — edit the catalogue, never this document.`,
      },
    ]),
  );

  body.push(para("How to read it", "Heading1"));
  for (const line of [
    "An arrow A → B means A must be mastered before B can be approached. „Before it” lists a skill's predecessors; „Opens” lists the skills it is a predecessor of.",
    "An arrow always goes up at least one level and never from Basic straight to Expert; Basic → Advanced and Intermediate → Expert are allowed.",
    "Every skill above Basic has two or three predecessors and traces back to Basic; every Basic skill opens at least two others; there are no cycles.",
    "Every skill belongs to exactly one Path. A Path is mastered when all its Advanced and Expert skills are mastered.",
    "The number (1.1, 2.3 …) may change when the inventory is revised. The key under it never changes: a user's progress is stored against it.",
  ]) {
    body.push(para([{ text: line }], undefined, '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'));
  }

  body.push(para("Levels", "Heading1"));
  body.push(
    table(
      [3000, 3000, 2000],
      ["Level", "Romanian", "Skills"],
      SKILL_LEVELS.map((lv) => [
        [para(`${lv.level} — ${lv.name.en}`)],
        [para([{ text: lv.name.ro, ro: true }])],
        [para(String(skills.filter((s) => s.level === lv.level).length))],
      ]),
    ),
  );

  body.push(para("Paths", "Heading1"));
  body.push(
    table(
      [2600, 2900, 5338, 1000, 3000],
      ["Path", "Romanian", "What it covers", "Skills", "Mastered when these are"],
      paths.map((p) => {
        const members = skills.filter((s) => s.path === p.key);
        const mastery = members.filter((s) => s.level >= 3);
        return [
          [para(p.name.en)],
          [para([{ text: p.name.ro, ro: true }])],
          [para(p.description.en), para([small(p.description.ro, { ro: true, color: "475569" })])],
          [para(String(members.length))],
          [para(numbers(mastery))],
        ];
      }),
    ),
  );

  for (const lv of SKILL_LEVELS) {
    const inLevel = skills
      .filter((s) => s.level === lv.level)
      .sort((a, b) => Number(a.number.split(".")[1]) - Number(b.number.split(".")[1]));
    body.push(para(`Level ${lv.level} — ${lv.name.en} (${lv.name.ro}) · ${inLevel.length} skills`, "Heading1"));
    body.push(
      table(
        [700, 2600, 2900, 1500, 4638, 1200, 1300],
        ["No.", "Skill", "Romanian", "Path", "Description", "Before it", "Opens"],
        inLevel.map((s) => {
          const preds = s.predecessors.map((k) => byKey.get(k)).filter((x): x is Skill => x !== undefined);
          return [
            [para([{ text: s.number, bold: true }])],
            [para([{ text: s.name.en, bold: true }]), para([small(s.key, { color: "64748B" })])],
            [para([{ text: s.name.ro, ro: true }]), para([small(s.description.ro, { ro: true, color: "475569" })])],
            [para(pathName.get(s.path)?.name.en ?? s.path)],
            [
              para(s.description.en),
              para([small(`Cases: ${s.cases.length ? s.cases.join(", ") : "—"}`, { color: "475569" })]),
              para([small(`Screens: ${s.screens.length ? s.screens.join(", ") : "—"}`, { color: "475569" })]),
            ],
            [para(numbers(preds))],
            [para(numbers(successors(s.key)))],
          ];
        }),
      ),
    );
  }

  body.push(para("What no skill covers", "Heading1"));
  body.push(
    para(
      `${input.caseCount.covered} of the ${input.caseCount.total} test cases in docs/testing/TEST-CATALOGUE.md are drawn on by at least one skill.`,
    ),
  );
  if (input.uncoveredCases.length) {
    body.push(
      table(
        [2000, 12838],
        ["Case", "Why no skill draws on it"],
        input.uncoveredCases.map((c) => [[para(c.id)], [para(c.reason)]]),
      ),
    );
  }
  body.push(
    para(
      input.uncoveredScreens.length
        ? `Help screens no skill is practised on: ${input.uncoveredScreens.join(", ")}.`
        : "Every help screen in src/lib/help/registry.ts is practised on by at least one skill.",
    ),
  );

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="200"/></w:pPr><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="1E3A8A"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style></w:styles>`;

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

export function renderInventoryDocx(input: DocxInput): Uint8Array {
  const enc = new TextEncoder();
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES) },
    { name: "_rels/.rels", data: enc.encode(ROOT_RELS) },
    { name: "word/_rels/document.xml.rels", data: enc.encode(DOCUMENT_RELS) },
    { name: "word/styles.xml", data: enc.encode(STYLES) },
    { name: "word/numbering.xml", data: enc.encode(NUMBERING) },
    { name: "word/document.xml", data: enc.encode(inventoryDocumentXml(input)) },
  ]);
}
