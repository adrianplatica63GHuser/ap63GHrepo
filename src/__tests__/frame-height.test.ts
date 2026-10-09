/**
 * #38.56 — the reference list's frame scrolls, and its header row stays.
 * The rule is src/lib/ui/frame-height.ts.
 */
import fs from "node:fs";
import path from "node:path";

import { FRAME_MIN_PX, frameMaxHeight } from "@/lib/ui/frame-height";

const MODAL = fs.readFileSync(path.join(process.cwd(), "src/app/admin/value-lists/_components/value-list-modal.tsx"), "utf8");

describe("frameMaxHeight (#38.56)", () => {
  it("is the window's remaining height when the list stands beside the categories", () => {
    // 1920 × 1000: the scroll area 955 px, the frame 230 px down, 56 px under it.
    expect(frameMaxHeight({ viewport: 955, frameTop: 230, columnTop: 120, below: 56 })).toBe(669);
  });

  it("is a screen of its own when the list stands under the categories", () => {
    // 1366 × 900: the frame 760 px down, its column 650 px down — 855 - 110 - 56.
    expect(frameMaxHeight({ viewport: 855, frameTop: 760, columnTop: 650, below: 56 })).toBe(689);
  });

  it("is never under the minimum, however short the window", () => {
    expect(frameMaxHeight({ viewport: 300, frameTop: 200, columnTop: 100, below: 56 })).toBe(FRAME_MIN_PX);
  });

  it("takes the remaining height while it is at least the minimum", () => {
    expect(frameMaxHeight({ viewport: 700, frameTop: 360, columnTop: 100, below: 60 })).toBe(280);
    expect(frameMaxHeight({ viewport: 701, frameTop: 360, columnTop: 100, below: 60 })).toBe(281);
  });
});

describe("the frame and its header (#38.56)", () => {
  it("scrolls in both directions, at the measured height", () => {
    expect(MODAL).toContain('className="max-w-full overflow-auto rounded-md border border-card-rim dark:border-zinc-800"');
    expect(MODAL).toContain("style={frameHeight === null ? undefined : { maxHeight: frameHeight }}");
  });

  it("holds the header row at its top", () => {
    expect(MODAL).toMatch(/<thead className="sticky top-0 z-10 bg-cap /);
  });
});
