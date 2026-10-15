/**
 * @jest-environment node
 *
 * The manual's outline — one line per section, in both languages, never stale.              (Slice #39.49)
 *
 * „Întreabă” can only pick a section the outline names: a section added without its line could never be found,
 * and a line for a section that is gone would be offered to Claude as an answer. So the outline is held to the
 * current manual, section by section, in each language.
 */
import { MANUAL_LOCALES, type Manual } from "@/lib/manual/format";
import { getManual } from "@/lib/manual/manual";
import { MANUAL_OUTLINE, OUTLINE_LINE_MAX, outlineIssues } from "@/lib/manual/outline";

describe.each(MANUAL_LOCALES.map((l) => [l]))("the %s outline", (locale) => {
  it("has one line for every section of the manual and none for a section that is gone", () => {
    expect(outlineIssues(getManual(locale), MANUAL_OUTLINE[locale])).toEqual({ missing: [], unknown: [], badLength: [] });
  });

  it("is in its own language", () => {
    const lines = Object.values(MANUAL_OUTLINE[locale]);
    const romanian = lines.filter((l) => /[ăâîșț]/i.test(l)).length;
    if (locale === "ro-RO") expect(romanian / lines.length).toBeGreaterThan(0.9);
    else expect(lines.filter((l) => /\b(the|and|how)\b/i.test(l)).length / lines.length).toBeGreaterThan(0.9);
    expect(lines.filter((l) => /[şţŞŢ]/.test(l))).toEqual([]);
  });
});

describe("outlineIssues", () => {
  const manual = {
    locale: "ro-RO",
    chapters: [],
    targets: new Map([
      ["a", { id: "a", kind: "section", number: "1.1", title: "A", chapterId: "c" }],
      ["b", { id: "b", kind: "section", number: "1.2", title: "B", chapterId: "c" }],
      ["fig", { id: "fig", kind: "figure", number: "1.1", title: "F", chapterId: "c" }],
      ["c", { id: "c", kind: "chapter", number: "1", title: "C", chapterId: "c" }],
    ]),
  } as unknown as Manual;

  it("names the sections without a line, the lines without a section, and the lines that are empty or too long", () => {
    expect(outlineIssues(manual, { a: "ok", gone: "x", b: "y".repeat(OUTLINE_LINE_MAX + 1) })).toEqual({
      missing: [],
      unknown: ["gone"],
      badLength: ["b"],
    });
    expect(outlineIssues(manual, { a: " " }).missing).toEqual(["b"]);
    expect(outlineIssues(manual, { a: " " }).badLength).toEqual(["a"]);
  });
});
