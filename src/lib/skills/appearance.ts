/**
 * How a skill box looks: its level's colour and its state, drawn over it.                    (Slice #39.42)
 *
 * Adrian's request: „The colour of a skill box is fixed and is determined solely by its level. This colour,
 * together with the skill name shown inside the box, remains consistent”. The level picture's colours:
 *
 *   Basic          pale blue,  navy text
 *   Intermediate   mid blue,   white text
 *   Advanced       deep blue,  white text
 *   Expert         navy,       a gold frame and gold text
 *
 * And the states, in his words:
 *
 *   Open      „coloured, no green mastery badge”
 *   Mastered  „coloured, with green mastery badge”
 *   Closed    „greyed out, no green mastery badge, frame is dotted line”
 *   Obsolete  „greyed out, with green mastery badge, frame is green thick line”
 *
 * „Greyed out” is drawn OVER the level's colour (a grey wash), never instead of it: the fill keeps its level,
 * so a grey Expert box is a darker grey than a grey Basic one. The name stays, in a dark grey the wash cannot
 * swallow (GREYED_TEXT). The state itself comes from progress.ts, never from here.
 *
 * PURE MODULE — no React.
 */
import type { SkillLevel } from "./catalogue";
import type { SkillState } from "./progress";

export type LevelColours = { fill: string; text: string; frame: string };

export const LEVEL_COLOURS: Readonly<Record<SkillLevel, LevelColours>> = {
  1: { fill: "#e4eefb", text: "#0b1f4d", frame: "#9bb7df" },
  2: { fill: "#3b7dd8", text: "#ffffff", frame: "#2e67b8" },
  3: { fill: "#1c4ea6", text: "#ffffff", frame: "#163e86" },
  4: { fill: "#0b1f4d", text: "#d9ad3c", frame: "#d9ad3c" },
};

/** The mastery badge's green, and the Obsolete frame's. */
export const MASTERY_GREEN = "#16a34a";

/** The grey of a Closed box's dotted frame. */
export const CLOSED_FRAME = "#8b929c";

/**
 * The text on a greyed box. The wash lightens the level's fill to a grey, and a level's own text — white on
 * Intermediate and Advanced — would vanish on it; the name stays, drawn in a dark grey.
 */
export const GREYED_TEXT = "#374151";

export type BoxAppearance = {
  /** The level's — the same in every state. */
  fill: string;
  text: string;
  /** The text as drawn: the level's, or GREYED_TEXT on a greyed box. */
  textShown: string;
  /** A grey wash over the fill and the text: Closed and Obsolete. */
  greyed: boolean;
  frameColour: string;
  frameStyle: "solid" | "dotted";
  /** In CSS pixels. */
  frameWidth: number;
  /** The green mastery badge: Mastered and Obsolete. */
  badge: boolean;
};

export function boxAppearance(level: SkillLevel, state: SkillState): BoxAppearance {
  const c = LEVEL_COLOURS[level];
  // Expert's gold frame is part of its level colour, so it is drawn a little heavier.
  const levelFrame = { frameColour: c.frame, frameStyle: "solid" as const, frameWidth: level === 4 ? 2 : 1 };
  switch (state) {
    case "open":
      return { fill: c.fill, text: c.text, textShown: c.text, greyed: false, ...levelFrame, badge: false };
    case "mastered":
      return { fill: c.fill, text: c.text, textShown: c.text, greyed: false, ...levelFrame, badge: true };
    case "closed":
      return { fill: c.fill, text: c.text, textShown: GREYED_TEXT, greyed: true, frameColour: CLOSED_FRAME, frameStyle: "dotted", frameWidth: 2, badge: false };
    case "obsolete":
      return { fill: c.fill, text: c.text, textShown: GREYED_TEXT, greyed: true, frameColour: MASTERY_GREEN, frameStyle: "solid", frameWidth: 4, badge: true };
  }
}
