/**
 * What the skills cover — the test cases and help screens no skill draws on.                (Slice #39.36)
 *
 * The header's Ask first 2: „completeness beats a round number: a screen or a test case no skill covers is listed
 * as a gap”. `skills-catalogue.test.ts` fails on a gap that is not in SKILLS_UNCOVERED_CASES with its reason, and
 * the inventory document lists what is. PURE — the caller reads the files.
 */

import type { Skill } from "@/lib/skills/catalogue";

/** Every case id in TEST-CATALOGUE.md's table: the rows that open `| [TC-…](cases/TC-….md) |`. */
export function catalogueCaseIds(markdown: string): string[] {
  const ids: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^\|\s*\[(TC-[A-Z]+-\d+)\]\(cases\//.exec(line);
    if (m) ids.push(m[1]);
  }
  return ids;
}

export type SkillsCoverage = {
  /** Catalogue cases no skill names. */
  uncoveredCases: string[];
  /** Cases a skill names that are not in the catalogue. */
  unknownCases: { skill: string; id: string }[];
  /** Help screens no skill is practised on. */
  uncoveredScreens: string[];
  coveredCaseCount: number;
};

export function skillsCoverage(
  skills: readonly Skill[],
  caseIds: readonly string[],
  helpScreens: readonly string[],
): SkillsCoverage {
  const known = new Set(caseIds);
  const named = new Set<string>();
  const unknownCases: { skill: string; id: string }[] = [];
  for (const s of skills) {
    for (const id of s.cases) {
      named.add(id);
      if (!known.has(id)) unknownCases.push({ skill: s.key, id });
    }
  }
  const screens = new Set<string>(skills.flatMap((s) => [...s.screens]));
  return {
    uncoveredCases: caseIds.filter((id) => !named.has(id)),
    unknownCases,
    uncoveredScreens: helpScreens.filter((k) => !screens.has(k)),
    coveredCaseCount: caseIds.filter((id) => named.has(id)).length,
  };
}
