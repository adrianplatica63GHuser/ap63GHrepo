/**
 * @jest-environment node
 */

/**
 * Follow-up register guard  (Slice #36.10)
 *
 * `docs/claude/FOLLOW-UP-REGISTER.md` is filed by every slice's final commit,
 * by hand, in a Markdown table. The two things a hand-kept table loses first are
 * the summary block at its top — which nobody recounts — and the discipline of
 * the statuses: a `resolved` written without the commit that did it is a claim
 * the next session has to re-investigate, which is the waste the register exists
 * to stop. So both are checked here rather than asked for.
 *
 * What it checks:
 *   1. Every row has the eleven columns the header defines.
 *   2. IDs run FU-001, FU-002, … with no repeat and no gap — an ID is never
 *      reused and a row is never deleted, so a gap means one was.
 *   3. Status, kind, impact and size are each one of the header's values, and
 *      Last checked is a date.
 *   4. A `resolved` row's status note names a commit; a `duplicate` row's names
 *      another row that exists.
 *   5. The summary block's status × impact counts equal the table's.
 *
 * ⚠️ It does NOT check that a named commit exists, or that an `open` row is
 * still true. CI checks out one commit, so `git cat-file` could not answer the
 * first; and the second is a judgement about the code, which is what the
 * register's `Last checked` column records a person making. A green run here
 * says the table is well-formed and its summary honest — nothing about the app.
 */

import { readFileSync } from "fs";
import { join } from "path";

const REGISTER = join(process.cwd(), "docs", "claude", "FOLLOW-UP-REGISTER.md");

const STATUSES = ["open", "planned", "resolved", "ignored", "duplicate", "superseded"] as const;
const IMPACTS = ["data", "user", "dev", "cosmetic"] as const;
const KINDS = [
  "defect",
  "data risk",
  "test gap",
  "debt",
  "copy/i18n",
  "tooling",
  "recommendation",
  "next-slice idea",
] as const;
const SIZES = ["XS", "S", "M", "L"] as const;

type Row = {
  id: string;
  kind: string;
  impact: string;
  size: string;
  status: string;
  note: string;
  lastChecked: string;
  cells: string[];
};

/** Split a Markdown table line on its unescaped pipes, dropping the outer empties. */
function cellsOf(line: string): string[] {
  const parts = line.split(/(?<!\\)\|/).map((c) => c.trim());
  return parts.slice(1, parts.length - 1);
}

const text = readFileSync(REGISTER, "utf8");

const rows: Row[] = text
  .split("\n")
  .filter((l) => /^\|\s*FU-\d{3}\s*\|/.test(l))
  .map((line) => {
    const cells = cellsOf(line);
    return {
      id: cells[0],
      kind: cells[2],
      impact: cells[6],
      size: cells[7],
      status: cells[8],
      note: cells[9] ?? "",
      lastChecked: cells[10] ?? "",
      cells,
    };
  });

describe("follow-up register", () => {
  it("has rows", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it.each(rows.map((r) => [r.id, r] as const))("%s has the eleven columns", (_id, r) => {
    expect(r.cells).toHaveLength(11);
  });

  it("numbers its rows FU-001 onwards with no repeat and no gap", () => {
    const expected = rows.map((_, i) => `FU-${String(i + 1).padStart(3, "0")}`);
    expect(rows.map((r) => r.id)).toEqual(expected);
  });

  it.each(rows.map((r) => [r.id, r] as const))("%s uses the header's vocabulary", (_id, r) => {
    expect(STATUSES).toContain(r.status);
    expect(IMPACTS).toContain(r.impact);
    expect(KINDS).toContain(r.kind);
    expect(SIZES).toContain(r.size);
    expect(r.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(rows.filter((r) => r.status === "resolved").map((r) => [r.id, r] as const))(
    "%s is resolved and names the commit that did it",
    (_id, r) => {
      expect(r.note).toMatch(/(?<![0-9a-z])[0-9a-f]{7,40}(?![0-9a-z])/);
    },
  );

  it.each(rows.filter((r) => r.status === "duplicate").map((r) => [r.id, r] as const))(
    "%s is a duplicate of a row that exists",
    (id, r) => {
      const target = r.note.match(/FU-\d{3}/)?.[0];
      expect(target).toBeDefined();
      expect(target).not.toBe(id);
      expect(rows.map((x) => x.id)).toContain(target);
    },
  );

  it("keeps its summary block equal to the table", () => {
    const block = text.match(/<!-- summary:begin -->([\s\S]*?)<!-- summary:end -->/);
    expect(block).not.toBeNull();

    const stated = new Map<string, number[]>();
    for (const line of block![1].split("\n")) {
      const cells = cellsOf(line);
      if (cells.length !== 6) continue;
      const label = cells[0].replace(/\*/g, "");
      if (!(STATUSES as readonly string[]).includes(label) && label !== "total") continue;
      stated.set(label, cells.slice(1).map(Number));
    }

    const counted = (status: string | null) => {
      const byImpact = IMPACTS.map(
        (i) => rows.filter((r) => r.impact === i && (status === null || r.status === status)).length,
      );
      return [...byImpact, byImpact.reduce((a, b) => a + b, 0)];
    };

    for (const s of STATUSES) expect([s, stated.get(s)]).toEqual([s, counted(s)]);
    expect(["total", stated.get("total")]).toEqual(["total", counted(null)]);
  });
});
