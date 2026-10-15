/**
 * The user manual's source format — a small Markdown subset — and the model it reads into.  (Slice #39.37)
 *
 * One source per chapter per language (`src/lib/manual/content/<locale>/NN-….ts`), read by ONE parser into ONE
 * model, from which the screen (`manual-view.tsx`) and the Word download (`render-docx.ts`) are both drawn — so
 * the two cannot disagree (Ask first 2).
 *
 * THE SUBSET, a line at a time:
 *
 *   # 2 Primii pași {#start}                    a chapter: its number, its title, its stable id
 *   ## 2.3 Bara laterală {#start-sidebar}        a section
 *   ### 2.3.1 Secțiunile {#start-sidebar-sections}   a subsection
 *   ![2.1 Bara laterală deschisă](sidebar.png){#fig-sidebar}   a figure: its number, caption, file, id
 *   - an item                                    a bulleted list (consecutive lines)
 *   1. an item                                   a numbered list
 *   | a | b |  then  |---|---|  then rows         a table, its first row the header
 *   anything else                                a paragraph; consecutive lines join, a blank line ends it
 *
 * and, inside any text: **bold**, and [[id]] — a cross-reference, drawn as the CURRENT number of the section or
 * figure with that id („vezi secțiunea [[start-sidebar]]”, „Figura [[fig-sidebar]]”).
 *
 * NUMBERS ARE WRITTEN, IDS ARE STABLE. The number is in the source so a reader of the source sees it; the id is
 * what everything outside the manual points at — a „?” popover (39.40), a skill or a quiz question (39.43), an
 * answer (39.45) — so renumbering never breaks a link. `validateManual` checks that the written numbers run
 * without gaps or duplicates, that every figure is referenced, that every cross-reference resolves, and that the
 * two languages have the same sections and figures under the same ids and numbers.
 *
 * PURE — `manual-format.test.ts` covers it.
 */

export type ManualLocale = "ro-RO" | "en-GB";
export const MANUAL_LOCALES: readonly ManualLocale[] = ["ro-RO", "en-GB"];

export type Inline = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "ref"; id: string };

export type HeadingBlock = { kind: "heading"; level: 1 | 2 | 3; number: string; title: string; id: string; line: number };
export type FigureBlock = { kind: "figure"; number: string; caption: string; file: string; id: string; line: number };
export type Block =
  | HeadingBlock
  | FigureBlock
  | { kind: "paragraph"; inlines: Inline[]; line: number }
  | { kind: "list"; ordered: boolean; items: Inline[][]; line: number }
  | { kind: "table"; header: Inline[][]; rows: Inline[][][]; line: number };

export type ManualChapter = {
  /** The chapter heading's id. */
  id: string;
  number: string;
  title: string;
  /** Every block, the chapter heading first. */
  blocks: Block[];
  /** Where the source came from, for error messages. */
  source: string;
};

export type ManualTarget = {
  id: string;
  kind: "chapter" | "section" | "figure";
  number: string;
  title: string;
  chapterId: string;
};

export type Manual = {
  locale: ManualLocale;
  chapters: ManualChapter[];
  /** Every chapter, section and figure, by id. */
  targets: Map<string, ManualTarget>;
};

export type ManualIssue = { code: ManualIssueCode; source: string; line?: number; message: string };
export type ManualIssueCode =
  | "bad-heading"
  | "bad-figure"
  | "bad-table"
  | "no-chapter-heading"
  | "second-chapter-heading"
  | "chapter-number"
  | "section-number"
  | "figure-number"
  | "duplicate-id"
  | "bad-id"
  | "unresolved-ref"
  | "unreferenced-figure"
  | "languages-differ";

const HEADING = /^(#{1,3})\s+(\d+(?:\.\d+){0,2})\s+(.+?)\s+\{#([^}\s]+)\}\s*$/;
const FIGURE = /^!\[(\d+\.\d+)\s+(.+?)\]\(([^)\s]+)\)\{#([^}\s]+)\}\s*$/;
const BULLET = /^- (.*)$/;
const ORDERED = /^\d+\. (.*)$/;
const TABLE_ROW = /^\|(.*)\|\s*$/;
const TABLE_RULE = /^\|(\s*:?-{3,}:?\s*\|)+\s*$/;
export const ID_SHAPE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** **bold** and [[id]] inside a run of text. Anything else is text, as written. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\[\[([^\]\s]+)\]\]/g;
  let at = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > at) out.push({ kind: "text", text: text.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else out.push({ kind: "ref", id: m[2] });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ kind: "text", text: text.slice(at) });
  return out;
}

function cells(row: string): string[] {
  const m = TABLE_ROW.exec(row);
  return m ? m[1].split("|").map((c) => c.trim()) : [];
}

/** One chapter's source into its blocks. Malformed lines become issues and are read as paragraphs. */
export function parseChapter(text: string, source: string): { chapter: ManualChapter | null; issues: ManualIssue[] } {
  const issues: ManualIssue[] = [];
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  const issue = (code: ManualIssueCode, line: number, message: string) => issues.push({ code, source, line, message });

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    const lineNo = i + 1;
    if (!line) {
      i++;
      continue;
    }
    if (line.startsWith("#")) {
      const m = HEADING.exec(line);
      if (m) {
        blocks.push({ kind: "heading", level: m[1].length as 1 | 2 | 3, number: m[2], title: m[3], id: m[4], line: lineNo });
      } else {
        issue("bad-heading", lineNo, `Not „# <number> <title> {#id}”: ${line}`);
        blocks.push({ kind: "paragraph", inlines: parseInline(line), line: lineNo });
      }
      i++;
      continue;
    }
    if (line.startsWith("![")) {
      const m = FIGURE.exec(line);
      if (m) blocks.push({ kind: "figure", number: m[1], caption: m[2], file: m[3], id: m[4], line: lineNo });
      else {
        issue("bad-figure", lineNo, `Not „![<n.m> <caption>](<file>){#id}”: ${line}`);
        blocks.push({ kind: "paragraph", inlines: parseInline(line), line: lineNo });
      }
      i++;
      continue;
    }
    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = !BULLET.test(line);
      const pattern = ordered ? ORDERED : BULLET;
      const items: Inline[][] = [];
      while (i < lines.length && pattern.test(lines[i].trim())) {
        items.push(parseInline((pattern.exec(lines[i].trim()) as RegExpExecArray)[1].trim()));
        i++;
      }
      blocks.push({ kind: "list", ordered, items, line: lineNo });
      continue;
    }
    if (TABLE_ROW.test(line)) {
      const rows: string[] = [];
      while (i < lines.length && TABLE_ROW.test(lines[i].trim())) rows.push(lines[i++].trim());
      if (rows.length < 2 || !TABLE_RULE.test(rows[1])) {
        issue("bad-table", lineNo, "A table needs a header row and a |---| rule under it.");
        continue;
      }
      const header = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      if (body.some((r) => r.length !== header.length)) {
        issue("bad-table", lineNo, `Every row needs ${header.length} cells, as the header has.`);
      }
      blocks.push({
        kind: "table",
        header: header.map(parseInline),
        rows: body.map((r) => r.map(parseInline)),
        line: lineNo,
      });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || l.startsWith("#") || l.startsWith("![") || BULLET.test(l) || ORDERED.test(l) || TABLE_ROW.test(l)) break;
      para.push(l);
      i++;
    }
    blocks.push({ kind: "paragraph", inlines: parseInline(para.join(" ")), line: lineNo });
  }

  const first = blocks[0];
  if (!first || first.kind !== "heading" || first.level !== 1) {
    issues.push({ code: "no-chapter-heading", source, message: "A chapter's source must open with its „# <n> <title> {#id}”." });
    return { chapter: null, issues };
  }
  for (const b of blocks.slice(1)) {
    if (b.kind === "heading" && b.level === 1) {
      issue("second-chapter-heading", b.line, "One chapter per source: a second „# ” heading.");
    }
  }
  return { chapter: { id: first.id, number: first.number, title: first.title, blocks, source }, issues };
}

/** The chapters of one language, in order, into a manual with its index of ids. */
export function buildManual(
  locale: ManualLocale,
  sources: readonly { source: string; text: string }[],
): { manual: Manual; issues: ManualIssue[] } {
  const issues: ManualIssue[] = [];
  const chapters: ManualChapter[] = [];
  for (const s of sources) {
    const r = parseChapter(s.text, s.source);
    issues.push(...r.issues);
    if (r.chapter) chapters.push(r.chapter);
  }
  const targets = new Map<string, ManualTarget>();
  for (const c of chapters) {
    for (const b of c.blocks) {
      if (b.kind !== "heading" && b.kind !== "figure") continue;
      const target: ManualTarget = {
        id: b.id,
        kind: b.kind === "figure" ? "figure" : b.level === 1 ? "chapter" : "section",
        number: b.number,
        title: b.kind === "figure" ? b.caption : b.title,
        chapterId: c.id,
      };
      if (!ID_SHAPE.test(b.id)) issues.push({ code: "bad-id", source: c.source, line: b.line, message: `„${b.id}” is not a kebab-case id.` });
      if (targets.has(b.id)) {
        issues.push({ code: "duplicate-id", source: c.source, line: b.line, message: `The id „${b.id}” is used twice.` });
      } else targets.set(b.id, target);
    }
  }
  return { manual: { locale, chapters, targets }, issues };
}

function refsOf(blocks: readonly Block[]): { id: string; line: number }[] {
  const out: { id: string; line: number }[] = [];
  const scan = (inl: readonly Inline[], line: number) => {
    for (const x of inl) if (x.kind === "ref") out.push({ id: x.id, line });
  };
  for (const b of blocks) {
    if (b.kind === "paragraph") scan(b.inlines, b.line);
    else if (b.kind === "list") b.items.forEach((it) => scan(it, b.line));
    else if (b.kind === "table") [b.header, ...b.rows].forEach((r) => r.forEach((c) => scan(c, b.line)));
  }
  return out;
}

/** Every rule of one language's manual. */
export function validateManual(manual: Manual): ManualIssue[] {
  const issues: ManualIssue[] = [];
  manual.chapters.forEach((c, ci) => {
    const add = (code: ManualIssueCode, line: number | undefined, message: string) =>
      issues.push({ code, source: c.source, line, message });
    if (c.number !== String(ci + 1)) add("chapter-number", 1, `Chapter ${ci + 1} is numbered „${c.number}”.`);
    let section = 0;
    let sub = 0;
    let figure = 0;
    for (const b of c.blocks.slice(1)) {
      if (b.kind === "heading" && b.level === 2) {
        section++;
        sub = 0;
        const want = `${c.number}.${section}`;
        if (b.number !== want) add("section-number", b.line, `„${b.number} ${b.title}” should be ${want}.`);
      } else if (b.kind === "heading" && b.level === 3) {
        sub++;
        const want = `${c.number}.${section}.${sub}`;
        if (section === 0 || b.number !== want) add("section-number", b.line, `„${b.number} ${b.title}” should be ${want}.`);
      } else if (b.kind === "figure") {
        figure++;
        const want = `${c.number}.${figure}`;
        if (b.number !== want) add("figure-number", b.line, `Figure „${b.number}” should be ${want}.`);
      }
    }
  });

  const referenced = new Set<string>();
  for (const c of manual.chapters) {
    for (const r of refsOf(c.blocks)) {
      referenced.add(r.id);
      if (!manual.targets.has(r.id)) {
        issues.push({ code: "unresolved-ref", source: c.source, line: r.line, message: `[[${r.id}]] points at nothing.` });
      }
    }
  }
  for (const c of manual.chapters) {
    for (const b of c.blocks) {
      if (b.kind === "figure" && !referenced.has(b.id)) {
        issues.push({
          code: "unreferenced-figure",
          source: c.source,
          line: b.line,
          message: `Figure ${b.number} („${b.id}”) is referenced nowhere — the text must point at it.`,
        });
      }
    }
  }
  return issues;
}

/** The two languages carry the same chapters, sections and figures, under the same ids, numbers and files. */
export function compareManuals(a: Manual, b: Manual): ManualIssue[] {
  const shape = (m: Manual) =>
    m.chapters.flatMap((c) =>
      c.blocks
        .filter((x): x is HeadingBlock | FigureBlock => x.kind === "heading" || x.kind === "figure")
        .map((x) => (x.kind === "figure" ? `figure ${x.number} {#${x.id}} ${x.file}` : `h${x.level} ${x.number} {#${x.id}}`)),
    );
  const sa = shape(a);
  const sb = shape(b);
  const issues: ManualIssue[] = [];
  const n = Math.max(sa.length, sb.length);
  for (let i = 0; i < n; i++) {
    if (sa[i] !== sb[i]) {
      issues.push({
        code: "languages-differ",
        source: `${a.locale} / ${b.locale}`,
        message: `At entry ${i + 1}: ${a.locale} has „${sa[i] ?? "—"}”, ${b.locale} has „${sb[i] ?? "—"}”.`,
      });
      break;
    }
  }
  return issues;
}

/** The text of a run of inlines, cross-references drawn as their current numbers. */
export function inlineText(inl: readonly Inline[], manual: Manual): string {
  return inl.map((x) => (x.kind === "ref" ? (manual.targets.get(x.id)?.number ?? `[[${x.id}]]`) : x.text)).join("");
}
