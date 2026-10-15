/**
 * „Răspuns AI” — what Claude is given, and how its answer is read.                            (Slice #39.45)
 *
 * THE MANUAL IS THE ONLY SOURCE. Claude is handed the question and the sections the built-in search found — their
 * text, nothing else from the archive, no earlier questions — and asked for a short answer that names the sections
 * it uses, as [§3.2]. When the sections do not answer the question it says so with a fixed word, and the user is
 * told the manual does not say, never a guess.
 *
 * PURE — no I/O. The call is src/app/api/manual/ask/route.ts.
 */

/** Claude's word for „the sections do not answer this”. */
export const NOT_IN_MANUAL = "NOT_IN_MANUAL";

/** The most a question may be, in characters. */
export const QUESTION_MAX = 500;

/** The most of one section's text handed over, and of all of them together, in characters. */
export const SECTION_MAX = 2500;
export const CONTEXT_MAX = 9000;

export type AskSection = { id: string; number: string; title: string; text: string };

export type AskLang = "ro" | "en";

/** The Messages API body's system and user text. */
export function askPrompt(question: string, lang: AskLang, sections: readonly AskSection[]): { system: string; user: string } {
  const language = lang === "ro" ? "Romanian (with the comma-below letters ș and ț, never ş or ţ)" : "English";
  const system = [
    "You answer questions about GA40, a property, person and document archive, for its business users.",
    "Use ONLY the user-manual sections given in the message. Never add anything they do not say.",
    `Write in ${language}: at most three short sentences, plain text, no Markdown, no lists.`,
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
