/**
 * Writes the skills inventory's review copy from the catalogue.                             (Slice #39.36)
 *
 *   npm run skills:render -- --out "C:\dev.docs\01.Slice.Inputs\Slices.01--39\Slices.39.36-39.45\39.36.Skills.Inventory"
 *
 * Into `--out`: Skills.Inventory.docx (English, the Romanian names beside, one table per level, each skill's
 * predecessors and successors) and Skills.Graph.svg (a plain drawing in four columns, straight arrows) — both from
 * src/lib/skills/catalogue.ts, never typed twice. It refuses to write when the catalogue breaks a graph rule, so a
 * review copy always shows a graph that passes. Reads docs/testing/TEST-CATALOGUE.md for the coverage section; no
 * database, no network.
 */

import fs from "node:fs";
import path from "node:path";
import { SKILL_PATHS, SKILLS, SKILLS_UNCOVERED_CASES } from "@/lib/skills/catalogue";
import { catalogueCaseIds, skillsCoverage } from "@/lib/skills/coverage";
import { renderInventoryDocx } from "@/lib/skills/render-docx";
import { renderSkillsSvg } from "@/lib/skills/render-svg";
import { skillGraphErrors } from "@/lib/skills/validate-graph";
import { HELP_SCREENS } from "@/lib/help/registry";

function main(): number {
  const at = process.argv.indexOf("--out");
  const out = at >= 0 ? process.argv[at + 1] : undefined;
  if (!out) {
    console.error("Usage: render-inventory --out <folder>");
    return 2;
  }
  const errors = skillGraphErrors({ paths: SKILL_PATHS, skills: SKILLS });
  if (errors.length) {
    for (const e of errors) console.error(`${e.code}: ${e.message}`);
    console.error(`The catalogue breaks ${errors.length} graph rule(s); nothing written.`);
    return 1;
  }
  const root = process.cwd(); // npm runs scripts from the repo root
  const caseIds = catalogueCaseIds(fs.readFileSync(path.join(root, "docs", "testing", "TEST-CATALOGUE.md"), "utf8"));
  const coverage = skillsCoverage(
    SKILLS,
    caseIds,
    HELP_SCREENS.map((s) => s.key),
  );
  const docx = renderInventoryDocx({
    skills: SKILLS,
    paths: SKILL_PATHS,
    uncoveredCases: coverage.uncoveredCases.map((id) => ({
      id,
      reason: SKILLS_UNCOVERED_CASES[id] ?? "Not yet decided — skills-catalogue.test.ts fails until it is.",
    })),
    uncoveredScreens: coverage.uncoveredScreens,
    caseCount: { total: caseIds.length, covered: coverage.coveredCaseCount },
  });
  const svg = renderSkillsSvg({ skills: SKILLS, paths: SKILL_PATHS });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "Skills.Inventory.docx"), docx);
  fs.writeFileSync(path.join(out, "Skills.Graph.svg"), svg, "utf8");
  console.log(
    `Wrote Skills.Inventory.docx and Skills.Graph.svg to ${out}: ${SKILLS.length} skills, ${SKILL_PATHS.length} Paths, ${coverage.coveredCaseCount}/${caseIds.length} cases covered.`,
  );
  return 0;
}

process.exit(main());
