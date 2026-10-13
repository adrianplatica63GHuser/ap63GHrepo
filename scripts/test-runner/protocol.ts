/**
 * scripts/test-runner/protocol.ts                   (Slices Propus.2, Propus.3)
 *
 * The contract between Claude and the Windows-side test runner, and every
 * decision the runner takes that can be made without touching a disk, a clock
 * or a process.
 *
 * Claude cannot run `npm run e2e` or `npx jest`: the device VM holds only the
 * Windows SWC/esbuild binaries and no Playwright browsers, and it cannot reach
 * localhost:3000 or 127.0.0.1:5432 (measured in #36.13). The one channel
 * between Claude and Windows is files in a connected folder. So Claude writes
 * a REQUEST file into `.test-runner/requests/`, `runner.ts` (started at logon
 * by the Scheduled Task that `scripts/Install-TestRunner.ps1` registers) runs
 * the sequence it names, and writes a RESULT file into `.test-runner/results/`
 * that Claude polls.
 *
 * ⚠️ **THE REQUEST IS DATA, NEVER A COMMAND LINE.** It names a sequence from
 * the fixed list below and the commit it must run on, and optionally narrows
 * the e2e/jest steps to files that ALREADY EXIST in the repository. Nothing in
 * it is ever passed to a shell, and every value that reaches an argv is either
 * a constant here or a path the runner enumerated itself. That is why unknown
 * fields are refused rather than ignored: a field this file does not know is a
 * field somebody expected to have an effect.
 *
 * ⚠️ **NOTHING HERE READS A FILE, SPAWNS A PROCESS OR ASKS THE TIME.** The
 * runner passes in what it observed (HEAD, whether it is busy, which spec files
 * exist) and gets back a decision. That is what lets
 * `src/__tests__/test-runner-protocol.test.ts` pin every refusal case without a
 * Windows box, a git repository or a dev server.
 *
 * Propus.3 added three sequences that do more than test, and each one has a
 * GUARD here — a pure decision over what the runner observed — that can HOLD it:
 *
 *   push           pushes `main` to origin, fast-forward only, and only on a
 *                  green `full`/`full-db` result for HEAD (`decidePush`).
 *   ci             reads the GitHub Actions runs for HEAD, read-only, and saves
 *                  the log of every failed job (`ciVerdict`).
 *   migrate-local  Apply-Migration.ps1, then Export-SupabaseSchema.ps1, and only
 *                  for migrations whose adding commit records Adrian's
 *                  confirmation (`decideMigrateLocal`).
 *
 * Slice #36.22 added `reconcile`, the one sequence that takes an argument: a
 * `folder` NAME, which must be one of the folders the runner itself found
 * directly under `C:\dev\TEST.DATA\Test.Claude\` (`dataFolderRefusal`). It
 * runs `scripts/testing/reconcile-import.ts` on that folder — a SELECT-only
 * read of the local database, in a read-only session — and nothing else.
 *
 * Slice #36.23 added `ai-score`, the one sequence that SPENDS MONEY: it runs
 * `scripts/testing/ai-score.ts`, which sends every contract of an AI-reading
 * corpus to the model once and scores the answers. It is in no other sequence,
 * so `full` never pays for it. Its request names a corpus folder directly under
 * `C:\dev\TEST.DATA\Test.Claude\ai-corpus\` (`folder`, checked against the
 * corpora the runner listed itself) and a `readCap` — the most reads the request
 * approves — which must be at least the corpus's size, so a run is the whole
 * corpus or nothing. `ai-rescore` names a corpus too and reads nothing: it
 * scores the answers earlier runs saved against the answer keys as they stand.
 *
 * Slice #37.05 added `forms-export` and a step at the end of `full`. The
 * export runs `scripts/document-type-forms.ts export`: one SELECT of every
 * document type's form, in a read-only session of the local database, written
 * into ONE file, `src/db/document-type-forms.json` (FU-019). `full` and
 * `full-db` now end with `forms-drift`, the same script's `check`, which says in
 * one line whether the database has moved on since the last export. Drift is
 * that line and never a red: `forms-drift` passes when the check ran and is
 * SKIPPED when it could not, so it can neither fail a run nor hold a push.
 *
 * Slice #37.11 added `backup` and `restore-drill` (FU-006, FU-251), both run by
 * `scripts/backup/archive.ts`. `backup` reads the live database — pg_dump and
 * SELECTs, nothing else — and writes a dated folder under OneDrive: the dump,
 * every page file, and a manifest. `restore-drill` restores the newest backup
 * into a throwaway container on 5434 and a scratch folder, reconciles every row
 * and file against the manifest, asks the restored app on 3200 for each entity
 * list once, and tears everything down. `migrate-local` now takes a backup
 * first, and applies nothing when that backup did not pass (`skipReasonFor`).
 * The runner also starts both on its own when idle (`scripts/backup/rules.ts`
 * → `nextAutoRun`): a backup daily, the drill monthly and after a migration.
 *
 * Slice #39.15 added `targeted` and the two-weekly whole regression. Adrian,
 * 2026-10-12: „cheap development first, reliability of the system later" —
 * running every test after every commit is what pushed Google Maps past its
 * free 10,000 a month (#39.14). So a slice is verified by `targeted`: lint and
 * tsc whole, e2e and jest narrowed by `only` to the tests the slice wrote or
 * changed and the existing tests of what it changed substantially — and with
 * no `only`, e2e and jest run NOTHING, never everything (`planSteps`). A green
 * `targeted` on HEAD licenses a push as a whole `full` does (`licensingRun`).
 * The whole regression, `full`, is started by the runner itself when it is
 * idle on a fixed schedule — November 4, 2026, then every 14 days
 * (`decideAutoRegression`) — under an
 * `auto-` id, and its date survives result pruning in `regression.json`.
 *
 * Slice #37.12 added `measure-fields`: `scripts/testing/measure-field-lengths.ts`,
 * three SELECTs in a read-only session that measure how long the values behind
 * every field on the detail screens really are, and print the table
 * `src/lib/ui/field-widths.ts` quotes. The longest free-text value is masked
 * inside Postgres (`src/lib/ui/field-measure.ts`), so no real value is printed.
 *
 * A held step is not a failure and not an error: it is the runner saying „this
 * waits for Adrian", with the reason by name. None of the three ever touches
 * Supabase or UAT — `npm run supabase:migrate` stays Adrian's.
 */

export const PROTOCOL_VERSION = 1 as const;

/** The runner's own `next dev` port. Adrian's server keeps 3000. */
export const RUNNER_PORT = 3100;
/** Adrian's `npm run dev` port — read only, to decide whether his cache is live. */
export const ADRIAN_DEV_PORT = 3000;

/**
 * The runner's own `next dev` build output, handed to `next.config.ts` through
 * `GA40_NEXT_DIST_DIR`. Next 16 refuses a second `next dev` in one directory
 * ("Another next dev server is already running in this directory") by locking
 * `<distDir>/dev/lock`, so a second server needs a second distDir. It sits
 * INSIDE `.next/` so that everything which already ignores `.next/` (git,
 * ESLint, jest's haste map, `.dockerignore`) ignores it too.
 */
export const RUNNER_DIST_DIR = ".next/runner";
export const RUNNER_DIST_ENV = "GA40_NEXT_DIST_DIR";

/** Repo-relative channel folder. Gitignored. */
export const CHANNEL_DIR = ".test-runner";
export const MAX_REQUEST_BYTES = 4096;
export const MAX_ONLY_ENTRIES = 50;

export const STEPS = [
  "e2e",
  "lint",
  "tsc",
  "jest",
  "verify-rebuild",
  "push",
  "ci",
  "apply-migration",
  "export-schema",
  "reconcile",
  "ai-score",
  "ai-rescore",
  "forms-export",
  "forms-drift",
  "backup",
  "restore-drill",
  "measure-fields",
] as const;
export type StepName = (typeof STEPS)[number];

/**
 * The fixed list. `full` is the verification sequence from `C:\dev\CLAUDE.md`
 * → Delivering work: e2e with a server up, then lint, tsc and jest with it
 * stopped. `full-db` adds `Verify-Rebuild.ps1` for a slice that touches the
 * database — it builds a throwaway Postgres on 5433, so Adrian's data is not
 * touched. `ping` runs nothing and proves the runner is alive.
 */
export const SEQUENCES = {
  ping: [],
  full: ["e2e", "lint", "tsc", "jest", "forms-drift"],
  // Slice #39.15: what a slice runs. e2e and jest run ONLY what `only` names.
  targeted: ["e2e", "lint", "tsc", "jest", "forms-drift"],
  "full-db": ["e2e", "lint", "tsc", "jest", "verify-rebuild", "forms-drift"],
  static: ["lint", "tsc", "jest"],
  e2e: ["e2e"],
  jest: ["jest"],
  "verify-rebuild": ["verify-rebuild"],
  push: ["push"],
  ci: ["ci"],
  "migrate-local": ["backup", "apply-migration", "export-schema"],
  reconcile: ["reconcile"],
  "ai-score": ["ai-score"],
  "ai-rescore": ["ai-rescore"],
  "forms-export": ["forms-export"],
  backup: ["backup"],
  "restore-drill": ["restore-drill"],
  "measure-fields": ["measure-fields"],
} as const satisfies Record<string, readonly StepName[]>;

export type SequenceName = keyof typeof SEQUENCES;
export const SEQUENCE_NAMES = Object.keys(SEQUENCES) as SequenceName[];

export const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const COMMIT_RE = /^[0-9a-f]{40}$/;
/** What an `only` entry may look like before it is checked against the files that exist. */
export const ONLY_RE =
  /^(?:e2e\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.spec\.ts|src\/__tests__\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.test\.tsx?)$/;

const ALLOWED_FIELDS = ["version", "id", "sequence", "commit", "only", "folder", "readCap"] as const;

/**
 * The sequences that take a `folder`, and the only ones that may.   (Slice #36.22)
 *
 * ⚠️ A folder is a NAME, not a path: no separator, no `..`, no leading dot, so
 * it can only ever mean a direct child of the data root — and on top of the
 * shape, it must be one of the names the runner listed in that root itself
 * (`RequestContext.knownDataFolders`). The runner joins it to the root; the
 * request never supplies the root.
 */
export const FOLDER_SEQUENCES: readonly SequenceName[] = ["reconcile", "ai-score", "ai-rescore"];
/** The sequences whose folder is a corpus under `AI_CORPUS_ROOT_SEGMENTS`. (Slice #36.23) */
export const CORPUS_SEQUENCES: readonly SequenceName[] = ["ai-score", "ai-rescore"];
export const DATA_FOLDER_RE = /^[0-9A-Za-z][0-9A-Za-z._ -]{0,99}$/;
/** The data root, relative to the repository: `C:\dev\TEST.DATA\Test.Claude`. */
export const DATA_ROOT_SEGMENTS = ["..", "TEST.DATA", "Test.Claude"] as const;
/** Where `ai-score`'s corpora live: `C:\dev\TEST.DATA\Test.Claude\ai-corpus`. (Slice #36.23) */
export const AI_CORPUS_ROOT_SEGMENTS = [...DATA_ROOT_SEGMENTS, "ai-corpus"] as const;
/** The most reads one `ai-score` request may approve. Three runs of ten were the first slice's cap. */
export const MAX_READ_CAP = 100;
const REQUIRED_FIELDS = ["version", "id", "sequence", "commit"] as const;

export interface RunRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  sequence: SequenceName;
  commit: string;
  /** Repo-relative, forward slashes. e2e specs narrow the e2e step, jest suites the jest step. */
  only?: string[];
  /** For `reconcile`: a folder name directly under the data root. For `ai-score`: a corpus under `ai-corpus`. */
  folder?: string;
  /** For `ai-score` only: the most paid reads this request approves. (Slice #36.23) */
  readCap?: number;
}

export type RefusalCode =
  | "too-large"
  | "malformed-json"
  | "not-an-object"
  | "unknown-field"
  | "missing-field"
  | "unsupported-version"
  | "bad-id"
  | "id-filename-mismatch"
  | "unknown-sequence"
  | "bad-commit"
  | "bad-only"
  | "only-not-applicable"
  | "bad-folder"
  | "folder-not-applicable"
  | "bad-read-cap"
  | "read-cap-not-applicable"
  | "read-cap-below-corpus"
  | "busy"
  | "head-unknown"
  | "head-mismatch";

export interface Refusal {
  code: RefusalCode;
  message: string;
}

export interface RequestContext {
  /** The request's file name, e.g. `20260924T153000Z-4711.json`. */
  fileName: string;
  /** `git rev-parse HEAD` at the moment of reading, or null when git could not answer. */
  headCommit: string | null;
  /** The id of the request being run right now, or null when idle. */
  busyWith: string | null;
  /** Repo-relative, forward slashes: every `e2e/**\/*.spec.ts` that exists. */
  knownE2eSpecs: readonly string[];
  /** Repo-relative, forward slashes: every `src/__tests__/**\/*.test.ts(x)` that exists. */
  knownJestSuites: readonly string[];
  /** The folder names directly under the data root (`DATA_ROOT_SEGMENTS`), as the runner listed them. */
  knownDataFolders: readonly string[];
  /**
   * The corpora directly under `AI_CORPUS_ROOT_SEGMENTS`, each with how many
   * contracts it holds (sub-folders with an `expected.json`), as the runner
   * counted them. (Slice #36.23)
   */
  knownCorpora: Readonly<Record<string, number>>;
}

export type ParseOutcome =
  | { ok: true; request: RunRequest }
  | { ok: false; refusal: Refusal; id: string | null };

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function refuse(code: RefusalCode, message: string, id: string | null = null): ParseOutcome {
  return { ok: false, refusal: { code, message }, id };
}

/**
 * The file-name stem to write a refusal under when the request's own id cannot
 * be trusted. Claude named the file, so the stem is what Claude will look for.
 */
export function resultIdForFile(fileName: string, fallback: string): string {
  const stem = fileName.replace(/\.json$/i, "");
  return ID_RE.test(stem) ? stem : fallback;
}

/**
 * Validate one request file's text. Checks run in a fixed order — shape first,
 * then "is the runner free", then "is HEAD the commit asked for" — so that a
 * malformed request is always reported as malformed, whatever else is true.
 */
export function parseRequest(raw: string, ctx: RequestContext): ParseOutcome {
  if (byteLength(raw) > MAX_REQUEST_BYTES) {
    return refuse("too-large", `A request is at most ${MAX_REQUEST_BYTES} bytes; this one is ${byteLength(raw)}.`);
  }
  const text = raw.replace(/^\uFEFF/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return refuse("malformed-json", `Not JSON: ${(e as Error).message}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return refuse("not-an-object", "A request is one JSON object.");
  }
  const obj = parsed as Record<string, unknown>;
  const rawId = typeof obj.id === "string" && ID_RE.test(obj.id) ? obj.id : null;

  const unknown = Object.keys(obj).filter((k) => !(ALLOWED_FIELDS as readonly string[]).includes(k));
  if (unknown.length > 0) {
    return refuse(
      "unknown-field",
      `Unknown field(s): ${unknown.join(", ")}. A request carries only ${ALLOWED_FIELDS.join(", ")}.`,
      rawId,
    );
  }
  const missing = REQUIRED_FIELDS.filter((k) => !(k in obj));
  if (missing.length > 0) {
    return refuse("missing-field", `Missing field(s): ${missing.join(", ")}.`, rawId);
  }
  if (obj.version !== PROTOCOL_VERSION) {
    return refuse(
      "unsupported-version",
      `This runner speaks protocol version ${PROTOCOL_VERSION}; the request says ${JSON.stringify(obj.version)}.`,
      rawId,
    );
  }
  if (rawId === null) {
    return refuse("bad-id", `id must match ${ID_RE}; got ${JSON.stringify(obj.id)}.`);
  }
  if (ctx.fileName !== `${rawId}.json`) {
    return refuse("id-filename-mismatch", `The file must be named ${rawId}.json; it is ${ctx.fileName}.`, rawId);
  }
  if (typeof obj.sequence !== "string" || !(SEQUENCE_NAMES as string[]).includes(obj.sequence)) {
    return refuse(
      "unknown-sequence",
      `sequence must be one of ${SEQUENCE_NAMES.join(", ")}; got ${JSON.stringify(obj.sequence)}.`,
      rawId,
    );
  }
  const sequence = obj.sequence as SequenceName;
  if (typeof obj.commit !== "string" || !COMMIT_RE.test(obj.commit)) {
    return refuse("bad-commit", `commit must be a full 40-character lower-case SHA; got ${JSON.stringify(obj.commit)}.`, rawId);
  }
  const commit = obj.commit;

  let only: string[] | undefined;
  if ("only" in obj) {
    const o = obj.only;
    if (!Array.isArray(o) || o.length === 0 || o.length > MAX_ONLY_ENTRIES || !o.every((x) => typeof x === "string")) {
      return refuse("bad-only", `only must be a non-empty array of at most ${MAX_ONLY_ENTRIES} strings.`, rawId);
    }
    const entries = o as string[];
    const badShape = entries.filter((e) => !ONLY_RE.test(e) || e.split("/").includes(".."));
    if (badShape.length > 0) {
      return refuse(
        "bad-only",
        `only takes repo-relative e2e/**/*.spec.ts or src/__tests__/**/*.test.ts(x) paths with forward slashes; refused: ${badShape.join(", ")}.`,
        rawId,
      );
    }
    const known = new Set([...ctx.knownE2eSpecs, ...ctx.knownJestSuites]);
    const absent = entries.filter((e) => !known.has(e));
    if (absent.length > 0) {
      return refuse("bad-only", `No such test file in the working tree: ${absent.join(", ")}.`, rawId);
    }
    const steps = SEQUENCES[sequence] as readonly StepName[];
    const applies = entries.some(
      (e) => (e.startsWith("e2e/") && steps.includes("e2e")) || (e.startsWith("src/") && steps.includes("jest")),
    );
    if (!applies) {
      return refuse(
        "only-not-applicable",
        `Sequence ${sequence} runs ${steps.join(", ") || "nothing"}; none of the only entries narrows one of those steps.`,
        rawId,
      );
    }
    only = [...new Set(entries)];
  }

  let folder: string | undefined;
  const takesFolder = FOLDER_SEQUENCES.includes(sequence);
  // `reconcile` names a data folder; `ai-score` names a corpus. Each is checked
  // against the list the runner made of ITS OWN root, never the other's.
  const isScore = sequence === "ai-score";
  const isCorpus = CORPUS_SEQUENCES.includes(sequence);
  const root: readonly string[] = isCorpus ? AI_CORPUS_ROOT_SEGMENTS : DATA_ROOT_SEGMENTS;
  const rootName = root.slice(1).join("\\");
  const known: readonly string[] = isCorpus ? Object.keys(ctx.knownCorpora) : ctx.knownDataFolders;
  if ("folder" in obj) {
    if (!takesFolder) {
      return refuse(
        "folder-not-applicable",
        `Only ${FOLDER_SEQUENCES.join(", ")} takes a folder; ${sequence} does not.`,
        rawId,
      );
    }
    const f = obj.folder;
    if (typeof f !== "string" || !DATA_FOLDER_RE.test(f) || f.includes("..")) {
      return refuse(
        "bad-folder",
        `folder is one folder NAME directly under ${rootName} — letters, digits, dot, dash, underscore, space; got ${JSON.stringify(f)}.`,
        rawId,
      );
    }
    if (!known.includes(f)) {
      return refuse("bad-folder", `No folder named ${JSON.stringify(f)} under ${rootName}.`, rawId);
    }
    folder = f;
  } else if (takesFolder) {
    return refuse("bad-folder", `${sequence} needs a folder: the name of one folder under ${rootName}.`, rawId);
  }

  // `readCap` — ai-score only, required there, and never smaller than the corpus:
  // a run is the whole corpus or nothing, and the cap is what the request approves.
  let readCap: number | undefined;
  if ("readCap" in obj) {
    if (!isScore) {
      return refuse("read-cap-not-applicable", `Only ai-score takes a readCap; ${sequence} spends nothing.`, rawId);
    }
    const c = obj.readCap;
    if (typeof c !== "number" || !Number.isInteger(c) || c < 1 || c > MAX_READ_CAP) {
      return refuse("bad-read-cap", `readCap is a whole number from 1 to ${MAX_READ_CAP}; got ${JSON.stringify(c)}.`, rawId);
    }
    readCap = c;
  } else if (isScore) {
    return refuse("bad-read-cap", "ai-score needs a readCap: the most paid reads this request approves.", rawId);
  }
  if (isCorpus && folder !== undefined) {
    const size = ctx.knownCorpora[folder] ?? 0;
    if (size === 0) {
      return refuse("bad-folder", `${folder} holds no contract with an expected.json.`, rawId);
    }
    if (readCap !== undefined && readCap < size) {
      return refuse(
        "read-cap-below-corpus",
        `${folder} holds ${size} contracts and each is one read; a readCap of ${readCap} would stop part-way. Ask for at least ${size}.`,
        rawId,
      );
    }
  }

  if (ctx.busyWith !== null) {
    return refuse("busy", `The runner is running ${ctx.busyWith}. Wait for its result, then ask again.`, rawId);
  }
  if (ctx.headCommit === null) {
    return refuse("head-unknown", "git rev-parse HEAD failed on the runner's side, so the commit cannot be checked.", rawId);
  }
  if (ctx.headCommit.toLowerCase() !== commit) {
    return refuse(
      "head-mismatch",
      `HEAD is ${ctx.headCommit.toLowerCase()}, the request asks for ${commit}. The runner tests the working tree; it never checks anything out.`,
      rawId,
    );
  }
  return {
    ok: true,
    request: {
      version: PROTOCOL_VERSION,
      id: rawId,
      sequence,
      commit,
      ...(only ? { only } : {}),
      ...(folder ? { folder } : {}),
      ...(readCap !== undefined ? { readCap } : {}),
    },
  };
}

// ---- the plan for one request -------------------------------------------------

export interface PlannedStep {
  name: StepName;
  /** For e2e and jest: the files to run, or null for all of them. */
  files: string[] | null;
  /** Set when `only` leaves this step with nothing to run. */
  skipReason: string | null;
}

/**
 * The sequences whose e2e and jest steps run ONLY what `only` names.   (Slice #39.15)
 *
 * ⚠️ On every other sequence a request with no `only` means „all of them". On
 * these it means „none of them": `files: null` is the runner's word for the
 * whole suite, so a targeted step with nothing named must be SKIPPED, never
 * planned with `files: null` — that would quietly be the whole regression this
 * sequence exists to avoid.
 */
export const TARGETED_SEQUENCES: readonly SequenceName[] = ["targeted"];

export function planSteps(request: Pick<RunRequest, "sequence" | "only">): PlannedStep[] {
  const steps = SEQUENCES[request.sequence] as readonly StepName[];
  const targeted = TARGETED_SEQUENCES.includes(request.sequence);
  return steps.map((name) => {
    if (name !== "e2e" && name !== "jest") return { name, files: null, skipReason: null };
    if (!request.only && !targeted) return { name, files: null, skipReason: null };
    const prefix = name === "e2e" ? "e2e/" : "src/__tests__/";
    const files = (request.only ?? []).filter((e) => e.startsWith(prefix));
    const what = name === "e2e" ? "e2e spec" : "jest suite";
    if (files.length > 0) return { name, files, skipReason: null };
    return { name, files: null, skipReason: targeted ? `targeted — the slice names no ${what}, so none ran` : `only names no ${what}` };
  });
}

/**
 * The note a targeted step carries, so a result says which tests ran without
 * anyone opening the log — or null for a step that ran its whole suite or
 * nothing at all.   (Slice #39.15)
 */
export function targetedNote(sequence: SequenceName, step: PlannedStep): string | null {
  if (!TARGETED_SEQUENCES.includes(sequence) || step.files === null) return null;
  const what = step.name === "e2e" ? "spec" : "suite";
  return `targeted — ran only the ${step.files.length} ${what}${step.files.length === 1 ? "" : "s"} named: ${step.files.join(", ")}`;
}

/**
 * Playwright's positional arguments are file filters. They are passed relative
 * to `testDir` (`./e2e`), which is how Playwright prints them back.
 */
export function playwrightArgs(files: string[] | null): string[] {
  return ["test", ...(files ?? []).map((f) => f.replace(/^e2e\//, ""))];
}

/**
 * ⚠️ **A COLD `next dev` COMPILES EACH ROUTE ON ITS FIRST REQUEST, INSIDE WHATEVER
 * SPEC ASKS FIRST.** Measured in Propus.3 (20260924T164218Z-7585): the runner's
 * server took 5.3 s to compile `/api/documents/[id]/persons`, 6.0 s for
 * `/properties` beside it and 43 s for `/admin/global-search`, so three specs hit
 * their 5 s and 30 s waits on a server that was doing nothing wrong, while the
 * same specs passed in Propus.2. The runner re-runs ONLY the failed specs, ONCE,
 * on the now-warm server, and only when every failure is a wait that ran out
 * AND the server compiled something during the run. A spec that is really
 * broken fails the second time too, so the re-run cannot turn a defect green;
 * what it absorbs is the compile, and the note on the step says it happened.
 */
export const PLAYWRIGHT_RERUN_ARGS = ["test", "--last-failed"] as const;

/** The spec files of the numbered failure blocks in Playwright's list reporter. */
export function failedE2eSpecs(text: string): string[] {
  const t = stripAnsi(text);
  const out = new Set<string>();
  for (const m of t.matchAll(/^[ \t]+\d+\) \[[^\]]+\] › (\S+?):\d+:\d+ ›/gm)) out.add(m[1].replace(/\\/g, "/"));
  return [...out];
}

/** True when there are failure blocks and every one of them is a wait that ran out. */
export function e2eFailuresAreAllTimeouts(text: string): boolean {
  const t = stripAnsi(text);
  // `[ \t]`, not `\s`: with /m a `\s+` also eats the blank line above a block, and the
  // split then cuts twice around it, leaving a sliver with no Timeout in it.
  // And a filter, not `.slice(1)`: split drops the empty piece when a block starts the text.
  const blocks = t.split(/^(?=[ \t]+\d+\) \[[^\]]+\] › )/m).filter((b) => /^[ \t]+\d+\) \[/.test(b));
  if (blocks.length === 0) return false;
  return blocks.every((b) => /\bTimeout:? \d+ ?ms\b|Test timeout of \d+ms exceeded|Timeout \d+ms exceeded/.test(b));
}

/** Did `next dev` compile a route in this stretch of its output? */
export function devServerCompiled(text: string): boolean {
  return /Compiling\s+\S/.test(stripAnsi(text));
}

/** `--runTestsByPath` makes each entry an exact path rather than a regex. */
export function jestArgs(files: string[] | null, maxWorkers: number | null = null): string[] {
  return [
    ...(maxWorkers !== null ? [`--maxWorkers=${maxWorkers}`] : []),
    ...(files && files.length > 0 ? ["--runTestsByPath", ...files] : []),
  ];
}

// ---- reading what the tools printed -----------------------------------------

const ANSI_RE = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

export type DevServerTell = "lock-held" | "port-in-use" | "os-error-1450" | "corrupt-cache";

/**
 * What `next dev`'s own output says about it. The tells, and why each one has
 * the remedy it has, are in `C:\dev\.claude\rules\sandbox-and-toolchain.md`:
 *
 *   os-error-1450  Windows refused Turbopack's SST write (commit charge). The
 *                  half-written cache is what makes the NEXT start panic, so
 *                  the remedy is: stop, clear the runner's `dev` cache, restart
 *                  with `--webpack`, which builds no SST database at all.
 *   corrupt-cache  the panic that follows it — "Failed to restore task data
 *                  (corrupted database or bug)". Stop, clear, restart. #38.23
 *                  met a second wording of the same restored-cache panic,
 *                  "Every task must have a task type", which matched nothing,
 *                  so the server hung on its first compile with no recovery.
 *   lock-held      another `next dev` holds `<distDir>/dev/lock`; with the
 *                  runner's own distDir that should never be Adrian's, so it
 *                  is reported, never worked around.
 *   port-in-use    something else listens on the runner's port. Reported.
 *
 * Ordered: the two that cannot be recovered from are checked first.
 */
export function classifyDevServerOutput(text: string): { ready: boolean; tell: DevServerTell | null } {
  const t = stripAnsi(text);
  const ready = /\bReady in\b/.test(t);
  let tell: DevServerTell | null = null;
  if (/Another\s+\S*\s*next dev\s*\S*\s*server is already running/i.test(t) || /already running in this directory/i.test(t)) {
    tell = "lock-held";
  } else if (/EADDRINUSE|address already in use|Port \d+ is in use/i.test(t)) {
    tell = "port-in-use";
  } else if (/os error 1450/i.test(t)) {
    tell = "os-error-1450";
  } else if (
    /Failed to restore task data|corrupted database|Unable to open static sorted file|An unexpected Turbopack error occurred|Every task must have a task type/i.test(t)
  ) {
    tell = "corrupt-cache";
  }
  return { ready, tell };
}

export type CacheRoot = "runner" | "dev" | "types" | "other";

export interface TscClassification {
  errorCount: number;
  /** Files with at least one located error, forward slashes, as tsc printed them. */
  files: string[];
  /** True when there are errors and EVERY one of them is located under `.next/`. */
  cacheOnly: boolean;
  /** For a cache-only run: which build caches the errors are in. */
  cacheRoots: CacheRoot[];
}

/**
 * ⚠️ **AN ERROR WHOSE PATH STARTS WITH `.next/` IS A STATEMENT ABOUT THE BUILD
 * CACHE, NOT ABOUT THE CODE.** (`C:\dev\CLAUDE.md` → Delivering work.) A
 * `next dev` killed or caught mid-write leaves a generated file with the tail
 * of its previous version attached, and tsc reports TS1128/TS1434 in a file
 * nobody wrote. So a run is `cacheOnly` only when every error is located AND
 * under `.next/`; one error anywhere else, or one tsc could not locate
 * (`error TS5083: Cannot read file ...`), makes it a code failure.
 */
export function classifyTscOutput(text: string): TscClassification {
  const lines = stripAnsi(text).split(/\r?\n/);
  const located = /^(.+?)\((\d+),(\d+)\): error TS\d+:/;
  const anyError = /\berror TS\d+:/;
  let errorCount = 0;
  let unlocated = 0;
  const files = new Set<string>();
  for (const line of lines) {
    if (!anyError.test(line)) continue;
    errorCount++;
    const m = located.exec(line);
    if (m) files.add(m[1].replace(/\\/g, "/").replace(/^\.\//, ""));
    else unlocated++;
  }
  const list = [...files];
  const cacheOnly = errorCount > 0 && unlocated === 0 && list.every((f) => f.startsWith(".next/"));
  const roots = new Set<CacheRoot>();
  if (cacheOnly) {
    for (const f of list) {
      if (f.startsWith(`${RUNNER_DIST_DIR}/`)) roots.add("runner");
      else if (f.startsWith(".next/dev/")) roots.add("dev");
      else if (f.startsWith(".next/types/")) roots.add("types");
      else roots.add("other");
    }
  }
  return { errorCount, files: list, cacheOnly, cacheRoots: [...roots] };
}

/**
 * ⚠️ **A JEST RUN WHOSE WORKERS DIED IS NOT A RED RUN.** On this machine, above
 * a certain commit charge, Windows refuses a worker at spawn and jest reports
 * `Test suite failed to run` for suites that never reached an assertion
 * (`jest.config.ts` → maxWorkers). The tell is the summary: suites failed, and
 * `Tests:` counts no failed test.
 */
export function isJestWorkerCrashOnly(text: string): boolean {
  const t = stripAnsi(text);
  const suites = /^Test Suites:.*$/m.exec(t)?.[0] ?? "";
  const tests = /^Tests:.*$/m.exec(t)?.[0] ?? "";
  if (!/\bfailed\b/.test(suites) || /\bfailed\b/.test(tests)) return false;
  return /Jest worker|ran out of memory|paging file is too small|Failed to load bindings|Zone Allocation failed|HashMap::Initialize/i.test(t);
}

/** One line per step, for the result file and the handover. */
export function summariseStep(step: StepName, text: string, exitCode: number | null): string {
  const t = stripAnsi(text);
  const lines = t.split(/\r?\n/).map((l) => l.trim());
  const exit = exitCode === null ? "no exit code" : `exit ${exitCode}`;
  let body = "";
  switch (step) {
    case "e2e": {
      body = lines
        .filter((l) => /^\d+ (passed|failed|flaky|skipped|did not run|interrupted)\b/.test(l))
        .join("; ");
      if (!body && /No tests found/i.test(t)) body = "No tests found";
      break;
    }
    case "jest": {
      body = lines.filter((l) => /^(Test Suites|Tests):/.test(l)).join(" | ");
      break;
    }
    case "lint": {
      // stylish prints "✖ 3 problems (…)"; a Windows console code page can turn the mark into anything.
      body = lines.filter((l) => /^\S{0,2}\s*\d+ problems? \(/.test(l)).pop() ?? (exitCode === 0 ? "no problems" : "");
      break;
    }
    case "tsc": {
      const c = classifyTscOutput(t);
      body =
        c.errorCount === 0
          ? exitCode === 0
            ? "0 errors"
            : ""
          : `${c.errorCount} error${c.errorCount === 1 ? "" : "s"} in ${c.files.length} file${c.files.length === 1 ? "" : "s"}${c.cacheOnly ? ", all under .next/" : ""}`;
      break;
    }
    case "verify-rebuild": {
      body = lines.filter((l) => /\b(PASS|FAIL|PARTIAL)\b/.test(l)).pop() ?? "";
      break;
    }
    case "reconcile": {
      // `scripts/testing/reconcile-import.ts` ends with one `RECONCILE:` line.
      body = (lines.filter((l) => l.startsWith("RECONCILE:")).pop() ?? "").replace(/^RECONCILE:\s*/, "");
      break;
    }
    case "ai-score":
    case "ai-rescore": {
      // `scripts/testing/ai-score.ts` ends with one `AI-SCORE:` line — counts and percentages only.
      body = (lines.filter((l) => l.startsWith("AI-SCORE:")).pop() ?? "").replace(/^AI-SCORE:\s*/, "");
      break;
    }
    case "forms-export":
    case "forms-drift": {
      // `scripts/document-type-forms.ts` ends with one `FORMS:` line — counts and type keys only.
      body = (lines.filter((l) => l.startsWith("FORMS:")).pop() ?? "").replace(/^FORMS:\s*/, "");
      break;
    }
    case "backup": {
      // `scripts/backup/archive.ts backup` ends with one `BACKUP:` line. (Slice #37.11)
      body = (lines.filter((l) => l.startsWith("BACKUP:")).pop() ?? "").replace(/^BACKUP:\s*/, "");
      break;
    }
    case "restore-drill": {
      // `scripts/backup/archive.ts drill` ends with one `DRILL:` line. (Slice #37.11)
      body = (lines.filter((l) => l.startsWith("DRILL:")).pop() ?? "").replace(/^DRILL:\s*/, "");
      break;
    }
    case "measure-fields": {
      // `scripts/testing/measure-field-lengths.ts` ends with one `MEASURE:` line; the table is the log. (Slice #37.12)
      body = (lines.filter((l) => l.startsWith("MEASURE:")).pop() ?? "").replace(/^MEASURE:\s*/, "");
      break;
    }
  }
  return body ? `${body} (${exit})` : exit;
}

// ---- the result file -----------------------------------------------------------

export type StepStatus = "pending" | "running" | "passed" | "failed" | "cache-only" | "error" | "skipped" | "held";
export type RunStatus = "refused" | "running" | "passed" | "failed" | "error" | "held";

export interface StepResult {
  name: StepName;
  status: StepStatus;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  seconds: number | null;
  summary: string;
  /** Repo-relative, forward slashes. */
  log: string | null;
  /** Every recovery the runner made on its own, in the order it made them. */
  notes: string[];
  /** Set when a guard held the step: why, by name (`GuardCode`). */
  held?: GuardCode;
}

export interface RunnerInfo {
  protocol: typeof PROTOCOL_VERSION;
  pid: number;
  host: string;
  port: number;
  startedAt: string;
  /** HEAD when the runner process started — the runner's own code is that commit's. */
  runnerCommit: string | null;
}

export interface RunResult {
  version: typeof PROTOCOL_VERSION;
  /** Always "runner": a result from this file is never Adrian's run. */
  source: "runner";
  id: string;
  sequence: SequenceName | null;
  commit: string | null;
  only: string[] | null;
  /** `reconcile`, `ai-score` and `ai-rescore` only: the folder it read. Absent on every other result. */
  folder?: string;
  /** `ai-score` only: the read cap the request approved. */
  readCap?: number;
  status: RunStatus;
  refusal: Refusal | null;
  receivedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** `git status --porcelain` at the start: what the working tree held beyond HEAD. */
  dirty: string[];
  steps: StepResult[];
  runner: RunnerInfo;
}

export function pendingSteps(plan: PlannedStep[]): StepResult[] {
  return plan.map((p) => ({
    name: p.name,
    status: p.skipReason ? "skipped" : "pending",
    exitCode: null,
    startedAt: null,
    finishedAt: null,
    seconds: null,
    summary: p.skipReason ?? "",
    log: null,
    notes: [],
  }));
}

/**
 * `passed` only when every step that ran passed. A step that failed makes the
 * run `failed` — the code is wrong. Otherwise any `error` or `cache-only` step
 * makes it `error` — the runner could not give an answer, which is neither.
 * Otherwise a `held` step makes it `held` — a guard said this waits for Adrian.
 */
export function overallStatus(steps: StepResult[]): Exclude<RunStatus, "refused" | "running"> {
  if (steps.some((s) => s.status === "failed")) return "failed";
  if (steps.some((s) => s.status === "error" || s.status === "cache-only" || s.status === "pending" || s.status === "running")) {
    return "error";
  }
  if (steps.some((s) => s.status === "held")) return "held";
  return "passed";
}

export function refusedResult(
  id: string,
  refusal: Refusal,
  receivedAt: string,
  runner: RunnerInfo,
  partial: { sequence?: unknown; commit?: unknown } = {},
): RunResult {
  return {
    version: PROTOCOL_VERSION,
    source: "runner",
    id,
    sequence:
      typeof partial.sequence === "string" && (SEQUENCE_NAMES as string[]).includes(partial.sequence)
        ? (partial.sequence as SequenceName)
        : null,
    commit: typeof partial.commit === "string" && COMMIT_RE.test(partial.commit) ? partial.commit : null,
    only: null,
    status: "refused",
    refusal,
    receivedAt,
    startedAt: null,
    finishedAt: receivedAt,
    dirty: [],
    steps: [],
    runner,
  };
}

// ---- guards: the sequences that do more than test (Slice Propus.3) ---------------

/**
 * Why a guard HELD a step. A held step is the runner saying „this waits for
 * Adrian", never „this is broken", so it gets its own status and its own exit
 * code in `claude.sh` (6), and the handover names the code.
 */
export type GuardCode =
  | "not-on-main"
  | "no-green-run"
  | "green-run-dirty"
  | "remote-unknown"
  | "not-fast-forward"
  | "migration-in-range"
  | "migration-dirty"
  | "migration-uncommitted"
  | "migration-unconfirmed";

export type GuardDecision<T> = ({ ok: true } & T) | { ok: false; code: GuardCode; message: string };

/** A step that runs only when the step before it in its sequence passed AND applied something. */
export const DEPENDENT_STEPS: readonly StepName[] = ["export-schema"];

/**
 * A step that runs only when the backup before it passed.   (Slice #37.11)
 * Decision 3 of #37.09: a backup before every migrate-local — so a migration is
 * never applied to an archive that has no copy from the minute before.
 */
export const BACKUP_FIRST_STEPS: readonly StepName[] = ["apply-migration"];

/**
 * Why the runner skips this step, given how the step before it in its sequence
 * ended — or null to run it. `previous` is null for the first step.
 */
export function skipReasonFor(
  step: StepName,
  previous: { status: StepStatus; applied: number } | null,
): string | null {
  if (BACKUP_FIRST_STEPS.includes(step) && previous?.status !== "passed") {
    return `the backup before it ended ${previous?.status ?? "unrun"}, so nothing is applied without one`;
  }
  if (DEPENDENT_STEPS.includes(step) && (previous?.status !== "passed" || previous.applied === 0)) {
    return previous?.status === "passed" ? "nothing was applied, so there is nothing to regenerate" : `the step before it ended ${previous?.status ?? "unrun"}`;
  }
  return null;
}

/** The only branch the runner ever pushes, and the only remote. */
export const PUSH_BRANCH = "main";
export const PUSH_REMOTE = "origin";
/** The whole regression: every e2e spec and every jest suite. Narrowed by `only`, it is not. */
export const WHOLE_SEQUENCES: readonly SequenceName[] = ["full", "full-db"];
/**
 * Sequences whose green result on HEAD licenses a push: a whole `full`/`full-db`,
 * unnarrowed, or — since Slice #39.15 — a `targeted` run, narrowed or not.
 */
export const PUSH_LICENSING_SEQUENCES: readonly SequenceName[] = [...WHOLE_SEQUENCES, ...TARGETED_SEQUENCES];

/** `src/db/migration_087_x.sql` — the same shape `scripts/migration-state.ts` reads. */
export const MIGRATION_PATH_RE = /^src\/db\/migration_\d{3}_[^/]+\.sql$/;

export type GreenRunCandidate = Pick<RunResult, "id" | "source" | "status" | "sequence" | "commit" | "only" | "dirty" | "finishedAt">;

export interface PushObservation {
  /** `git symbolic-ref --short -q HEAD`, or null when HEAD is detached. */
  branch: string | null;
  /** HEAD, lower-case. */
  head: string;
  /** Every result file the runner holds, as read. */
  results: readonly GreenRunCandidate[];
  /** `git ls-remote --heads origin main`, or null when it failed or origin has no main. */
  remoteMain: string | null;
  /** `git merge-base --is-ancestor <remoteMain> HEAD` exited 0. False when the object is not even local. */
  remoteIsAncestor: boolean;
  /** `git diff --name-status <remoteMain> HEAD`, one line per path: `A\tsrc/db/migration_087_x.sql`. */
  rangeChanges: readonly string[];
  /** `git rev-list --count <remoteMain>..HEAD`. */
  rangeCommits: number;
}

/** A `git status --porcelain` line that is not `?? path` is a tracked change. */
function trackedChanges(dirty: readonly string[]): string[] {
  return dirty.filter((d) => !d.startsWith("?? "));
}

/**
 * The green run that licenses pushing HEAD: a whole `full`/`full-db` run, or a
 * `targeted` run, by the runner on exactly this commit, passed, and taken on a
 * tree with no TRACKED change beyond HEAD. A `full` narrowed by `only` is
 * neither: `targeted` is the one narrowed run that says so by its name, which
 * is what lets the result be read for what it is. (Slice #39.15)
 * An untracked file is tolerated — the runner's own channel is gitignored, but
 * Adrian's scratch files are not, and they are not what is being pushed.
 */
export function licensingRun(results: readonly GreenRunCandidate[], head: string): {
  clean: GreenRunCandidate | null;
  dirtyOnly: GreenRunCandidate | null;
} {
  const green = results
    .filter(
      (r) =>
        r.source === "runner" &&
        r.status === "passed" &&
        r.sequence !== null &&
        PUSH_LICENSING_SEQUENCES.includes(r.sequence) &&
        r.commit === head &&
        (TARGETED_SEQUENCES.includes(r.sequence) || r.only === null || r.only === undefined),
    )
    .sort((a, b) => String(b.finishedAt ?? "").localeCompare(String(a.finishedAt ?? "")));
  return {
    clean: green.find((r) => trackedChanges(r.dirty ?? []).length === 0) ?? null,
    dirtyOnly: green[0] ?? null,
  };
}

/**
 * ⚠️ **THE PUSH GUARD. EVERY CONDITION HOLDS THE PUSH; NONE OF THEM IS WORKED
 * AROUND.** The runner pushes `main` to origin with Adrian's own git
 * credentials only when all of these hold (Slice Propus.3's header):
 *
 *   1. HEAD is `main` — never another branch, never a detached HEAD.
 *   2. A green `targeted` result, or a green unnarrowed `full`/`full-db`, names
 *      HEAD, on a clean tree. (`targeted` since Slice #39.15.)
 *   3. origin's `main` is known and is an ancestor of HEAD — a fast-forward.
 *      There is no force anywhere in the runner, and git itself would refuse a
 *      non-fast-forward, but the guard says so by name first.
 *   4. No commit in the range adds, changes or removes a `src/db/migration_*.sql`.
 *      Supabase is migrated by Adrian (`npm run supabase:migrate`), and af3d664
 *      is what happens when code reaches production ahead of the cloud schema.
 *      Such a range waits for him: migrate Supabase, then push.
 *
 * Checked in that order, so the reason given is the first thing to fix.
 */
export function decidePush(o: PushObservation): GuardDecision<{ greenRun: string; from: string; to: string; commits: number }> {
  if (o.branch !== PUSH_BRANCH) {
    return {
      ok: false,
      code: "not-on-main",
      message: `HEAD is ${o.branch === null ? "detached" : `on ${o.branch}`}; the runner pushes ${PUSH_BRANCH} and nothing else.`,
    };
  }
  const lic = licensingRun(o.results, o.head);
  if (!lic.clean) {
    if (lic.dirtyOnly) {
      const tracked = trackedChanges(lic.dirtyOnly.dirty ?? []);
      return {
        ok: false,
        code: "green-run-dirty",
        message: `The green run ${lic.dirtyOnly.id} tested uncommitted changes beyond HEAD (${tracked.join(" · ")}), so it is not evidence about HEAD. Run targeted again on a clean tree.`,
      };
    }
    return {
      ok: false,
      code: "no-green-run",
      message: `No passed targeted run, and no passed unnarrowed ${WHOLE_SEQUENCES.join("/")} run, by the runner names ${o.head.slice(0, 7)}. Request targeted first.`,
    };
  }
  if (o.remoteMain === null) {
    return {
      ok: false,
      code: "remote-unknown",
      message: `git ls-remote could not tell where ${PUSH_REMOTE}/${PUSH_BRANCH} is, so a fast-forward cannot be proven.`,
    };
  }
  const remote = o.remoteMain.toLowerCase();
  if (remote === o.head) {
    return { ok: true, greenRun: lic.clean.id, from: remote, to: o.head, commits: 0 };
  }
  if (!o.remoteIsAncestor) {
    return {
      ok: false,
      code: "not-fast-forward",
      message: `${PUSH_REMOTE}/${PUSH_BRANCH} is ${remote.slice(0, 7)}, which is not an ancestor of HEAD ${o.head.slice(0, 7)}. Something was pushed that this checkout does not have; that is Adrian's to reconcile.`,
    };
  }
  const migrations = o.rangeChanges
    .map((l) => l.split("\t"))
    .filter((cols) => cols.slice(1).some((p) => MIGRATION_PATH_RE.test(p.replace(/\\/g, "/"))))
    .map((cols) => cols.join(" "));
  if (migrations.length > 0) {
    return {
      ok: false,
      code: "migration-in-range",
      message: `The range ${remote.slice(0, 7)}..${o.head.slice(0, 7)} touches ${migrations.join(", ")}. Supabase has not had it: Adrian runs npm run supabase:migrate, then pushes.`,
    };
  }
  return { ok: true, greenRun: lic.clean.id, from: remote, to: o.head, commits: o.rangeCommits };
}

// ---- the whole regression, every two weeks (Slice #39.15) ------------------------------

/**
 * ⚠️ **ADRIAN'S DECISION, 2026-10-12, UNTIL HE CHANGES IT: THE WHOLE REGRESSION
 * RUNS EVERY TWO WEEKS, NOT AFTER EVERY SLICE.** „Cheap development first,
 * reliability of the system later." A slice runs `targeted`; the runner starts
 * a whole `full` on its own on a FIXED schedule: November 4, 2026, then every
 * 14 days — Adrian, 2026-10-12: „move the Oct 25 to November 4th, and every two
 * weeks after that". A whole run asked for in between does not move the dates.
 * A red one is not fixed by whatever slice is running — the next handover lists
 * it, and Adrian decides when it is fixed (`C:\dev\CLAUDE.md` → „Tests run
 * targeted"). Change the cadence here and in that block, nowhere else.
 */
export const REGRESSION_EVERY_DAYS = 14;
export const REGRESSION_EVERY_MS = REGRESSION_EVERY_DAYS * 24 * 60 * 60_000;
/** The schedule's first date: midnight of 2026-11-04 in Toronto (EST, UTC-5). Then every `REGRESSION_EVERY_DAYS`. */
export const REGRESSION_FIRST = "2026-11-04T05:00:00.000Z";
/** An automatic run that gave no answer (status `error`) is tried again after this long, not every ten minutes. */
export const REGRESSION_RETRY_MS = 6 * 60 * 60_000;
/** Under `CHANNEL_DIR`: the newest whole run, kept here because result files are pruned (60 kept). */
export const REGRESSION_STATE_FILE = "regression.json";

export type RegressionCandidate = Pick<RunResult, "id" | "source" | "status" | "sequence" | "only" | "finishedAt">;

/** The newest whole regression, as `regression.json` holds it. */
export interface RegressionRecord {
  id: string;
  status: "passed" | "failed";
  finishedAt: string;
}

/**
 * Is this result a whole regression run? The runner's, `full`/`full-db`,
 * unnarrowed, and ANSWERED — passed or failed. A run that ended `error` or
 * `held` said nothing about the code, so it does not reset the clock; a red
 * run did, so it does — the policy is a whole run every two weeks, not a
 * green one.
 */
export function isWholeRegression(r: RegressionCandidate): boolean {
  return (
    r.source === "runner" &&
    r.sequence !== null &&
    WHOLE_SEQUENCES.includes(r.sequence) &&
    (r.only === null || r.only === undefined) &&
    (r.status === "passed" || r.status === "failed") &&
    typeof r.finishedAt === "string" &&
    !Number.isNaN(Date.parse(r.finishedAt))
  );
}

/** The newest whole regression among the result files and the recorded one, or null when there has been none. */
export function lastRegression(
  results: readonly RegressionCandidate[],
  recorded: RegressionRecord | null,
): RegressionRecord | null {
  const all: RegressionRecord[] = results
    .filter(isWholeRegression)
    .map((r) => ({ id: r.id, status: r.status as "passed" | "failed", finishedAt: r.finishedAt as string }));
  if (recorded && !Number.isNaN(Date.parse(recorded.finishedAt))) all.push(recorded);
  all.sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
  return all[0] ?? null;
}

/**
 * When the next whole regression is due: the first scheduled date — November 4,
 * 2026, then every 14 days — after the last whole run finished. With no whole
 * run on record, or the last one before the schedule began, that is November 4.
 * So a whole run asked for in between answers the date that follows it, and
 * never moves the dates themselves.
 */
export function regressionDueAt(last: RegressionRecord | null): Date {
  const first = Date.parse(REGRESSION_FIRST);
  const t = last ? Date.parse(last.finishedAt) : Number.NaN;
  if (Number.isNaN(t) || t < first) return new Date(first);
  return new Date(first + (Math.floor((t - first) / REGRESSION_EVERY_MS) + 1) * REGRESSION_EVERY_MS);
}

export interface RegressionObservation {
  now: Date;
  last: RegressionRecord | null;
  /** When this runner process last started one on its own, or null. */
  lastAttempt: Date | null;
  /** `git status --porcelain` now. */
  dirty: readonly string[];
}

export type RegressionDecision = { start: true } | { start: false; reason: string };

/**
 * Whether the idle runner starts the whole regression now. Checked in this
 * order, so the reason given is the one that is actually in the way:
 *
 *   1. It is due — a scheduled date (November 4, 2026, then every 14 days)
 *      has come since the last whole run finished.
 *   2. This process has not tried within `REGRESSION_RETRY_MS` — a run that
 *      gave no answer (Docker down, a server that never came up) is retried,
 *      but not every ten minutes.
 *   3. The working tree has no TRACKED change beyond HEAD. A whole run over
 *      half-written work would report a slice in progress as the regression's
 *      failures, and the result would be evidence about neither. An untracked
 *      file is tolerated, as the push guard tolerates it.
 */
export function decideAutoRegression(o: RegressionObservation): RegressionDecision {
  const due = regressionDueAt(o.last);
  if (o.now.getTime() < due.getTime()) {
    return { start: false, reason: `not due until ${due.toISOString()} (last whole run ${o.last?.id ?? "none"})` };
  }
  if (o.lastAttempt && o.now.getTime() - o.lastAttempt.getTime() < REGRESSION_RETRY_MS) {
    return { start: false, reason: `tried at ${o.lastAttempt.toISOString()} without an answer; trying again after ${REGRESSION_RETRY_MS / 3_600_000} h` };
  }
  const tracked = trackedChanges(o.dirty);
  if (tracked.length > 0) {
    return { start: false, reason: `due, but the working tree has uncommitted changes (${tracked.join(" · ")}); waiting for a clean tree` };
  }
  return { start: true };
}

// ---- ci: reading GitHub Actions, read-only -----------------------------------------

/** The fields of a workflow run the runner reads. Everything else in the API's answer is ignored. */
export interface CiRun {
  id: number;
  name: string;
  run_number: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_sha: string;
}

export interface CiJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  steps?: { name: string; status: string; conclusion: string | null; number: number }[];
}

export type CiVerdict = "none" | "pending" | "passed" | "failed";

/** A completed run with one of these conclusions is green; any other conclusion is red. */
export const CI_GREEN_CONCLUSIONS: readonly string[] = ["success", "skipped", "neutral"];
/** How long `ci` waits for GitHub to create a run for the commit, then for every run to finish. */
export const CI_FIRST_RUN_WAIT_MS = 5 * 60_000;
export const CI_FINISH_WAIT_MS = 30 * 60_000;
export const CI_POLL_MS = 20_000;

/** `owner/repo` from origin's URL, https or ssh; null for anything that is not github.com. */
export function parseGithubRemote(url: string): { owner: string; repo: string } | null {
  const m =
    /^https:\/\/(?:[^@/]+@)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url.trim()) ??
    /^(?:ssh:\/\/)?git@github\.com[:/]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** The newest run of each workflow for this commit — a re-run supersedes the run it repeats. */
export function latestRunPerWorkflow(runs: readonly CiRun[], head: string): CiRun[] {
  const byName = new Map<string, CiRun>();
  for (const r of runs) {
    if (r.head_sha.toLowerCase() !== head) continue;
    const seen = byName.get(r.name);
    if (!seen || r.id > seen.id) byName.set(r.name, r);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function ciVerdict(runs: readonly CiRun[]): CiVerdict {
  if (runs.length === 0) return "none";
  if (runs.some((r) => r.status !== "completed")) return "pending";
  return runs.every((r) => CI_GREEN_CONCLUSIONS.includes(r.conclusion ?? "")) ? "passed" : "failed";
}

/** `CI #412 success · DB rebuild #88 failure` — one line for the result and the handover. */
export function summariseCi(runs: readonly CiRun[]): string {
  if (runs.length === 0) return "no workflow run for this commit";
  return runs.map((r) => `${r.name} #${r.run_number} ${r.status === "completed" ? r.conclusion ?? "no conclusion" : r.status}`).join(" · ");
}

/** The step a red job died in, for the note that points at its log. */
export function firstFailedStep(job: CiJob): string | null {
  const s = (job.steps ?? []).find((x) => x.conclusion !== null && !CI_GREEN_CONCLUSIONS.includes(x.conclusion));
  return s ? s.name : null;
}

// ---- migrate-local: Apply-Migration.ps1 and Export-SupabaseSchema.ps1 ----------------

/**
 * ⚠️ **THE CONFIRMATION IS RECORDED IN GIT, AND THE RUNNER READS IT THERE.**
 * `C:\dev\CLAUDE.md` → The working contract: a migration is committed only
 * after Adrian confirms it, and the commit that adds it carries a trailer
 * quoting him:
 *
 *     Schema-Confirmed: Adrian, 2026-09-25 — „yes, go with the nullable column"
 *
 * So „a recorded confirmation" is a fact the runner can check without trusting
 * anybody's word, and it stays in the history beside the file it confirms.
 */
export const SCHEMA_CONFIRMED_TRAILER = "Schema-Confirmed";
export const SCHEMA_CONFIRMED_RE = /^Schema-Confirmed:[ \t]*\S.*$/m;

export interface MigrateObservation {
  /** Migration file names in `src/db` that the local `schema_migrations` does not record. */
  pending: readonly string[];
  /** `git status --porcelain` lines that touch a `src/db/migration_*.sql`. */
  dirtyMigrations: readonly string[];
  /** Per pending file: the full message of the commit that added it, or null when HEAD's history never added it. */
  addingCommitMessage: Readonly<Record<string, string | null>>;
}

/**
 * ⚠️ **ONLY WHAT IS COMMITTED AND CONFIRMED REACHES THE DATABASE.**
 * `Apply-Migration.ps1` applies every file in `src\db` that the database has not
 * recorded — including one that exists only in the working tree. Under Propus.3
 * the working tree is exactly where an UNCONFIRMED migration lives while Claude
 * builds on it, so the runner refuses the whole run while any migration file is
 * uncommitted or changed, and while any pending one lacks the trailer.
 */
export function decideMigrateLocal(o: MigrateObservation): GuardDecision<{ apply: string[] }> {
  if (o.dirtyMigrations.length > 0) {
    return {
      ok: false,
      code: "migration-dirty",
      message: `Migration files differ from HEAD (${o.dirtyMigrations.join(" · ")}). Apply-Migration.ps1 would apply the working tree, and an unconfirmed migration lives there. Commit it with its ${SCHEMA_CONFIRMED_TRAILER} trailer once Adrian confirms.`,
    };
  }
  const pending = [...o.pending].sort();
  if (pending.length === 0) return { ok: true, apply: [] };
  const notInHistory = pending.filter((f) => (o.addingCommitMessage[f] ?? null) === null);
  if (notInHistory.length > 0) {
    return {
      ok: false,
      code: "migration-uncommitted",
      message: `No commit in HEAD's history adds ${notInHistory.join(", ")}.`,
    };
  }
  const unconfirmed = pending.filter((f) => !SCHEMA_CONFIRMED_RE.test(o.addingCommitMessage[f] ?? ""));
  if (unconfirmed.length > 0) {
    return {
      ok: false,
      code: "migration-unconfirmed",
      message: `The commit that adds ${unconfirmed.join(", ")} carries no ${SCHEMA_CONFIRMED_TRAILER}: trailer, so Adrian's confirmation is not recorded.`,
    };
  }
  return { ok: true, apply: pending };
}

// ---- Google maps in e2e (Slice #39.14) ------------------------------------------

/**
 * ⚠️ **EVERY e2e RESULT SAYS HOW MANY REAL GOOGLE MAPS THE RUN MADE.** Google
 * bills „Dynamic Maps" per map created with the key; the runner's e2e once made
 * about 1,500 a day and Adrian found out from the bill (Slice #39.14). The e2e
 * fixture (`e2e/helpers/test.ts`) appends one JSON line per test to the file
 * named by this variable, and the runner turns the file into a note, so a spec
 * that starts loading maps again shows on the next run rather than on the next
 * bill. Adrian's own `npm run e2e` sets no variable and writes nothing.
 */
export const MAPS_LOG_ENV = "E2E_MAPS_LOG";
/** Beside the step's `e2e.log`, in `.test-runner/logs/<id>/`. */
export const MAPS_LOG_FILE = "google-maps.jsonl";

/** One test's line, written by the fixture at teardown. */
export type MapsLogLine = {
  /** The spec file, relative to `e2e/`, forward slashes. */
  spec: string;
  title: string;
  /** Google Maps was let through: the spec opted in with `test.use({ realMaps: true })`, or nothing was blocked. */
  realMaps: boolean;
  /** `new google.maps.Map(...)` calls the page-side counter saw — what Google bills. */
  maps: number;
  /** Fetches of the Maps JavaScript API's own script (`/maps/api/js`) that were let through. */
  loaders: number;
  /** Google Maps requests the fixture aborted. */
  blocked: number;
  /**
   * Slice #39.18 — Google's two other charges, counted the same way. A line written before 39.18 has none of these
   * fields: its Street View and look-ups were never counted, and they read as zero and false.
   */
  /** Street View was let through: the spec opted in with `realStreetView` as well, or nothing was blocked. */
  realStreetView: boolean;
  /** Address look-ups were let through: the spec opted in with `realAddressLookups` as well, or nothing was blocked. */
  realAddressLookups: boolean;
  /** `StreetViewPanorama` objects built — what Google bills as „Dynamic Street View". */
  streetView: number;
  /** Street View requests (imagery, metadata) let through — a cross-check on `streetView`. */
  streetViewRequests: number;
  /** Street View coverage checks and requests the fixture stopped. */
  streetViewBlocked: number;
  /** `Geocoder.geocode` calls made — what Google bills as „Geocoding". */
  addressLookups: number;
  /** Address look-ups the fixture stopped. */
  addressLookupsBlocked: number;
};

function nonNegativeInt(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

/** The file's lines; a line that is not a well-formed `MapsLogLine` is skipped, never guessed at. */
export function parseMapsLog(text: string): MapsLogLine[] {
  const out: MapsLogLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let v: unknown;
    try {
      v = JSON.parse(line);
    } catch {
      continue;
    }
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const maps = nonNegativeInt(o.maps);
    const loaders = nonNegativeInt(o.loaders);
    const blocked = nonNegativeInt(o.blocked);
    if (typeof o.spec !== "string" || typeof o.title !== "string" || typeof o.realMaps !== "boolean") continue;
    if (maps === null || loaders === null || blocked === null) continue;
    // Slice #39.18's fields: absent on an older line (zero, false); present but malformed skips the line like any other.
    const extra = {
      streetView: o.streetView === undefined ? 0 : nonNegativeInt(o.streetView),
      streetViewRequests: o.streetViewRequests === undefined ? 0 : nonNegativeInt(o.streetViewRequests),
      streetViewBlocked: o.streetViewBlocked === undefined ? 0 : nonNegativeInt(o.streetViewBlocked),
      addressLookups: o.addressLookups === undefined ? 0 : nonNegativeInt(o.addressLookups),
      addressLookupsBlocked: o.addressLookupsBlocked === undefined ? 0 : nonNegativeInt(o.addressLookupsBlocked),
    };
    if (Object.values(extra).some((n) => n === null)) continue;
    const flag = (v: unknown): boolean | null => (v === undefined ? false : typeof v === "boolean" ? v : null);
    const realStreetView = flag(o.realStreetView);
    const realAddressLookups = flag(o.realAddressLookups);
    if (realStreetView === null || realAddressLookups === null) continue;
    out.push({
      spec: o.spec,
      title: o.title,
      realMaps: o.realMaps,
      maps,
      loaders,
      blocked,
      realStreetView,
      realAddressLookups,
      streetView: extra.streetView as number,
      streetViewRequests: extra.streetViewRequests as number,
      streetViewBlocked: extra.streetViewBlocked as number,
      addressLookups: extra.addressLookups as number,
      addressLookupsBlocked: extra.addressLookupsBlocked as number,
    });
  }
  return out;
}

/**
 * The note on the e2e step. `null` is "no file": the fixture never ran, or the
 * commit predates it — said as such, never as zero.
 */
export function mapsNote(lines: MapsLogLine[] | null): string {
  if (lines === null) return `Google maps loaded: not counted — no ${MAPS_LOG_FILE} (the e2e fixture wrote none)`;
  const maps = lines.reduce((n, l) => n + l.maps, 0);
  const loaders = lines.reduce((n, l) => n + l.loaders, 0);
  const blocked = lines.reduce((n, l) => n + l.blocked, 0);
  const real = lines.filter((l) => l.realMaps);
  const specs = [...new Set(real.map((l) => l.spec))].sort();
  const withMaps = [...new Set(lines.filter((l) => l.maps > 0).map((l) => l.spec))].sort();
  const strays = withMaps.filter((s) => !specs.includes(s));
  return (
    `Google maps loaded: ${maps}` +
    ` (Maps JavaScript API fetched ${loaders}×; ${blocked} Google Maps requests blocked;` +
    ` ${lines.length} tests, ${real.length} with real maps in ${specs.length} specs` +
    (specs.length && specs.length <= 12 ? `: ${specs.join(", ")}` : "") +
    ")" +
    (strays.length ? `; ⚠️ maps made by specs that did not opt in: ${strays.join(", ")}` : "")
  );
}

/**
 * Slice #39.18 — the note beside „Google maps loaded: N": „Street View panoramas: N · address look-ups: N", the
 * specs that made them, and — loudest — any made by a spec that did not opt in for that kind.
 */
export function streetViewLookupsNote(lines: MapsLogLine[] | null): string {
  if (lines === null) return `Street View panoramas · address look-ups: not counted — no ${MAPS_LOG_FILE} (the e2e fixture wrote none)`;
  const sum = (k: "streetView" | "streetViewRequests" | "streetViewBlocked" | "addressLookups" | "addressLookupsBlocked"): number =>
    lines.reduce((n, l) => n + l[k], 0);
  const specsWhere = (f: (l: MapsLogLine) => boolean): string[] => [...new Set(lines.filter(f).map((l) => l.spec))].sort();
  const list = (specs: string[]): string => (specs.length === 0 ? "none" : specs.length <= 12 ? specs.join(", ") : `${specs.length} specs`);
  const svOptIn = specsWhere((l) => l.realStreetView);
  const alOptIn = specsWhere((l) => l.realAddressLookups);
  const svMade = specsWhere((l) => l.streetView > 0 || l.streetViewRequests > 0);
  const alMade = specsWhere((l) => l.addressLookups > 0);
  const svStrays = svMade.filter((s) => !svOptIn.includes(s));
  const alStrays = alMade.filter((s) => !alOptIn.includes(s));
  return (
    `Street View panoramas: ${sum("streetView")} · address look-ups: ${sum("addressLookups")}` +
    ` (${sum("streetViewRequests")} Street View requests let through; blocked: ${sum("streetViewBlocked")} Street View, ${sum("addressLookupsBlocked")} look-ups;` +
    ` let through for Street View: ${list(svOptIn)}; for look-ups: ${list(alOptIn)}` +
    (svMade.length ? `; Street View made by: ${list(svMade)}` : "") +
    (alMade.length ? `; look-ups made by: ${list(alMade)}` : "") +
    ")" +
    (svStrays.length ? `; ⚠️ Street View made by specs that did not opt in: ${svStrays.join(", ")}` : "") +
    (alStrays.length ? `; ⚠️ address look-ups made by specs that did not opt in: ${alStrays.join(", ")}` : "")
  );
}

// ---- the tests' monthly ceiling on real Google maps (Slice #39.16) ------------------------

/**
 * ⚠️ **THE TESTS MAY MAKE AT MOST THIS MANY REAL MAPS IN A CALENDAR MONTH.**
 * Google's first 10,000 „Dynamic Maps" a month are free and then each costs
 * US$7 per 1,000 (#39.14). The tests and the people using the app draw on the
 * same 10,000, so the tests keep to 3,000 and leave 7,000 for Adrian and
 * Ciprian. Once the month's count reaches it, the runner tells the e2e fixture
 * (`MAPS_CEILING_ENV`), which blocks real maps for EVERY test — and a spec that
 * opted in with `realMaps: true` is SKIPPED with this ceiling named, never
 * failed. Change the number here and nowhere else.
 */
export const MAPS_MONTHLY_CEILING = 3_000;
/** Google's free „Dynamic Maps" a month, shared by the tests and the app's users. */
export const MAPS_FREE_PER_MONTH = 10_000;
/** Set by the runner for its e2e run when the ceiling is reached; its value is the reason the skipped specs show. */
export const MAPS_CEILING_ENV = "E2E_MAPS_CEILING";
/** Under `CHANNEL_DIR`: the month's running count, kept because result files are pruned. */
export const MAPS_LEDGER_FILE = "google-maps-month.json";
/**
 * Google's billing day — and so its month — is US Pacific time, not Toronto's
 * (the Cloud console reports in Pacific time). The month is counted the way
 * Google counts it.
 */
export const MAPS_BILLING_TIME_ZONE = "America/Los_Angeles";

export interface MapsLedger {
  /** `YYYY-MM`, in Google's billing time zone. */
  month: string;
  /** Real maps the runner's tests made this month, plus any `seeded` count. */
  maps: number;
  /** Street View panoramas the runner's tests built this month (Slice #39.18; a ledger written before it reads 0). */
  streetView: number;
  /** Address look-ups the runner's tests made this month (Slice #39.18; a ledger written before it reads 0). */
  addressLookups: number;
  /** The run ids already counted, so a run is never counted twice. */
  runs: string[];
  /** A starting count written by hand for a month whose early runs were never counted, and why. */
  seeded?: { maps: number; note: string };
}

/** `YYYY-MM` of `at` in Google's billing time zone. */
export function mapsMonth(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: MAPS_BILLING_TIME_ZONE, year: "numeric", month: "2-digit" }).formatToParts(at);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  return `${y}-${m}`;
}

/** The ledger as it stands for `month`: a ledger of an earlier month counts as nothing. */
export function mapsUsed(ledger: MapsLedger | null, month: string): number {
  return ledger && ledger.month === month ? ledger.maps : 0;
}

/**
 * The ledger after one run's maps — and, since Slice #39.18, its Street View panoramas and address look-ups — are
 * added. Idempotent per run id; a new month starts at zero.
 */
export function addToMapsLedger(
  ledger: MapsLedger | null,
  month: string,
  runId: string,
  maps: number,
  extras: { streetView?: number; addressLookups?: number } = {},
): MapsLedger {
  const current: MapsLedger = ledger && ledger.month === month ? ledger : { month, maps: 0, streetView: 0, addressLookups: 0, runs: [] };
  const sv = extras.streetView ?? 0;
  const al = extras.addressLookups ?? 0;
  const ok = (n: number): boolean => Number.isInteger(n) && n >= 0;
  if (current.runs.includes(runId) || !ok(maps) || !ok(sv) || !ok(al)) return current;
  return {
    ...current,
    maps: current.maps + maps,
    streetView: current.streetView + sv,
    addressLookups: current.addressLookups + al,
    runs: [...current.runs, runId],
  };
}

/** Whether this month's e2e may still make real maps, and the line every result carries about it. */
export function mapsCeiling(ledger: MapsLedger | null, month: string): { reached: boolean; used: number; note: string } {
  const used = mapsUsed(ledger, month);
  const reached = used >= MAPS_MONTHLY_CEILING;
  const fmt = (n: number): string => n.toLocaleString("en-US");
  const seeded = ledger && ledger.month === month && ledger.seeded ? ` (${fmt(ledger.seeded.maps)} of them estimated: ${ledger.seeded.note})` : "";
  return {
    reached,
    used,
    note: reached
      ? `Google maps this month (${month}): ${fmt(used)}${seeded} — the tests' ceiling of ${fmt(MAPS_MONTHLY_CEILING)} is reached, so real maps are blocked for every test and the map specs are skipped until the month ends`
      : `Google maps this month (${month}): ${fmt(used)} of the tests' ceiling of ${fmt(MAPS_MONTHLY_CEILING)}${seeded} — Google's free ${fmt(MAPS_FREE_PER_MONTH)} are shared with the people using the app`,
  };
}

/** The reason a skipped map spec shows. */
export function mapsCeilingSkipReason(used: number, month: string): string {
  return `Google maps ceiling reached: the tests made ${used.toLocaleString("en-US")} real maps in ${month}, and allow themselves ${MAPS_MONTHLY_CEILING.toLocaleString("en-US")} a month (scripts/test-runner/protocol.ts → MAPS_MONTHLY_CEILING)`;
}

/** The maps one run's log adds up to. */
export function mapsInLog(lines: readonly MapsLogLine[]): number {
  return lines.reduce((n, l) => n + l.maps, 0);
}

/** A ledger read from disk, or null when it is not one. */
export function parseMapsLedger(text: string): MapsLedger | null {
  try {
    const o = JSON.parse(text.replace(/^﻿/, "")) as Partial<MapsLedger>;
    if (typeof o.month !== "string" || !/^\d{4}-\d{2}$/.test(o.month)) return null;
    if (typeof o.maps !== "number" || !Number.isInteger(o.maps) || o.maps < 0) return null;
    if (!Array.isArray(o.runs) || !o.runs.every((r) => typeof r === "string")) return null;
    // Slice #39.18: a ledger written before it has no Street View or look-up count — they read as zero.
    const count = (v: unknown): number | null => (v === undefined ? 0 : typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
    const streetView = count(o.streetView);
    const addressLookups = count(o.addressLookups);
    if (streetView === null || addressLookups === null) return null;
    const seeded =
      o.seeded && typeof o.seeded.maps === "number" && typeof o.seeded.note === "string" ? { maps: o.seeded.maps, note: o.seeded.note } : undefined;
    return { month: o.month, maps: o.maps, streetView, addressLookups, runs: o.runs, ...(seeded ? { seeded } : {}) };
  } catch {
    return null;
  }
}

// ---- the same ceiling for Street View panoramas and address look-ups (Slice #39.18) ----------------

/**
 * ⚠️ **AND THE SAME FOR GOOGLE'S TWO OTHER CHARGES.** A Street View panorama is billed as „Dynamic Street View" —
 * 5,000 free a month, then US$14 per 1,000 — and an address look-up as „Geocoding" — 10,000 free a month, then
 * US$5 per 1,000 (developers.google.com/maps/billing-and-pricing/pricing, read 2026-10-13). Each allowance is its
 * own, apart from the maps' 10,000, and each is shared with the people using the app. The tests keep to the share
 * 39.16 gave the maps — 30 % of the allowance — and leave the rest for Adrian and Ciprian. Past a kind's ceiling
 * the runner sets that kind's variable: the kind is blocked for EVERY test, and a spec that opted in for it is
 * SKIPPED with the ceiling named, never failed. Change a number here and nowhere else.
 */
export const STREET_VIEW_MONTHLY_CEILING = 1_500;
/** Google's free „Dynamic Street View" panoramas a month, shared by the tests and the app's users. */
export const STREET_VIEW_FREE_PER_MONTH = 5_000;
export const ADDRESS_LOOKUPS_MONTHLY_CEILING = 3_000;
/** Google's free „Geocoding" requests a month, shared by the tests and the app's users. */
export const ADDRESS_LOOKUPS_FREE_PER_MONTH = 10_000;
/** Set by the runner for its e2e run when that kind's ceiling is reached; the value is the skipped specs' reason. */
export const STREET_VIEW_CEILING_ENV = "E2E_STREET_VIEW_CEILING";
export const ADDRESS_LOOKUPS_CEILING_ENV = "E2E_ADDRESS_LOOKUPS_CEILING";

export type GoogleExtraKind = "streetView" | "addressLookups";

const EXTRA: Record<GoogleExtraKind, { ceiling: number; free: number; counted: string; blocked: string; ceilingName: string; constant: string }> = {
  streetView: {
    ceiling: STREET_VIEW_MONTHLY_CEILING,
    free: STREET_VIEW_FREE_PER_MONTH,
    counted: "Street View panoramas",
    blocked: "Street View is blocked for every test and the specs that opted in for it are skipped",
    ceilingName: "Street View ceiling reached",
    constant: "STREET_VIEW_MONTHLY_CEILING",
  },
  addressLookups: {
    ceiling: ADDRESS_LOOKUPS_MONTHLY_CEILING,
    free: ADDRESS_LOOKUPS_FREE_PER_MONTH,
    counted: "address look-ups",
    blocked: "address look-ups are blocked for every test and the specs that opted in for them are skipped",
    ceilingName: "Address look-up ceiling reached",
    constant: "ADDRESS_LOOKUPS_MONTHLY_CEILING",
  },
};

/** The kind's count as it stands for `month`: a ledger of an earlier month counts as nothing. */
export function extraUsed(ledger: MapsLedger | null, month: string, kind: GoogleExtraKind): number {
  return ledger && ledger.month === month ? (ledger[kind] ?? 0) : 0;
}

/** Whether this month's e2e may still let the kind through, and the line every result carries about it. */
export function extraCeiling(ledger: MapsLedger | null, month: string, kind: GoogleExtraKind): { reached: boolean; used: number; note: string } {
  const k = EXTRA[kind];
  const used = extraUsed(ledger, month, kind);
  const reached = used >= k.ceiling;
  const fmt = (n: number): string => n.toLocaleString("en-US");
  const label = k.counted.charAt(0).toUpperCase() + k.counted.slice(1);
  return {
    reached,
    used,
    note: reached
      ? `${label} this month (${month}): ${fmt(used)} — the tests' ceiling of ${fmt(k.ceiling)} is reached, so ${k.blocked} until the month ends`
      : `${label} this month (${month}): ${fmt(used)} of the tests' ceiling of ${fmt(k.ceiling)} — Google's free ${fmt(k.free)} are shared with the people using the app`,
  };
}

/** The reason a spec that opted in for the kind shows when it is skipped. */
export function extraCeilingSkipReason(kind: GoogleExtraKind, used: number, month: string): string {
  const k = EXTRA[kind];
  const fmt = (n: number): string => n.toLocaleString("en-US");
  return `${k.ceilingName}: the tests made ${fmt(used)} ${k.counted} in ${month}, and allow themselves ${fmt(k.ceiling)} a month (scripts/test-runner/protocol.ts → ${k.constant})`;
}

/** The Street View panoramas and address look-ups one run's log adds up to. */
export function extrasInLog(lines: readonly MapsLogLine[]): { streetView: number; addressLookups: number } {
  return {
    streetView: lines.reduce((n, l) => n + l.streetView, 0),
    addressLookups: lines.reduce((n, l) => n + l.addressLookups, 0),
  };
}
