/**
 * „Întreabă” — a question answered from the user manual, by what it means.          (Slices #39.45, #39.49)
 *
 * Adrian, 2026-10-15, after #39.45's word search: „Better do not show any random results and just say you cannot
 * find answers in the user manual; don't try to search for the words inside the question because a question is
 * much more than the sum of its words.” So no list is ever built from shared words. One press, two steps, both
 * Claude (ASK_MODEL), the manual the only source:
 *
 *   1. PICK — the question and the manual's OUTLINE (every section's number, id, title and a line saying what it
 *      answers, src/lib/manual/outline). Claude names at most PICK_MAX section ids that answer the question, or
 *      NONE. An id that is not a section of the manual is dropped (`readPick`).
 *   2. ANSWER — the question and those sections' full text. At most three sentences naming the sections as [§3.2];
 *      NOT_IN_MANUAL when they do not answer after all.
 *
 * Either an answer with its sections, or „the manual does not answer this” — never anything in between.
 *
 * PURE — no I/O. The calls are src/app/api/manual/ask/route.ts.
 */
import { inlineText, type Block, type Manual } from "@/lib/manual/format";

/** Claude's word for „the sections do not answer this”. */
export const NOT_IN_MANUAL = "NOT_IN_MANUAL";

/** The pick's word for „no section answers this”. */
export const NO_SECTION = "NONE";

/** The most sections the pick may name. */
export const PICK_MAX = 5;

/** The most a question may be, in characters. */
export const QUESTION_MAX = 500;

/** The most of one section's text handed over, and of all of them together, in characters. */
export const SECTION_MAX = 4000;
export const CONTEXT_MAX = 16000;

export type AskSection = { id: string; number: string; title: string; text: string };

export type AskLang = "ro" | "en";

const languageName = (lang: AskLang) => (lang === "ro" ? "Romanian (with the comma-below letters ș and ț, never ş or ţ)" : "English");

// ── 1. The pick ─────────────────────────────────────────────────────────────────────────────────────────────

export type OutlineEntry = { id: string; number: string; title: string; summary: string };

/** Every section of the manual, in order, with its outline line ('' when the outline has none — a test forbids it). */
export function manualOutline(manual: Manual, lines: Readonly<Record<string, string>>): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  for (const c of manual.chapters) {
    for (const b of c.blocks) {
      if (b.kind === "heading" && b.level > 1) out.push({ id: b.id, number: b.number, title: b.title, summary: lines[b.id] ?? "" });
    }
  }
  return out;
}

/**
 * The pick's system text: the rule and the whole outline. It is the same for every question in a language, so the
 * route marks it for prompt caching and a second question within minutes reads it at a tenth of the price.
 */
export function pickSystem(lang: AskLang, outline: readonly OutlineEntry[]): string {
  return [
    "You find which sections of GA40's user manual answer a user's question. GA40 is a property, person and document archive.",
    "Below is the manual's outline: one line per section — its number, its id, its title, and what it answers.",
    "Read the question for what it MEANS, not for the words it shares with the outline: a question worded unlike the manual can still be answered by it, and one that shares its words may not be.",
    `Reply with the ids of the sections whose text answers the question — at most ${PICK_MAX}, the most useful first, one id per line, nothing else.`,
    `If no section answers it, reply with exactly ${NO_SECTION} and nothing else. Never name a section that only touches the subject.`,
    `The question may be in Romanian or in English, with or without diacritics; the outline is in ${languageName(lang)}.`,
    "",
    "Outline:",
    ...outline.map((e) => `${e.number} | ${e.id} | ${e.title} — ${e.summary}`),
  ].join("\n");
}

export function pickUser(question: string): string {
  return `Question: ${question.trim()}`;
}

/** The ids the pick named that are sections of the manual, once each, at most PICK_MAX; [] for NONE or nothing. */
export function readPick(text: string, sectionIds: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const token of text.split(/[\s,;|`"'„”()[\]]+/)) {
    const id = token.trim().replace(/[.:]$/, "");
    if (sectionIds.has(id) && !out.includes(id)) out.push(id);
    if (out.length === PICK_MAX) break;
  }
  return out;
}

// ── 2. The answer ───────────────────────────────────────────────────────────────────────────────────────────

function blockText(b: Block, manual: Manual): string {
  const t = (inl: Parameters<typeof inlineText>[0]) => inlineText(inl, manual).trim();
  switch (b.kind) {
    case "heading":
      return `§${b.number} ${b.title}`;
    case "paragraph":
      return t(b.inlines);
    case "list":
      return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : "-"} ${t(it)}`).join("\n");
    case "table":
      return [b.header.map(t).join(" · "), ...b.rows.map((r) => r.map(t).join(" · "))].join("\n");
    case "figure":
      return `(${b.caption})`;
  }
}

/** A section's whole text — its heading, its blocks and its subsections' — or null for an id that is not a section. */
export function sectionText(manual: Manual, id: string): string | null {
  for (const c of manual.chapters) {
    const at = c.blocks.findIndex((b) => b.kind === "heading" && b.id === id);
    if (at < 0) continue;
    const head = c.blocks[at];
    if (head.kind !== "heading") return null;
    const parts = [blockText(head, manual)];
    for (const b of c.blocks.slice(at + 1)) {
      if (b.kind === "heading" && b.level <= head.level) break;
      parts.push(blockText(b, manual));
    }
    return parts.filter(Boolean).join("\n");
  }
  return null;
}

/** The Messages API body's system and user text for the answer. */
export function askPrompt(question: string, lang: AskLang, sections: readonly AskSection[]): { system: string; user: string } {
  const system = [
    "You answer questions about GA40, a property, person and document archive, for its business users.",
    "Use ONLY the user-manual sections given in the message. Never add anything they do not say.",
    `Write in ${languageName(lang)}: at most three short sentences, plain text, no Markdown, no lists.`,
    "Name every section you use by its number in square brackets, like [§3.2], right after what it supports.",
    "Write the application's button, field and screen names exactly as the sections write them, in „…”: opened with „ and closed with ”, never a straight \".",
    `If the sections do not answer the question, reply with exactly ${NOT_IN_MANUAL} and nothing else.`,
  ].join("\n");
  let room = CONTEXT_MAX;
  const parts: string[] = [];
  for (const s of sections) {
    if (room <= 0) break;
    const text = s.text.slice(0, Math.min(SECTION_MAX, room));
    room -= text.length;
    parts.push(`<section number="${s.number}">\n${text}\n</section>`);
  }
  const user = `Question: ${question.trim()}\n\nManual sections:\n${parts.join("\n")}`;
  return { system, user };
}

export type AskAnswer =
  | { kind: "answer"; text: string; cited: string[] }
  | { kind: "not-in-manual" };

/**
 * Read Claude's text: the fixed word means the manual does not answer; otherwise the answer, and the ids of the
 * given sections it names. A section number the model names that was not given is dropped from the text.
 */
export function readAnswer(text: string, sections: readonly AskSection[]): AskAnswer {
  const t = text.trim();
  if (t === "" || t.includes(NOT_IN_MANUAL)) return { kind: "not-in-manual" };
  const byNumber = new Map(sections.map((s) => [s.number, s.id]));
  const cited: string[] = [];
  // „[§3.2]”, and „[§3.2, §6.5]” too, become one mark per given section; a number not given is dropped.
  const clean = t
    .replace(/\s*\[([^\]]*§[^\]]*)\]/g, (_whole, inner: string) => {
      const marks: string[] = [];
      for (const raw of inner.split(/[,;]|\bși\b|\band\b/)) {
        const n = raw.replace(/[§\s]/g, "").replace(/\.$/, "");
        const id = byNumber.get(n);
        if (!id) continue;
        if (!cited.includes(id)) cited.push(id);
        marks.push(`[§${n}]`);
      }
      return marks.length ? ` ${marks.join(" ")}` : "";
    })
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
  return { kind: "answer", text: typographicQuotes(clean), cited };
}

/** A quote opened with „ and closed with a straight " is closed with ” — the model sometimes mixes them. */
export function typographicQuotes(text: string): string {
  return text.replace(/„([^„”"\n]{0,200})"/g, "„$1”");
}

/** An answer cut into runs: plain text, and the [§n] marks as links to their sections. */
export function answerRuns(text: string, sections: readonly { id: string; number: string }[]): ({ text: string } | { id: string; number: string })[] {
  const byNumber = new Map(sections.map((s) => [s.number, s.id]));
  const out: ({ text: string } | { id: string; number: string })[] = [];
  let at = 0;
  for (const m of text.matchAll(/\[§([\d.]+)\]/g)) {
    const id = byNumber.get(m[1]);
    if (!id) continue;
    const start = m.index ?? 0;
    if (start > at) out.push({ text: text.slice(at, start) });
    out.push({ id, number: m[1] });
    at = start + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
