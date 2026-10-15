/**
 * „Descarcă (Word)” — the user manual as a .docx, from the same model the screen draws.     (Slice #39.37)
 *
 * Ask first 3: built from the source on request, in the application's language, figures included. The browser
 * builds it (`manual-view.tsx`): it fetches each figure's PNG from /manual/figures, hands the bytes here, and
 * saves what comes back — so the download needs no server route and no file the server must find on disk, on
 * Vercel, on Ciprian's box or here alike.
 *
 * The package: [Content_Types].xml, the relationships, styles (Title, Heading 1–3 — so Word's navigation pane
 * and its own table of contents see the chapters — Caption), numbering (bullets, and a fresh 1, 2, 3 for every
 * numbered list), one word/media/figureN.png per figure, and document.xml: the title, the contents, then each
 * chapter on a new page. Headings carry their numbers as text; a cross-reference is drawn as the current number
 * of what it points at, as on the screen. A figure whose picture did not arrive is drawn as its caption and a
 * line saying so, never silently dropped. A4 portrait. Stored in a ZIP by `zip-store.ts`.
 *
 * PURE — `manual-docx.test.ts` covers it.
 */

import { escapeXml } from "@/lib/docx/xml";
import { zipStore, type ZipEntry } from "@/lib/docx/zip-store";
import { inlineText, type Block, type Inline, type Manual } from "@/lib/manual/format";

export type FigureImage = { data: Uint8Array; width: number; height: number };

export type ManualDocxLabels = {
  title: string;
  contents: string;
  /** „Figura” / „Figure”. */
  figure: string;
  /** Said where a figure's picture is missing. */
  missingFigure: string;
};

export type ManualDocxInput = {
  manual: Manual;
  /** By file name, as the source names it (`sidebar.png`). */
  figures: ReadonlyMap<string, FigureImage>;
  labels: ManualDocxLabels;
};

/** A PNG's width and height in pixels, from its IHDR chunk; null for anything that is not a PNG. */
export function pngSize(data: Uint8Array): { width: number; height: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (data.length < 24 || sig.some((b, i) => data[i] !== b)) return null;
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (String.fromCharCode(data[12], data[13], data[14], data[15]) !== "IHDR") return null;
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

const EMU_PER_PX = 9525; // 914 400 EMU an inch, 96 px an inch
/** A4 portrait less 2 cm margins: 17 cm. */
const MAX_WIDTH_EMU = 17 * 360000;

function run(text: string, opts: { bold?: boolean; italic?: boolean } = {}): string {
  const props = `${opts.bold ? "<w:b/>" : ""}${opts.italic ? "<w:i/>" : ""}`;
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function runs(inl: readonly Inline[], manual: Manual): string {
  return inl
    .map((x) => (x.kind === "bold" ? run(x.text, { bold: true }) : run(x.kind === "ref" ? inlineText([x], manual) : x.text)))
    .join("");
}

function para(content: string, pPr = ""): string {
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${content}</w:p>`;
}

const style = (id: string) => `<w:pStyle w:val="${id}"/>`;

const TABLE_BORDERS =
  '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="94A3B8"/><w:left w:val="single" w:sz="4" w:color="94A3B8"/><w:bottom w:val="single" w:sz="4" w:color="94A3B8"/><w:right w:val="single" w:sz="4" w:color="94A3B8"/><w:insideH w:val="single" w:sz="4" w:color="94A3B8"/><w:insideV w:val="single" w:sz="4" w:color="94A3B8"/></w:tblBorders>';

type Media = { name: string; rId: string; data: Uint8Array };

export function manualDocumentXml(input: ManualDocxInput): { xml: string; media: Media[]; orderedLists: number } {
  const { manual, figures, labels } = input;
  const media: Media[] = [];
  let orderedLists = 0;
  let docPr = 0;
  const body: string[] = [];

  body.push(para(run(labels.title), style("Title")));
  body.push(para(run(labels.contents), style("TOCHeading")));
  for (const c of manual.chapters) {
    for (const b of c.blocks) {
      if (b.kind !== "heading" || b.level > 2) continue;
      body.push(
        para(run(`${b.number}  ${b.title}`, { bold: b.level === 1 }), `<w:ind w:left="${b.level === 1 ? 0 : 400}"/><w:spacing w:after="20"/>`),
      );
    }
  }

  const figureXml = (b: Extract<Block, { kind: "figure" }>): string => {
    const caption = para(run(`${labels.figure} ${b.number} — ${b.caption}`, { italic: true }), style("Caption"));
    const img = figures.get(b.file);
    if (!img) return para(run(`[${labels.missingFigure}: ${b.file}]`, { italic: true }), "<w:jc w:val=\"center\"/>") + caption;
    const n = media.length + 1;
    const m: Media = { name: `figure${n}.png`, rId: `rIdFig${n}`, data: img.data };
    media.push(m);
    let cx = img.width * EMU_PER_PX;
    let cy = img.height * EMU_PER_PX;
    if (cx > MAX_WIDTH_EMU) {
      cy = Math.round((cy * MAX_WIDTH_EMU) / cx);
      cx = MAX_WIDTH_EMU;
    }
    docPr++;
    const drawing = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${docPr}" name="${escapeXml(`${labels.figure} ${b.number}`)}" descr="${escapeXml(b.caption)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${docPr}" name="${m.name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${m.rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    return para(drawing, '<w:keepNext/><w:jc w:val="center"/><w:spacing w:before="120"/>') + caption;
  };

  for (const c of manual.chapters) {
    for (const b of c.blocks) {
      switch (b.kind) {
        case "heading":
          body.push(para(run(`${b.number}  ${b.title}`), style(`Heading${b.level}`)));
          break;
        case "paragraph":
          body.push(para(runs(b.inlines, manual)));
          break;
        case "list": {
          const numId = b.ordered ? 100 + ++orderedLists : 1;
          for (const item of b.items) {
            body.push(para(runs(item, manual), `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>`));
          }
          break;
        }
        case "table": {
          const cols = b.header.length;
          const w = Math.floor(9638 / cols); // 17 cm in twips
          const cell = (inl: Inline[], head: boolean) =>
            `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/>' : ""}</w:tcPr>${para(head ? inl.map((x) => run(inlineText([x], manual), { bold: true })).join("") : runs(inl, manual))}</w:tc>`;
          const rows = [
            `<w:tr><w:trPr><w:tblHeader/></w:trPr>${b.header.map((h) => cell(h, true)).join("")}</w:tr>`,
            ...b.rows.map((r) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((x) => cell(x, false)).join("")}</w:tr>`),
          ];
          body.push(
            `<w:tbl><w:tblPr><w:tblW w:w="${w * cols}" w:type="dxa"/>${TABLE_BORDERS}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.join("")}</w:tbl>`,
            para(""),
          );
          break;
        }
        case "figure":
          body.push(figureXml(b));
          break;
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return { xml, media, orderedLists };
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

function documentRels(media: readonly Media[]): string {
  const img = media
    .map(
      (m) =>
        `<Relationship Id="${m.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${img}</Relationships>`;
}

function styles(lang: string): string {
  const heading = (n: number, size: number, extra: string) =>
    `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/>${extra}<w:spacing w:before="${n === 1 ? 0 : 240}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="1E3A8A"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="${lang}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="360"/></w:pPr><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="TOCHeading"><w:name w:val="TOC Heading"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="1E3A8A"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>${heading(1, 36, '<w:pageBreakBefore/>')}${heading(2, 28, "")}${heading(3, 24, "")}<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr><w:rPr><w:i/><w:color w:val="475569"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style></w:styles>`;
}

function numbering(orderedLists: number): string {
  const ordered = Array.from(
    { length: orderedLists },
    (_, i) =>
      `<w:num w:numId="${101 + i}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${ordered}</w:numbering>`;
}

export function renderManualDocx(input: ManualDocxInput): Uint8Array {
  const enc = new TextEncoder();
  const { xml, media, orderedLists } = manualDocumentXml(input);
  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES) },
    { name: "_rels/.rels", data: enc.encode(ROOT_RELS) },
    { name: "word/_rels/document.xml.rels", data: enc.encode(documentRels(media)) },
    { name: "word/styles.xml", data: enc.encode(styles(input.manual.locale)) },
    { name: "word/numbering.xml", data: enc.encode(numbering(orderedLists)) },
    { name: "word/document.xml", data: enc.encode(xml) },
    ...media.map((m) => ({ name: `word/media/${m.name}`, data: m.data })),
  ];
  return zipStore(entries);
}
