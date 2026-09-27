/**
 * FU-023 — the share the AI read shows in the party linker.     (Slice #37.06)
 *
 * `ai-interpret` returns a party's cotă as the model wrote it — STRINGS
 * („63,64", „1/2", „2.500") — while the linker dialog typed them as numbers and
 * formatted them with `formatCotaParte`, which gives "" for a string. So the
 * share the reader found never reached the box, and an off-list `cotaMod`
 * reached the POST that refuses it. The prefill now goes through the same
 * parser the box uses, and `cotaMod` is narrowed to the four values.
 */
import fs from "node:fs";
import path from "node:path";

import * as cota from "@/lib/documents/cota-parte";

type TextFromAi = (value: unknown, kind: "parte" | "mp") => string;
type ModFromAi = (value: unknown) => string | null;

const textFromAi = (cota as Record<string, unknown>).cotaTextFromAi as TextFromAi | undefined;
const modFromAi = (cota as Record<string, unknown>).cotaModFromAi as ModFromAi | undefined;

describe("FU-023: the AI's share becomes the box's text", () => {
  it("exists", () => {
    expect(typeof textFromAi).toBe("function");
    expect(typeof modFromAi).toBe("function");
  });

  it("reads the strings the route sends, the way the box would", () => {
    expect(textFromAi?.("63,64", "parte")).toBe("63,64");
    expect(textFromAi?.("63,64 %", "parte")).toBe("63,64");
    expect(textFromAi?.("1/2", "parte")).toBe("50");
    expect(textFromAi?.("2.500", "mp")).toBe("2500");
    expect(textFromAi?.("114,86 mp", "mp")).toBe("114,86");
  });

  it("still takes a number, and shows nothing for nothing", () => {
    expect(textFromAi?.(63.64, "parte")).toBe("63,64");
    expect(textFromAi?.(null, "parte")).toBe("");
    expect(textFromAi?.(undefined, "mp")).toBe("");
    expect(textFromAi?.("   ", "mp")).toBe("");
  });

  it("keeps text it cannot read, so the user sees what the AI read and the box says why", () => {
    expect(textFromAi?.("o treime", "parte")).toBe("o treime");
  });

  it("narrows cotaMod to the four stored values", () => {
    expect(modFromAi?.("DEVALMASIE")).toBe("DEVALMASIE");
    expect(modFromAi?.("devalmasie")).toBeNull();
    expect(modFromAi?.("în devălmășie")).toBeNull();
    expect(modFromAi?.(null)).toBeNull();
  });

  it("is what the dialog prefills from", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/app/documents/_components/ai-party-linker-dialog.tsx"),
      "utf8",
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).toContain('cotaTextFromAi(party?.cotaParte, "parte")');
    expect(code).toContain('cotaTextFromAi(party?.cotaSuprafataMp, "mp")');
    expect(code).toContain("cotaModFromAi(party?.cotaMod)");
  });
});
