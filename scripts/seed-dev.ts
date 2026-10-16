/**
 * `npm run seed:dev` / `npm run seed:dev:remove` — both dev seeds, in order, as one command.   (Slice #39.58)
 *
 *   npm run seed:dev                                  the big seed, then the interactions seed
 *   npm run seed:dev -- --seed-big 7 --seed-interactions 9   repeat earlier runs' random choices
 *   npm run seed:dev:remove                           both removed, the interactions first
 *
 * What runs, in which order, and with which options is scripts/seed-dev-plan.ts. Each seed runs as its own process,
 * with this one's environment (its DATABASE_URL, from --env-file=.env), exactly as when it is run by hand — and keeps
 * its own manifest and its own safety checks. The first one that fails stops the command with its exit code.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { planSeedDev, seedDevExit } from "./seed-dev-plan";

const plan = planSeedDev(process.argv.slice(2));
if (!plan.ok) {
  console.error(plan.error);
  process.exit(2);
}
const exits: (number | null)[] = [];
for (const step of plan.steps) {
  console.log(`\n${step.mark}`);
  const r = spawnSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), step.script, ...step.args], {
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  });
  exits.push(r.error ? 1 : r.status);
  if (r.error) console.error(`seed:dev: could not start ${step.script}: ${r.error.message}`);
  if (exits[exits.length - 1] !== 0) break;
}
const exit = seedDevExit(exits);
console.log(`\nseed:dev${plan.remove ? ":remove" : ""}: ${exit === 0 ? "done" : `stopped — exit ${exit}`} (${exits.length} of ${plan.steps.length} step${plan.steps.length === 1 ? "" : "s"} run)`);
process.exitCode = exit;
