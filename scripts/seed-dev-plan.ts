/**
 * `npm run seed:dev` and `npm run seed:dev:remove` — the two dev seeds as one command.     (Slice #39.58)
 *
 * Adrian: „Can we consolidate the different seed data scripts like the big seed … and then the interactions seed”.
 * The big seed (scripts/seed-dev-data-big, #39.20–#39.23) writes the persons, companies, properties and documents; the
 * interactions seed (#39.29) writes „Interacțiuni” for the big seed's persons and refuses without its manifest. So:
 *
 *   seed:dev          the big seed, then — only if it succeeded — the interactions seed
 *   seed:dev:remove   the interactions seed's --remove, then the big seed's
 *
 * Each keeps its own manifest and its own --seed: `--seed-big <n>` and `--seed-interactions <n>` are passed on as
 * that seed's `--seed`. A second seed:dev is refused by the big seed itself, which still has its manifest, and nothing
 * after it runs. The per-seed commands stay as they are (their headers); this only runs them in order.
 *
 * PURE — scripts/seed-dev.ts runs the plan; src/__tests__/seed-dev.test.ts pins it; the runner's seed-rehearsal runs
 * the command and reads each seed's part of its output by these markers.
 */

export const BIG_SEED_SCRIPT = "scripts/seed-dev-data-big/seed.ts";
export const INTERACTIONS_SEED_SCRIPT = "scripts/seed-dev-data-interactions/seed.ts";

/** One line before each seed's own output, so a reader — or the rehearsal's verdict — can tell the two apart. */
export const SEED_DEV_MARK = {
  big: "== seed:dev — the big seed (scripts/seed-dev-data-big) ==",
  interactions: "== seed:dev — the interactions seed (scripts/seed-dev-data-interactions) ==",
} as const;

export type SeedDevStep = { mark: string; script: string; args: string[] };

export type SeedDevPlan = { ok: true; remove: boolean; steps: SeedDevStep[] } | { ok: false; error: string };

/** The steps for this command line (`process.argv.slice(2)`). */
export function planSeedDev(argv: readonly string[]): SeedDevPlan {
  const remove = argv.includes("--remove");
  const known = new Set(["--remove", "--seed-big", "--seed-interactions"]);
  const seeds: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!known.has(a)) return { ok: false, error: `Unknown option „${a}”. Use --remove, --seed-big <n>, --seed-interactions <n>.` };
    if (a === "--seed-big" || a === "--seed-interactions") {
      const v = argv[i + 1];
      if (v === undefined || !/^\d+$/.test(v)) return { ok: false, error: `${a} takes a whole number, not „${v ?? ""}”.` };
      seeds[a] = v;
      i++;
    }
  }
  if (remove && (seeds["--seed-big"] || seeds["--seed-interactions"])) return { ok: false, error: "--remove takes no seed: it removes what each manifest lists." };
  const big: SeedDevStep = { mark: SEED_DEV_MARK.big, script: BIG_SEED_SCRIPT, args: seeds["--seed-big"] ? ["--seed", seeds["--seed-big"]] : [] };
  const interactions: SeedDevStep = {
    mark: SEED_DEV_MARK.interactions,
    script: INTERACTIONS_SEED_SCRIPT,
    args: seeds["--seed-interactions"] ? ["--seed", seeds["--seed-interactions"]] : [],
  };
  if (!remove) return { ok: true, remove, steps: [big, interactions] };
  return { ok: true, remove, steps: [{ ...interactions, args: ["--remove"] }, { ...big, args: ["--remove"] }] };
}

/** The command's exit: the first step that failed stops the run, and its code is the command's. */
export function seedDevExit(exits: readonly (number | null)[]): number {
  for (const e of exits) if (e !== 0) return e ?? 1;
  return 0;
}

/** Each seed's part of the command's output, by the markers; "" for a seed that did not run. */
export function splitSeedDevOutput(text: string): { big: string; interactions: string } {
  const b = text.indexOf(SEED_DEV_MARK.big);
  const i = text.indexOf(SEED_DEV_MARK.interactions);
  const big = b < 0 ? "" : text.slice(b + SEED_DEV_MARK.big.length, i > b ? i : undefined);
  const interactions = i < 0 ? "" : text.slice(i + SEED_DEV_MARK.interactions.length);
  return { big, interactions };
}
