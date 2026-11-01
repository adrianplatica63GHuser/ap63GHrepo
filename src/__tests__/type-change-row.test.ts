/**
 * Slice 41.29: „Schimbă tipul…" keeps the tile's own inset from its right edge.
 *
 * „Tip document" is XL (272 px). Beside it, on a saved document, stands the 30-px „Schimbă tipul…" button. Dragged to
 * 2 units (228 px inside), the pair used to fill the row by shrinking the box, and the button landed on the border. The
 * box is now capped at the tile's inner width less the 8-px gap and the button, so the row is never wider than the
 * tile's inner width — at 3 units it is still 272 px, at 2 units it narrows and wraps.
 */
import fs from "fs";
import path from "path";
import { BESIDE_ICON_REM, DOCUMENT, boxRem, cappedBoxStyle, unitsInnerRem } from "@/lib/ui/field-widths";

const FORM = fs.readFileSync(path.join(process.cwd(), "src/app/documents/_components/document-form.tsx"), "utf8");
const PX = 16;
const BUTTON_PX = 30;
const GAP_PX = 8;

/** The box as `min()` resolves it inside a tile `innerPx` wide. */
const boxPx = (innerPx: number) => Math.min(boxRem(DOCUMENT.documentTypeId) * PX, innerPx - BESIDE_ICON_REM * PX);

describe("41.29 — the type row fits its tile", () => {
  it("the room beside the box is the 8-px gap and the 30-px button", () => {
    expect(BESIDE_ICON_REM * PX).toBe(GAP_PX + BUTTON_PX);
  });

  it("the box is capped at the tile's inner width less that room, and is its own width outside a tile", () => {
    expect(cappedBoxStyle(DOCUMENT.documentTypeId, BESIDE_ICON_REM).width).toBe(
      `min(17rem, calc(var(--tile-inner, ${17 + BESIDE_ICON_REM}rem) - ${BESIDE_ICON_REM}rem))`,
    );
    expect(cappedBoxStyle(DOCUMENT.documentTypeId).width).toBe("min(17rem, calc(var(--tile-inner, 17rem) - 0rem))");
  });

  it.each([2, 3, 4, 5])("at %i units the box, the gap and the button are never wider than the tile's inner width", (units) => {
    const inner = unitsInnerRem(units) * PX;
    const row = boxPx(inner) + GAP_PX + BUTTON_PX;
    expect(row).toBeLessThanOrEqual(inner);
    // At 2 units the button ends exactly at the inner edge; wider, the box keeps its own 272 px.
    if (units === 2) expect(row).toBe(inner);
    else expect(boxPx(inner)).toBe(272);
  });

  it("SelectField caps the box only beside a change action, and puts 8 px between the box and the button", () => {
    expect(FORM).toMatch(/changeAction \? cappedBoxStyle\(width, BESIDE_ICON_REM\) : boxStyle\(width\)/);
    expect(FORM).toMatch(/<div className="flex items-start gap-2" data-type-change-row>/);
  });
});
