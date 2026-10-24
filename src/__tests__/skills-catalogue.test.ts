/**
 * @jest-environment node
 *
 * The real skills catalogue keeps every graph rule, and covers what the application does.  (Slice #39.36)
 *
 *   1. `validate-graph.ts` finds nothing in it — no error and no warning.
 *   2. Fewer skills at each level up; numbers run 1..n within each level, in the order the file lists them.
 *   3. Every case a skill names is a row of docs/testing/TEST-CATALOGUE.md; every row is named by a skill, or is in
 *      SKILLS_UNCOVERED_CASES with its reason (and only then).
 *   4. Every help-registry screen is practised on by at least one skill.
 *   5. THE KEYS ARE STABLE: every key below still exists. A user's progress (39.41) is stored against a key, so a
 *      key is never renamed or removed — a skill is renumbered instead. Adding a skill adds its key here.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { HELP_SCREENS } from "@/lib/help/registry";
import {
  SKILL_LEVELS,
  SKILL_PATHS,
  SKILLS,
  SKILLS_UNCOVERED_CASES,
  successorsOf,
} from "@/lib/skills/catalogue";
import { catalogueCaseIds, skillsCoverage } from "@/lib/skills/coverage";
import { validateSkillGraph } from "@/lib/skills/validate-graph";

const CATALOGUE = readFileSync(join(process.cwd(), "docs", "testing", "TEST-CATALOGUE.md"), "utf8");
const CASE_IDS = catalogueCaseIds(CATALOGUE);

const STABLE_KEYS = [
  "workspace-sign-in-and-navigate",
  "workspace-find-in-a-list",
  "workspace-read-a-record-screen",
  "workspace-read-help",
  "persons-add-natural-person-by-hand",
  "persons-add-judicial-person",
  "properties-add-property-by-hand",
  "properties-read-the-map",
  "documents-create-document",
  "documents-read-pages",
  "documents-choose-document-type",
  "links-associate-two-records",
  "links-read-related-tile",
  "links-read-version-history",
  "import-prepare-folder",
  "workspace-global-search",
  "workspace-log-an-interaction",
  "persons-person-from-id-card",
  "persons-keep-identity-current",
  "persons-link-relatives",
  "properties-draw-corners",
  "properties-from-coordinate-file",
  "documents-fill-identification",
  "documents-add-parties",
  "links-link-records-both-ways",
  "links-references-and-parts",
  "links-restore-a-version",
  "links-classify-and-tag",
  "import-run-an-import",
  "workspace-arrange-tiles",
  "workspace-read-interaction-history",
  "links-groups-and-stamps",
  "workspace-sort-a-list",
  "persons-id-card-from-the-archive",
  "persons-read-inheritance-tree",
  "properties-measure-on-the-map",
  "properties-side-road-calculation",
  "documents-sale-contract",
  "documents-addendum-and-certificate",
  "links-follow-a-chain",
  "links-work-in-two-windows",
  "import-big-and-special-folders",
  "import-check-the-ai-reading",
  "workspace-reference-data",
  "workspace-settings-and-users",
  "workspace-write-help",
  "workspace-interactions-links-and-export",
  "persons-reconstruct-an-inheritance",
  "properties-parcel-dossier",
  "documents-chain-of-title",
  "links-audit-the-history",
  "import-teach-a-new-document-type",
  "workspace-keep-the-archive-in-order",
];

describe("the skills catalogue", () => {
  it("keeps every graph rule — no error and no warning", () => {
    const issues = validateSkillGraph({ paths: SKILL_PATHS, skills: SKILLS });
    expect(issues.map((i) => `${i.code}: ${i.message}`)).toEqual([]);
  });

  it("has fewer skills at each level up, and a handful of Experts", () => {
    const counts = SKILL_LEVELS.map((lv) => SKILLS.filter((s) => s.level === lv.level).length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[3]).toBeGreaterThanOrEqual(1);
  });

  it("numbers each level 1..n in the order the file lists it", () => {
    for (const lv of SKILL_LEVELS) {
      const numbers = SKILLS.filter((s) => s.level === lv.level).map((s) => s.number);
      expect(numbers).toEqual(numbers.map((_, i) => `${lv.level}.${i + 1}`));
    }
  });

  it("lists the levels in order: every Basic skill before every Intermediate one, and so on", () => {
    const levels = SKILLS.map((s) => s.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("keeps every key it has ever had — a key is never renamed or removed", () => {
    const keys = new Set(SKILLS.map((s) => s.key));
    expect(STABLE_KEYS.filter((k) => !keys.has(k))).toEqual([]);
    // …and a new skill's key is added to STABLE_KEYS in the same commit.
    expect([...keys].filter((k) => !STABLE_KEYS.includes(k))).toEqual([]);
  });

  it("gives every Path a mastery set — its Advanced and Expert skills", () => {
    for (const p of SKILL_PATHS) {
      expect(SKILLS.filter((s) => s.path === p.key && s.level >= 3).length).toBeGreaterThan(0);
    }
  });

  it("gives every skill a description in both locales, and a key that starts with its Path", () => {
    for (const s of SKILLS) {
      expect(s.description.ro.trim()).not.toBe("");
      expect(s.description.en.trim()).not.toBe("");
      expect(s.key.startsWith(`${s.path}-`)).toBe(true);
    }
  });

  it("spells Romanian with comma-below ș and ț, never the cedilla look-alikes (romanian-diacritics.test.ts)", () => {
    const romanian = [...SKILLS.flatMap((s) => [s.name.ro, s.description.ro]), ...SKILL_PATHS.flatMap((p) => [p.name.ro, p.description.ro])];
    expect(romanian.filter((t) => /[\u015E\u015F\u0162\u0163]/.test(t))).toEqual([]);
  });

  it("is a graph every non-Expert skill takes somewhere, but an Advanced one may end a Path", () => {
    for (const s of SKILLS.filter((x) => x.level <= 2)) {
      expect({ skill: s.number, opens: successorsOf(s.key).length > 0 }).toEqual({ skill: s.number, opens: true });
    }
  });
});

describe("what the skills cover", () => {
  const coverage = skillsCoverage(
    SKILLS,
    CASE_IDS,
    HELP_SCREENS.map((s) => s.key),
  );

  it("reads the test catalogue's rows", () => {
    expect(CASE_IDS.length).toBeGreaterThan(100);
    expect(CASE_IDS).toContain("TC-PERS-01");
  });

  it("names only cases that are rows of the test catalogue", () => {
    expect(coverage.unknownCases).toEqual([]);
  });

  it("draws on every case, except the ones listed with their reason", () => {
    expect(coverage.uncoveredCases.sort()).toEqual(Object.keys(SKILLS_UNCOVERED_CASES).sort());
  });

  it("lists as uncovered only real rows, each with a reason", () => {
    for (const [id, reason] of Object.entries(SKILLS_UNCOVERED_CASES)) {
      expect(CASE_IDS).toContain(id);
      expect(reason.trim().length).toBeGreaterThan(20);
    }
  });

  it("practises on every help screen", () => {
    expect(coverage.uncoveredScreens).toEqual([]);
  });
});
