/**
 * A skill box's look: its level's colour, and its state drawn over it.                       (Slice #39.42)
 *
 * Adrian's words, one test each: Open „coloured, no green mastery badge”; Mastered „coloured, with green
 * mastery badge”; Closed „greyed out, no green mastery badge, frame is dotted line”; Obsolete „greyed out, with
 * green mastery badge, frame is green thick line”. And the level picture's colours, which no state changes.
 */
import { CLOSED_FRAME, GREYED_TEXT, LEVEL_COLOURS, MASTERY_GREEN, boxAppearance } from "@/lib/skills/appearance";
import type { SkillLevel } from "@/lib/skills/catalogue";
import type { SkillState } from "@/lib/skills/progress";

const LEVELS: SkillLevel[] = [1, 2, 3, 4];
const STATES: SkillState[] = ["open", "mastered", "closed", "obsolete"];

describe("the level colours", () => {
  it("Basic pale blue with navy text; Intermediate mid blue and Advanced deep blue, white text; Expert navy, gold frame and gold text", () => {
    expect(LEVEL_COLOURS[1].text).toBe(LEVEL_COLOURS[4].fill); // the same navy
    expect(LEVEL_COLOURS[2].text).toBe("#ffffff");
    expect(LEVEL_COLOURS[3].text).toBe("#ffffff");
    expect(LEVEL_COLOURS[4].text).toBe(LEVEL_COLOURS[4].frame); // the gold
    // Lighter to darker, Basic to Expert: the sum of the channels falls.
    const light = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(light(LEVEL_COLOURS[1].fill)).toBeGreaterThan(light(LEVEL_COLOURS[2].fill));
    expect(light(LEVEL_COLOURS[2].fill)).toBeGreaterThan(light(LEVEL_COLOURS[3].fill));
    expect(light(LEVEL_COLOURS[3].fill)).toBeGreaterThan(light(LEVEL_COLOURS[4].fill));
  });

  it.each(LEVELS.flatMap((l) => STATES.map((s) => [l, s] as const)))("level %i, %s: the level's fill and text, whatever the state", (l, s) => {
    const a = boxAppearance(l, s);
    expect(a.fill).toBe(LEVEL_COLOURS[l].fill);
    expect(a.text).toBe(LEVEL_COLOURS[l].text);
    // Drawn in the level's text colour, except on a greyed box, where the level's white would vanish.
    expect(a.textShown).toBe(a.greyed ? GREYED_TEXT : LEVEL_COLOURS[l].text);
  });
});

describe("the four states", () => {
  it.each(LEVELS)("level %i — Open: coloured, no badge, the level's own frame", (l) => {
    expect(boxAppearance(l, "open")).toMatchObject({ greyed: false, badge: false, frameStyle: "solid", frameColour: LEVEL_COLOURS[l].frame });
  });
  it.each(LEVELS)("level %i — Mastered: coloured, with the green badge", (l) => {
    expect(boxAppearance(l, "mastered")).toMatchObject({ greyed: false, badge: true, frameStyle: "solid", frameColour: LEVEL_COLOURS[l].frame });
  });
  it.each(LEVELS)("level %i — Closed: greyed out, no badge, a dotted frame", (l) => {
    expect(boxAppearance(l, "closed")).toMatchObject({ greyed: true, badge: false, frameStyle: "dotted", frameColour: CLOSED_FRAME });
  });
  it.each(LEVELS)("level %i — Obsolete: greyed out, with the green badge, a thick green frame", (l) => {
    const a = boxAppearance(l, "obsolete");
    expect(a).toMatchObject({ greyed: true, badge: true, frameStyle: "solid", frameColour: MASTERY_GREEN });
    expect(a.frameWidth).toBeGreaterThanOrEqual(3);
    expect(a.frameWidth).toBeGreaterThan(boxAppearance(l, "open").frameWidth);
  });

  it("tells all four apart on every level", () => {
    for (const l of LEVELS) {
      const looks = STATES.map((s) => JSON.stringify(boxAppearance(l, s)));
      expect(new Set(looks).size).toBe(4);
    }
  });
});
