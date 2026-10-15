/**
 * The manual's outline — one line per section saying what it answers, per language.                 (Slice #39.49)
 *
 * „Întreabă” hands Claude the question and this outline, and Claude names the sections that answer the question
 * by what it means (src/lib/manual/ask.ts). The lines were written by Claude from each section's text, in this
 * slice, as data beside the manual: `ro-RO.ts` and `en-GB.ts`, keyed by the section's stable id.
 *
 * ⚠️ A SECTION WITHOUT A LINE CANNOT BE FOUND. `manual-outline.test.ts` fails when a section of the current manual has
 * no line, when a line names a section that is gone, and when a line is empty or longer than OUTLINE_LINE_MAX — so
 * a chapter added, split or renamed cannot leave the outline stale. Server-side only: the page never imports it.
 */
import type { Manual, ManualLocale } from "@/lib/manual/format";
import { OUTLINE as EN } from "@/lib/manual/outline/en-GB";
import { OUTLINE as RO } from "@/lib/manual/outline/ro-RO";

export const MANUAL_OUTLINE: Readonly<Record<ManualLocale, Readonly<Record<string, string>>>> = { "ro-RO": RO, "en-GB": EN };

/** The longest an outline line may be, in characters — one line, not a paragraph. */
export const OUTLINE_LINE_MAX = 200;

export type OutlineIssues = { missing: string[]; unknown: string[]; badLength: string[] };

/** What is wrong with `lines` as the outline of `manual`: sections without a line, lines without a section, lengths. */
export function outlineIssues(manual: Manual, lines: Readonly<Record<string, string>>): OutlineIssues {
  const sections = [...manual.targets.values()].filter((t) => t.kind === "section").map((t) => t.id);
  const known = new Set(sections);
  return {
    missing: sections.filter((id) => !(id in lines)),
    unknown: Object.keys(lines).filter((id) => !known.has(id)),
    badLength: Object.entries(lines)
      .filter(([, l]) => l.trim().length === 0 || l.length > OUTLINE_LINE_MAX || l.includes("\n"))
      .map(([id]) => id),
  };
}
