/**
 * „Setări" in sections: the thresholds grouped with a worked example, the
 * backups read-only, the AI models, „Despre".                     (Slice #38.40)
 */

import fs from "fs";
import os from "os";
import path from "path";
import { TIME_FRAME_KEYS, parseTimeFrameDraft } from "@/lib/time-frames/config";
import { TIME_FRAME_GROUPS, exampleValue, groupingProblems } from "@/lib/time-frames/groups";
import { databaseOf, environmentName, readBackupStatus } from "@/lib/settings/system-status";
import { aiModelsInUse, CLASSIFY_MODEL, EXTRACT_MODEL, ID_CARD_MODEL_DEFAULT } from "@/lib/ai/models";
import { monthStart } from "@/lib/ai/paid-read-month";

const ROOT = path.join(__dirname, "..", "..");
/** A hand-made environment: ProcessEnv insists on NODE_ENV, which these readers never read. */
const env = (o: Record<string, string>): NodeJS.ProcessEnv => o as unknown as NodeJS.ProcessEnv;
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const ro = JSON.parse(read("messages/ro-RO.json")).settings;
const en = JSON.parse(read("messages/en-GB.json")).settings;

/**
 * The ICU these messages use — `{x}` and one `plural` with `one`/`few`/`other`
 * — formatted the way next-intl does, by `Intl.PluralRules`. (intl-messageformat
 * is ESM-only and next/jest does not transform node_modules; see
 * import-structure-rules.test.ts for the long version.)
 */
function say(locale: string, template: string, values: Record<string, unknown>): string {
  const plural = /^\{(\w+), plural, (.*)\}$/.exec(template);
  if (plural) {
    const n = Number(values[plural[1]]);
    const arms = new Map([...plural[2].matchAll(/(=\d+|\w+) \{([^{}]*)\}/g)].map((m) => [m[1], m[2]]));
    const arm = arms.get(`=${n}`) ?? arms.get(new Intl.PluralRules(locale).select(n)) ?? arms.get("other") ?? "";
    return arm.replace(/#/g, String(n));
  }
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => String(values[k]));
}
/** The example the screen prints for one key at one value, in Romanian. */
function exampleRo(key: string, unit: string, count: number): string {
  const duration = say("ro-RO", ro.timeFrames.duration[unit], { count });
  return say("ro-RO", ro.timeFrames.examples[key], { duration });
}

describe("the four groups", () => {
  it("are Tablou de bord, Acte, Persoane and the „Nou!” badge, in that order", () => {
    expect(TIME_FRAME_GROUPS.map((g) => g.id)).toEqual(["dashboard", "documents", "persons", "recency"]);
    expect(ro.timeFrames.groups).toEqual({
      dashboard: "Tablou de bord", documents: "Acte", persons: "Persoane", recency: "Insigna „Nou!”",
    });
  });

  it("hold every threshold exactly once", () => {
    expect(groupingProblems()).toEqual({ missing: [], twice: [] });
  });
});

describe("the worked example", () => {
  it("has a sentence for every threshold, in both languages", () => {
    expect(Object.keys(ro.timeFrames.examples).sort()).toEqual([...TIME_FRAME_KEYS].sort());
    expect(Object.keys(en.timeFrames.examples).sort()).toEqual([...TIME_FRAME_KEYS].sort());
  });

  it.each([
    [30, "Un act apare «expiră curând» cu 30 de zile înainte."],
    [1, "Un act apare «expiră curând» cu o zi înainte."],
    [7, "Un act apare «expiră curând» cu 7 zile înainte."],
    [19, "Un act apare «expiră curând» cu 19 zile înainte."],
    [20, "Un act apare «expiră curând» cu 20 de zile înainte."],
    [101, "Un act apare «expiră curând» cu 101 zile înainte."],
  ])("„expiră curând” at %i reads „%s”", (count, sentence) => {
    expect(exampleRo("documents_expiring_soon", "days", count)).toBe(sentence);
  });

  it.each([
    // #38.73: „obiect", neuter — was „O înregistrare schimbată …" (#38.64's report, 1a).
    [1, "Un obiect schimbat acum cel mult un minut poartă insigna «Nou!» roșie."],
    [5, "Un obiect schimbat acum cel mult 5 minute poartă insigna «Nou!» roșie."],
    [45, "Un obiect schimbat acum cel mult 45 de minute poartă insigna «Nou!» roșie."],
  ])("the red badge at %i minute(s)", (count, sentence) => {
    expect(exampleRo("recency_badge_red", "minutes", count)).toBe(sentence);
  });

  it("speaks of the value being typed, and of the saved one while the typing is not a number in range", () => {
    expect(exampleValue(undefined, 30, parseTimeFrameDraft)).toBe(30);
    expect(exampleValue("45", 30, parseTimeFrameDraft)).toBe(45);
    expect(exampleValue("abc", 30, parseTimeFrameDraft)).toBe(30);
    expect(exampleValue("0", 30, parseTimeFrameDraft)).toBe(30);
    expect(exampleValue("", 30, parseTimeFrameDraft)).toBe(30);
  });

  it("every unit's words exist in both languages", () => {
    for (const unit of ["days", "hours", "minutes", "months"]) {
      expect(say("ro-RO", ro.timeFrames.duration[unit], { count: 2 })).toMatch(/^2 /);
      expect(say("en-GB", en.timeFrames.duration[unit], { count: 2 })).toMatch(/^2 /);
    }
  });
});

describe("„Copii de siguranță” only reads, and says so where it cannot", () => {
  it("a missing folder is unreachable, with the reason, not a failure", () => {
    const status = readBackupStatus(env({ GA40_BACKUP_ROOT: path.join(os.tmpdir(), "ga40-no-such-backups-38-40") }));
    expect(status.reachable).toBe(false);
    if (!status.reachable) expect(status.why).toMatch(/does not exist/);
  });

  it("no OneDrive and no override (UAT, Vercel) is unreachable too", () => {
    const status = readBackupStatus(env({}));
    expect(status.reachable).toBe(false);
  });

  it("an empty folder has no backup and no drill", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ga40-backups-"));
    try {
      expect(readBackupStatus(env({ GA40_BACKUP_ROOT: dir }))).toEqual({ reachable: true, lastBackup: null, count: 0, lastDrill: null });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the newest backup and the last drill, as the runner left them", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ga40-backups-"));
    try {
      for (const name of ["2026-10-07T031000Z", "2026-10-08T031037Z"]) {
        fs.mkdirSync(path.join(dir, name));
        fs.writeFileSync(path.join(dir, name, "manifest.json"), JSON.stringify({ latestMigration: "migration_097.sql", dump: { size: 1048576 } }));
      }
      fs.mkdirSync(path.join(dir, "not-a-backup"));
      fs.writeFileSync(
        path.join(dir, "drills.json"),
        JSON.stringify([{ at: "2026-10-08T03:27:26.447Z", backup: "2026-10-08T031037Z", verdict: "failed", latestMigration: null, resultId: null, line: "FAILED — 1 files without a row" }]),
      );
      expect(readBackupStatus(env({ GA40_BACKUP_ROOT: dir }))).toEqual({
        reachable: true,
        lastBackup: { at: "2026-10-08T03:10:37.000Z", latestMigration: "migration_097.sql", dumpBytes: 1048576 },
        count: 2,
        lastDrill: { at: "2026-10-08T03:27:26.447Z", backup: "2026-10-08T031037Z", verdict: "failed", line: "FAILED — 1 files without a row" },
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the reader writes nothing: no write, rename or delete in it", () => {
    const src = read("src/lib/settings/system-status.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(src).not.toMatch(/\b(writeFile|appendFile|rename|rmSync|rm\(|unlink|mkdir|copyFile)\w*/);
  });
});

describe("„AI” reads the constants the calls use", () => {
  it("names each use and its model", () => {
    expect(aiModelsInUse(env({}))).toEqual([
      { use: "extract", model: EXTRACT_MODEL },
      { use: "idCard", model: ID_CARD_MODEL_DEFAULT },
      { use: "classify", model: CLASSIFY_MODEL },
      { use: "cluster", model: expect.any(String) },
    ]);
    expect(aiModelsInUse(env({ ANTHROPIC_VISION_MODEL: "x-model" }))[1]).toEqual({ use: "idCard", model: "x-model" });
  });

  it("no route spells a model name of its own any more", () => {
    const files = [
      "src/lib/documents/ai-extract.ts",
      "src/app/api/admin/doc-type-engine/cluster/route.ts",
      "src/app/api/admin/doc-type-engine/read-sample/route.ts",
      "src/app/api/admin/import/extract-id-card/route.ts",
      "src/app/api/admin/import/scan-folder/route.ts",
    ];
    for (const f of files) expect([f, /"claude-[a-z0-9-]+"/.test(read(f))]).toEqual([f, false]);
  });
});

describe("„Despre” never carries a credential", () => {
  it("the database is its host and its name", () => {
    expect(databaseOf("postgres://postgres:s3cret@localhost:5432/ga40db")).toEqual({ host: "localhost:5432", name: "ga40db" });
    expect(databaseOf("postgres://u:p@db.example.com/x")).toEqual({ host: "db.example.com", name: "x" });
    expect(JSON.stringify(databaseOf("postgres://postgres:s3cret@localhost:5432/ga40db"))).not.toContain("s3cret");
    expect(databaseOf(undefined)).toBeNull();
    expect(databaseOf("not a url")).toBeNull();
  });

  it("the environment is DEV, UAT or VERCEL", () => {
    expect(environmentName(env({}))).toBe("DEV");
    expect(environmentName(env({ VERCEL: "1" }))).toBe("VERCEL");
  });
});

describe("the sections' sentences", () => {
  const leaves = (o: unknown, p = ""): string[] =>
    typeof o === "string" ? [p] : Object.entries(o as object).flatMap(([k, v]) => leaves(v, p ? `${p}.${k}` : k));
  it("are the same keys in both locales", () => {
    expect(leaves(en).sort()).toEqual(leaves(ro).sort());
  });
  it("are the four section titles", () => {
    expect(ro.sectionTimeFrames).toBe("Praguri de timp");
    expect(ro.sections).toEqual({ account: "Contul meu", timeFrames: "Praguri de timp", backups: "Copii de siguranță", ai: "AI", about: "Despre" });
  });
});

describe("the paid reads (migration_100)", () => {
  it("count from the first instant of the month, in UTC", () => {
    expect(monthStart(new Date("2026-10-08T09:30:00Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(monthStart(new Date("2026-01-01T00:00:00Z")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(monthStart(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it.each([
    ["src/app/api/documents/[id]/ai-interpret/route.ts", "ai-interpret"],
    ["src/app/api/admin/doc-type-engine/read-sample/route.ts", "read-sample"],
    ["src/app/api/admin/doc-type-engine/cluster/route.ts", "cluster"],
    ["src/app/api/admin/import/scan-folder/route.ts", "scan-folder"],
    ["src/app/api/admin/import/extract-id-card/route.ts", "extract-id-card"],
  ])("%s records every answer it gets, as %s", (file, route) => {
    const src = read(file);
    expect(src).toContain(`recordPaidRead({`);
    expect(src).toContain(`route: "${route}"`);
  });

  it("no other route calls the Messages API without recording it", () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name === "route.ts" ? [`${dir}/${e.name}`] : [],
      );
    const calling = walk("src/app/api").filter((f) => /fetch\(ANTHROPIC_API_URL|callAnthropic\(/.test(read(f)));
    expect(calling.filter((f) => !read(f).includes("recordPaidRead(")).sort()).toEqual([]);
    expect(calling.length).toBe(5);
  });

  it("the words, at 0, 1, 7 and 20", () => {
    expect(say("ro-RO", ro.ai.paidReads, { count: 0 })).toBe("Nicio citire plătită luna aceasta");
    expect(say("ro-RO", ro.ai.paidReads, { count: 1 })).toBe("O citire plătită luna aceasta");
    expect(say("ro-RO", ro.ai.paidReads, { count: 7 })).toBe("7 citiri plătite luna aceasta");
    expect(say("ro-RO", ro.ai.paidReads, { count: 20 })).toBe("20 de citiri plătite luna aceasta");
  });
});
