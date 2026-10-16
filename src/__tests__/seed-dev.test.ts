/**
 * `npm run seed:dev` and `seed:dev:remove` — the two dev seeds as one command (Slice #39.58).
 */
import fs from "node:fs";
import path from "node:path";
import {
  BIG_SEED_SCRIPT,
  INTERACTIONS_SEED_SCRIPT,
  SEED_DEV_MARK,
  planSeedDev,
  seedDevExit,
  splitSeedDevOutput,
} from "../../scripts/seed-dev-plan";

const PKG = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };

describe("the plan", () => {
  it("seed:dev — the big seed, then the interactions seed, each with no option of its own", () => {
    const p = planSeedDev([]);
    expect(p).toEqual({
      ok: true,
      remove: false,
      steps: [
        { mark: SEED_DEV_MARK.big, script: BIG_SEED_SCRIPT, args: [] },
        { mark: SEED_DEV_MARK.interactions, script: INTERACTIONS_SEED_SCRIPT, args: [] },
      ],
    });
  });

  it("each seed keeps its own --seed", () => {
    const p = planSeedDev(["--seed-interactions", "9", "--seed-big", "7"]);
    expect(p.ok && p.steps.map((s) => s.args)).toEqual([["--seed", "7"], ["--seed", "9"]]);
  });

  it("seed:dev:remove — the interactions first, then the big seed", () => {
    const p = planSeedDev(["--remove"]);
    expect(p.ok && p.steps.map((s) => [s.script, s.args])).toEqual([
      [INTERACTIONS_SEED_SCRIPT, ["--remove"]],
      [BIG_SEED_SCRIPT, ["--remove"]],
    ]);
  });

  it("refuses what it does not know, and a seed number that is not a whole number", () => {
    expect(planSeedDev(["--seed", "3"]).ok).toBe(false);
    expect(planSeedDev(["--seed-big"]).ok).toBe(false);
    expect(planSeedDev(["--seed-big", "x"]).ok).toBe(false);
    expect(planSeedDev(["--remove", "--seed-big", "3"]).ok).toBe(false);
  });

  it("the scripts it names exist", () => {
    for (const s of [BIG_SEED_SCRIPT, INTERACTIONS_SEED_SCRIPT]) expect(fs.existsSync(path.join(process.cwd(), s))).toBe(true);
  });
});

describe("the exit — the first failure stops the command", () => {
  it.each([
    [[0, 0], 0],
    [[1], 1],
    [[0, 3], 3],
    [[null], 1],
  ] as [(number | null)[], number][])("%j → %i", (exits, code) => {
    expect(seedDevExit(exits)).toBe(code);
  });
});

describe("each seed's part of the output", () => {
  it("splits by the markers", () => {
    const text = `x\n${SEED_DEV_MARK.big}\nbig says\n${SEED_DEV_MARK.interactions}\ninteractions say\n`;
    expect(splitSeedDevOutput(text)).toEqual({ big: "\nbig says\n", interactions: "\ninteractions say\n" });
  });
  it("a seed that did not run has no part", () => {
    expect(splitSeedDevOutput(`${SEED_DEV_MARK.big}\nrefused`)).toEqual({ big: "\nrefused", interactions: "" });
  });
});

describe("npm run seed:dev / seed:dev:remove", () => {
  it("run scripts/seed-dev.ts with the .env, the second with --remove", () => {
    expect(PKG.scripts["seed:dev"]).toBe("node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/seed-dev.ts");
    expect(PKG.scripts["seed:dev:remove"]).toBe("node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/seed-dev.ts --remove");
  });
});
