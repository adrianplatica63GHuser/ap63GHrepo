/**
 * Slice 41.11 — „Înregistrează o interacțiune": compact, its buttons icons.
 *
 * Adrian, 2026-10-29: „replace the buttons “New Interaction”, “Edit selected” then the list of channels, inbound,
 * outbound, save, save and new, cancel with smaller buttons that have one or two icons". Each is a small icon button,
 * its words the hover hint and the accessible name; a chosen channel, direction or mode is pressed (Ask first 1);
 * labels at 12 px in navy above their boxes, gaps of 8 px (Ask first 2); Ctrl+S in „Salvează"'s hint (Ask first 3).
 */
import { readFileSync } from "fs";
import { join } from "path";

import { LOG_DESCRIPTION_REM, SCREEN, unitsInnerRem } from "@/lib/ui/field-widths";

const ROOT = join(__dirname, "..", "..");
const TILE = readFileSync(join(ROOT, "src", "app", "interactions", "_components", "log-tile.tsx"), "utf8");
const messages = (locale: string) => JSON.parse(readFileSync(join(ROOT, "messages", `${locale}.json`), "utf8"));

describe("the log form's buttons are small icons (Ask first 1)", () => {
  it("the mode: Plus and Pencil, pressed by the mode in force, in a group beside the title", () => {
    expect(TILE).toMatch(/<div role="group" aria-label=\{tl\("mode"\)\} data-log-mode=\{mode\}/);
    expect(TILE).toMatch(/icon=\{Plus\}\s*label=\{tl\("modeNew"\)\}[\s\S]{0,120}size="sm"\s*aria-pressed=\{mode === "new"\}/);
    expect(TILE).toMatch(/icon=\{Pencil\}\s*label=\{tl\("modeEdit"\)\}[\s\S]{0,120}size="sm"\s*aria-pressed=\{mode === "edit"\}\s*disabled=\{!selectedId\}/);
    expect(TILE).not.toContain('role="radiogroup"');
  });

  it("each channel its history icon, each direction ArrowDownLeft / ArrowUpRight — pressed when chosen", () => {
    expect(TILE).toMatch(/icon=\{CHANNEL_ICON\[c\]\}\s*label=\{t\(`channel\.\$\{c\}`\)\}[\s\S]{0,80}size="sm"\s*aria-pressed=\{on\}/);
    expect(TILE).toContain("const LOG_DIRECTION_ICON = { INBOUND: ArrowDownLeft, OUTBOUND: ArrowUpRight } as const;");
    expect(TILE).toMatch(/icon=\{LOG_DIRECTION_ICON\[d\]\}\s*label=\{t\(`direction\.\$\{d\}`\)\}[\s\S]{0,80}size="sm"\s*aria-pressed=\{on\}/);
  });

  it("„Salvează” a check with Ctrl+S in its hint, „Salvează și adaugă” a check and a plus, „Renunță” an X — none with words", () => {
    const bar = TILE.slice(TILE.indexOf("{/* The action bar (§4)."), TILE.indexOf("</form>"));
    expect(bar).toMatch(/icon=\{Check\}\s*label=\{mode === "edit" \? tl\("saveChanges"\) : tl\("save"\)\}\s*note=\{tl\("ctrlSHint"\)\}/);
    expect(bar).toMatch(/icon=\{Check\}\s*secondIcon=\{Plus\}\s*label=\{tl\("saveAndNew"\)\}/);
    expect(bar).toMatch(/<IconButton icon=\{X\} label=\{tl\("cancel"\)\}/);
    expect(bar).not.toContain("showLabel");
    expect(bar).not.toContain("<kbd");
    expect((bar.match(/size="sm"/g) ?? []).length).toBe(4);
    expect(messages("ro-RO").interactions.log.ctrlSHint).toBe("Salvează cu Ctrl+S");
    expect(messages("en-GB").interactions.log.ctrlSHint).toBe("Save with Ctrl+S");
  });
});

describe("compact (Ask first 2)", () => {
  it("labels at 12 px in navy, 2 px above their boxes; 8-px gaps; 12-px padding", () => {
    expect(TILE).toMatch(/<div className="flex flex-col gap-0\.5">\s*\{htmlFor \? \(\s*<label htmlFor=\{htmlFor\} className=\{FIELD_LABEL\}>/);
    expect(TILE).toContain("flex min-w-0 flex-col gap-2 p-3");
    expect(TILE).not.toMatch(/flex-col gap-4/);
  });

  it("Subiect L, Data și ora L (M cuts the time), the memento's date M; Descriere the card's width, growing", () => {
    expect(SCREEN.interactionSubjectBox).toEqual({ step: "L", kind: "input" });
    expect(SCREEN.interactionWhen.step).toBe("L");
    expect(SCREEN.interactionDay.step).toBe("M");
    expect(TILE).toContain('{...screenBox("interactionSubjectBox")}');
    expect(TILE).toMatch(/<GrowingText\s*id="interaction-description"\s*lines/);
    expect(LOG_DESCRIPTION_REM * 16).toBeCloseTo(unitsInnerRem(5) * 16 - 26, 6);
  });
});
