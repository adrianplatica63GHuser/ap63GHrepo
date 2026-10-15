/**
 * THE SKILLS GRAPH'S RULES — Adrian's, every one of them, each a named issue.                (Slice #39.36)
 *
 * From the request (Diagram.of.skills.docx, 2026-10-14) and the slice header:
 *   - an arrow A → B means A must be mastered before B can be approached;
 *   - an arrow always goes UP at least one level (`arrow-not-upward`), and never from Basic straight to Expert
 *     (`basic-to-expert`) — Basic → Advanced and Intermediate → Expert are allowed: „only one intermediate step”;
 *   - every non-Basic skill has at least one predecessor (`no-predecessor`) and traces back to at least one Basic
 *     skill (`no-basic-root`);
 *   - a higher-level skill TYPICALLY has two or three predecessors: one alone is the picture's first shape error,
 *     „some Intermediate skills may need more than one Basic skill” (`single-predecessor`, an error); more than
 *     three is allowed but flagged (`too-many-predecessors`, a warning);
 *   - a skill may feed several — and a Basic skill feeding only one is the picture's second shape error, „some Basic
 *     skills may be needed by more than one Intermediate skill” (`basic-feeds-too-few`, an error);
 *   - no cycles (`cycle`);
 *   - every skill belongs to exactly one Path (`unknown-path` — one field, so never two), and every Path has at
 *     least one Advanced or Expert skill (`path-without-mastery`), since a Path is mastered when all of those are.
 *
 * And the bookkeeping a box needs to be drawn and a progress row to be stored against it: keys unique and
 * kebab-case (`duplicate-key`, `bad-key`), numbers unique and of the form „<level>.<n>” (`duplicate-number`,
 * `bad-number`), predecessors that exist and are named once (`unknown-predecessor`, `duplicate-predecessor`), no
 * empty Path (`empty-path`), names and descriptions in both locales when given (`missing-text`), and an
 * Intermediate skill that leads nowhere (`dead-end`, a warning — it can never count towards a Path's mastery).
 *
 * The picture's STATE errors (2.4 open with a predecessor not mastered, …) are not shape and belong to 39.41.
 *
 * Generic over plain strings, so the tests build small graphs by hand; the real catalogue passes it in
 * `skills-catalogue.test.ts`. PURE.
 */

export type SkillGraphNode = {
  key: string;
  number: string;
  level: number;
  path: string;
  predecessors: readonly string[];
  name?: { ro: string; en: string };
  description?: { ro: string; en: string };
};

export type SkillGraph = { paths: readonly { key: string }[]; skills: readonly SkillGraphNode[] };

export type SkillGraphIssueCode =
  | "duplicate-key"
  | "bad-key"
  | "duplicate-number"
  | "bad-number"
  | "bad-level"
  | "unknown-path"
  | "empty-path"
  | "path-without-mastery"
  | "unknown-predecessor"
  | "duplicate-predecessor"
  | "arrow-not-upward"
  | "basic-to-expert"
  | "no-predecessor"
  | "single-predecessor"
  | "too-many-predecessors"
  | "basic-feeds-too-few"
  | "dead-end"
  | "no-basic-root"
  | "cycle"
  | "missing-text";

export type SkillGraphIssue = {
  code: SkillGraphIssueCode;
  severity: "error" | "warning";
  /** The skills (or, for a Path rule, the Path) involved, by key. */
  keys: string[];
  message: string;
};

export const BASIC = 1;
export const EXPERT = 4;
/** „Typically two or three” — the most a skill carries before a warning. */
export const MAX_PREDECESSORS = 3;
/** A Basic skill must feed at least this many (the picture's 1.4 and 1.6 feed one each). */
export const MIN_BASIC_SUCCESSORS = 2;

const KEY_SHAPE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function validateSkillGraph(graph: SkillGraph): SkillGraphIssue[] {
  const issues: SkillGraphIssue[] = [];
  const add = (code: SkillGraphIssueCode, severity: "error" | "warning", keys: string[], message: string) =>
    issues.push({ code, severity, keys, message });

  const byKey = new Map<string, SkillGraphNode>();
  for (const s of graph.skills) {
    if (byKey.has(s.key)) add("duplicate-key", "error", [s.key], `Two skills share the key „${s.key}”.`);
    else byKey.set(s.key, s);
    if (!KEY_SHAPE.test(s.key)) add("bad-key", "error", [s.key], `„${s.key}” is not a kebab-case key.`);
  }

  const byNumber = new Map<string, string>();
  for (const s of graph.skills) {
    const other = byNumber.get(s.number);
    if (other !== undefined) add("duplicate-number", "error", [other, s.key], `Two skills are numbered ${s.number}.`);
    else byNumber.set(s.number, s.key);
    if (!Number.isInteger(s.level) || s.level < BASIC || s.level > EXPERT) {
      add("bad-level", "error", [s.key], `${s.key}: level ${s.level} is not 1–4.`);
    }
    const m = /^(\d+)\.(\d+)$/.exec(s.number);
    if (!m || Number(m[1]) !== s.level || Number(m[2]) < 1) {
      add("bad-number", "error", [s.key], `${s.key}: „${s.number}” is not „${s.level}.<n>”.`);
    }
  }

  // ── Paths ───────────────────────────────────────────────────────────────────────────────────────────────────
  const pathKeys = new Set(graph.paths.map((p) => p.key));
  for (const s of graph.skills) {
    if (!pathKeys.has(s.path)) add("unknown-path", "error", [s.key], `${s.key}: no Path „${s.path}”.`);
  }
  for (const p of graph.paths) {
    const members = graph.skills.filter((s) => s.path === p.key);
    if (members.length === 0) {
      add("empty-path", "error", [p.key], `Path „${p.key}” holds no skill.`);
    } else if (!members.some((s) => s.level >= 3)) {
      add(
        "path-without-mastery",
        "error",
        [p.key],
        `Path „${p.key}” has no Advanced or Expert skill, so it could never be mastered.`,
      );
    }
  }

  // ── Arrows ──────────────────────────────────────────────────────────────────────────────────────────────────
  const successors = new Map<string, string[]>();
  for (const s of graph.skills) successors.set(s.key, []);
  for (const s of graph.skills) {
    const seen = new Set<string>();
    for (const p of s.predecessors) {
      if (seen.has(p)) {
        add("duplicate-predecessor", "error", [s.key, p], `${s.key} names ${p} twice.`);
        continue;
      }
      seen.add(p);
      const pred = byKey.get(p);
      if (!pred) {
        add("unknown-predecessor", "error", [s.key, p], `${s.key}: no skill „${p}”.`);
        continue;
      }
      successors.get(p)?.push(s.key);
      if (pred.level >= s.level) {
        add(
          "arrow-not-upward",
          "error",
          [p, s.key],
          `${pred.number} → ${s.number}: an arrow must go up at least one level.`,
        );
      } else if (pred.level === BASIC && s.level === EXPERT) {
        add(
          "basic-to-expert",
          "error",
          [p, s.key],
          `${pred.number} → ${s.number}: never from Basic straight to Expert — only one intermediate step.`,
        );
      }
    }
    if (s.level > BASIC) {
      const known = [...seen].filter((p) => byKey.has(p)).length;
      if (known === 0) {
        add("no-predecessor", "error", [s.key], `${s.number} is above Basic and has no predecessor.`);
      } else if (known === 1) {
        add(
          "single-predecessor",
          "error",
          [s.key],
          `${s.number} has a single predecessor; a higher-level skill needs two or three.`,
        );
      } else if (known > MAX_PREDECESSORS) {
        add(
          "too-many-predecessors",
          "warning",
          [s.key],
          `${s.number} has ${known} predecessors; typically two or three.`,
        );
      }
    }
  }

  for (const s of graph.skills) {
    const out = successors.get(s.key) ?? [];
    if (s.level === BASIC && out.length < MIN_BASIC_SUCCESSORS) {
      add(
        "basic-feeds-too-few",
        "error",
        [s.key],
        `${s.number} feeds ${out.length}; a Basic skill must open at least ${MIN_BASIC_SUCCESSORS}.`,
      );
    } else if (s.level === 2 && out.length === 0) {
      add("dead-end", "warning", [s.key], `${s.number} leads nowhere, so it never counts towards a Path's mastery.`);
    }
  }

  // ── Cycles and roots ────────────────────────────────────────────────────────────────────────────────────────
  for (const cycle of findCycles(graph.skills, byKey)) {
    add("cycle", "error", cycle, `A cycle: ${cycle.join(" → ")}.`);
  }
  const rooted = new Map<string, boolean>();
  const tracesToBasic = (key: string, path: Set<string>): boolean => {
    const known = rooted.get(key);
    if (known !== undefined) return known;
    const s = byKey.get(key);
    if (!s || path.has(key)) return false;
    if (s.level === BASIC) {
      rooted.set(key, true);
      return true;
    }
    path.add(key);
    const ok = s.predecessors.some((p) => tracesToBasic(p, path));
    path.delete(key);
    rooted.set(key, ok);
    return ok;
  };
  for (const s of graph.skills) {
    if (s.level > BASIC && !tracesToBasic(s.key, new Set())) {
      add("no-basic-root", "error", [s.key], `${s.number} does not trace back to any Basic skill.`);
    }
  }

  // ── Text ────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const s of graph.skills) {
    for (const [field, text] of [["name", s.name], ["description", s.description]] as const) {
      if (text === undefined) continue;
      for (const locale of ["ro", "en"] as const) {
        if (!text[locale]?.trim()) add("missing-text", "error", [s.key], `${s.key}: no ${field} in ${locale}.`);
      }
    }
  }

  return issues;
}

/** The errors only — what must be empty for the catalogue to ship. */
export function skillGraphErrors(graph: SkillGraph): SkillGraphIssue[] {
  return validateSkillGraph(graph).filter((i) => i.severity === "error");
}

/** Each elementary cycle found by a depth-first walk along the arrows, reported once, starting at its lowest key. */
function findCycles(skills: readonly SkillGraphNode[], byKey: Map<string, SkillGraphNode>): string[][] {
  const state = new Map<string, "open" | "done">();
  const stack: string[] = [];
  const found = new Map<string, string[]>();
  const visit = (key: string) => {
    state.set(key, "open");
    stack.push(key);
    for (const p of byKey.get(key)?.predecessors ?? []) {
      if (!byKey.has(p)) continue;
      const st = state.get(p);
      if (st === "open") {
        // Walking predecessors, so the stack runs against the arrows; reverse it to read along them.
        const loop = stack.slice(stack.indexOf(p)).reverse();
        const start = loop.indexOf([...loop].sort()[0]);
        const canon = [...loop.slice(start), ...loop.slice(0, start)];
        found.set(canon.join("|"), [...canon, canon[0]]);
      } else if (st === undefined) {
        visit(p);
      }
    }
    stack.pop();
    state.set(key, "done");
  };
  for (const s of skills) if (!state.has(s.key)) visit(s.key);
  return [...found.values()];
}
