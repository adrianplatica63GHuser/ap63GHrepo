/**
 * Which skills make a Path, and how the map draws a Path's arrows.                            (Slice #39.50)
 *
 * Adrian, 2026-10-15: „I would like to have each path containing all the expert level boxes belonging to that
 * specific path AND all the boxes that are necessary to be mastered in order to reach and master the expert
 * boxes for this path”. So a Path is not the skills labelled with it (39.42's filter) but everything it takes:
 *
 *   - the Path's own Expert skills, and every skill they rest on, transitively — whatever Path those carry;
 *   - plus every skill labelled with the Path, so a labelled skill that leads to none of its Expert skills
 *     (39.41's mastery rule counts every Advanced and Expert one) never disappears from view.
 *
 * Worked out from the catalogue each time, never listed by hand: a revised catalogue revises its Paths.
 *
 * And the arrows (Ask first 4): an arrow is bright only when both its ends are in the chosen Path. Every other
 * arrow is grey, and its head is the same grey — Adrian: „do not keep showing the arrowheads In a strong Navy
 * blue, Leave them as grey and unobtrusive as the grey arrow they belong to”. Hovering a box still brings its
 * own arrows forward, heads included, inside the Path or not.
 *
 * PURE MODULE — no React.
 */
import { SKILL_PATHS, SKILLS, type Skill, type SkillPathKey } from "./catalogue";

/** The keys of every skill in Path `path`: its Expert skills, all they rest on, and its own labelled skills. */
export function pathSkillKeys(path: SkillPathKey, skills: readonly Skill[] = SKILLS): ReadonlySet<string> {
  const byKey = new Map(skills.map((s) => [s.key, s]));
  const keys = new Set<string>();
  const climb = (key: string) => {
    if (keys.has(key) || !byKey.has(key)) return;
    keys.add(key);
    for (const p of byKey.get(key)!.predecessors) climb(p);
  };
  for (const s of skills) if (s.path === path && s.level === 4) climb(s.key);
  for (const s of skills) if (s.path === path) keys.add(s.key);
  return keys;
}

/** Every Path's skills, from the catalogue. */
export const PATH_SKILLS: Readonly<Record<SkillPathKey, ReadonlySet<string>>> = Object.fromEntries(
  SKILL_PATHS.map((p) => [p.key, pathSkillKeys(p.key)]),
) as Record<SkillPathKey, ReadonlySet<string>>;

/** Whether `key` is in the chosen Path; with no Path chosen („Toate traseele”), every skill is. */
export function inPath(key: string, path: SkillPathKey | null, paths: Readonly<Record<SkillPathKey, ReadonlySet<string>>> = PATH_SKILLS): boolean {
  return path === null || paths[path].has(key);
}

/** The arrow navy — the colour of an arrow in the Path, and of its head. */
export const ARROW_NAVY = "#1e3a6e";

/** The grey of an arrow outside the Path, and of its head. */
export const ARROW_GREY = "#b8bec7";

export type ArrowLook = {
  /** The line's colour — and its head's: an arrow's head is always its line's colour and opacity. */
  colour: string;
  opacity: number;
  width: number;
  /** Which of the map's arrowheads it ends in; one per colour. */
  head: "navy" | "grey";
};

/**
 * How one arrow is drawn. `kept`: both its ends are in the chosen Path (always, under „Toate traseele”).
 * `focused`: a box is hovered or focused; `lit`: this arrow leads to or from it.
 */
export function arrowLook({ kept, focused, lit }: { kept: boolean; focused: boolean; lit: boolean }): ArrowLook {
  if (focused && lit) return { colour: ARROW_NAVY, opacity: 1, width: 2.5, head: "navy" };
  if (!kept) return { colour: ARROW_GREY, opacity: focused ? 0.35 : 0.6, width: 1.2, head: "grey" };
  if (focused) return { colour: ARROW_NAVY, opacity: 0.12, width: 1.4, head: "navy" };
  return { colour: ARROW_NAVY, opacity: 0.55, width: 1.4, head: "navy" };
}
