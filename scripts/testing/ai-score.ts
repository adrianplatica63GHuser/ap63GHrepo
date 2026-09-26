/**
 * How well the AI reads a document type, as one number.        (Slice #36.23, FU-073)
 *
 *   npx tsx scripts/testing/ai-score.ts "C:\dev\TEST.DATA\Test.Claude\ai-corpus\cvc" --read-cap 10
 *
 * Normally run by the test runner's `ai-score` sequence
 * (`bash scripts/test-runner/claude.sh request ai-score cvc 10`), which accepts only
 * a corpus folder directly under `C:\dev\TEST.DATA\Test.Claude\ai-corpus\` and a
 * read cap no smaller than the corpus. It is never part of `full` and never runs
 * in CI: every contract is one paid read.
 *
 * ⚠️ **THE APPLICATION'S CODE, NEVER A COPY OF IT.** The prompt is
 * `buildExtractSystemPrompt`, the pages → blocks → request → answer path is
 * `@/lib/documents/ai-extract` — the same functions `ai-interpret` calls — and
 * the template and the role names come from the local database, as the route
 * reads them. A harness that re-built the prompt would score itself.
 *
 * ⚠️ **REAL PEOPLE'S PAPERWORK.** The corpus and its `expected.json` answer keys
 * live outside git, and so does everything this writes except what it prints:
 * the printed report carries field names, counts and percentages, never a value
 * read or expected. The values go to `<corpus>\_runs\<stamp>\detail.json` and
 * the model's raw answers to `raw\`, beside the corpus.
 *
 * Reads the local database read-only (`PGOPTIONS=-c default_transaction_read_only=on`,
 * as `reconcile-import.ts` does) and `.env` for three keys only:
 * `ANTHROPIC_API_KEY` (never printed), `POSTGRES_DB`, `POSTGRES_USER`.
 *
 * Exit: 0 every contract read and scored · 2 the run could not start, or a read failed.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  buildExtractRequestBody,
  buildPageBlocks,
  callAnthropic,
  EXTRACT_MODEL,
  interpretExtractText,
  typeHintTextFor,
  type ExtractPage,
} from "@/lib/documents/ai-extract";
import { buildExtractSystemPrompt } from "@/lib/import/classify-prompts";
import { parseTemplateFields, type DocumentTemplateField } from "@/lib/documents/template-fields";
import {
  percent,
  scoreContract,
  summarise,
  type ExpectedContract,
  type FieldKind,
  type ItemResult,
  type ScoreSummary,
} from "@/lib/ai-score/score";

/**
 * Which document type each corpus folder is. Adding a document type is a folder
 * under `ai-corpus\` and one line here.
 */
const CORPUS_TYPES: Record<string, string> = {
  cvc: "CONTRACT_VANZARE",
};

const CONTAINER = "ga40prj-postgres";

function fail(message: string): never {
  console.error(`ai-score: ${message}`);
  console.log(`AI-SCORE: could not run — ${message}`);
  process.exit(2);
}

/** The three keys this script reads from `.env`, and nothing else. */
function readEnv(repo: string): { apiKey: string | null; database: string; user: string } {
  const out = { apiKey: null as string | null, database: "ga40db", user: "postgres" };
  const envFile = path.join(repo, ".env");
  if (!fs.existsSync(envFile)) return out;
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*(ANTHROPIC_API_KEY|POSTGRES_DB|POSTGRES_USER)\s*=\s*"?([^"#\s]+)"?/.exec(line);
    if (!m) continue;
    if (m[1] === "ANTHROPIC_API_KEY") out.apiKey = m[2];
    else if (m[1] === "POSTGRES_DB") out.database = m[2];
    else out.user = m[2];
  }
  return out;
}

type TypeRow = { key: string; name: string; templateFields: unknown; roles: string[] };

/** The type's template and role names, as `getDocumentTypeTemplate` and `listPersonRolesForDocumentType` read them. */
function readType(typeKey: string, database: string, user: string): TypeRow {
  const sql = `SELECT json_build_object(
  'key', dt.key,
  'name', dt.name,
  'templateFields', dt.template_fields,
  'roles', COALESCE((SELECT json_agg(pr.name ORDER BY pr.name)
                       FROM lookup_doc_type_person_role x
                       JOIN lookup_person_role pr ON pr.id = x.person_role_id
                      WHERE x.document_type_id = dt.id), '[]'::json))
FROM lookup_document_type dt WHERE dt.key = '${typeKey.replace(/'/g, "''")}';`;
  const r = spawnSync(
    "docker",
    [
      "exec", "-i",
      "-e", "PGOPTIONS=-c default_transaction_read_only=on",
      "-e", "PGCLIENTENCODING=UTF8",
      CONTAINER,
      "psql", "-U", user, "-d", database, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1",
    ],
    { input: sql, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, windowsHide: true },
  );
  if (r.error) fail(`could not start docker: ${r.error.message}`);
  if (r.status !== 0) fail(`psql exited ${r.status}: ${(r.stderr || "").trim().split(/\r?\n/).slice(-3).join(" | ")}`);
  const text = (r.stdout || "").trim();
  if (text === "") fail(`no document type ${typeKey} in the local database`);
  try {
    return JSON.parse(text) as TypeRow;
  } catch (e) {
    fail(`the type query's answer was not JSON: ${(e as Error).message}`);
  }
}

function gitHead(repo: string): string {
  const r = spawnSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

/**
 * What the model is told, as a short hash: the model, the system prompt, the
 * token ceiling and the closing instruction (with the page count taken out).
 * Two runs with one fingerprint asked the same question.
 */
function promptFingerprint(systemPrompt: string, typeHintText: string): string {
  const body = buildExtractRequestBody({
    isDiscover: false,
    systemPrompt,
    fileBlocks: [{ type: "text", text: "" }],
    typeHintText,
  }) as { model: string; max_tokens: number; system: string; messages: { content: { text?: string }[] }[] };
  const closing = (body.messages[0].content.at(-1)?.text ?? "").replace(/\d+ page\(s\)/, "N page(s)");
  return createHash("sha256")
    .update(JSON.stringify({ model: body.model, max_tokens: body.max_tokens, system: body.system, closing }))
    .digest("hex")
    .slice(0, 12);
}

type Contract = { id: string; dir: string; expected: ExpectedContract; pages: string[] };

function listContracts(corpus: string): Contract[] {
  const out: Contract[] = [];
  for (const e of fs.readdirSync(corpus, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith("_")) continue;
    const dir = path.join(corpus, e.name);
    const keyFile = path.join(dir, "expected.json");
    if (!fs.existsSync(keyFile)) continue;
    let expected: ExpectedContract;
    try {
      expected = JSON.parse(fs.readFileSync(keyFile, "utf8").replace(/^\uFEFF/, "")) as ExpectedContract;
    } catch (err) {
      fail(`${e.name}\\expected.json is not JSON: ${(err as Error).message}`);
    }
    const pageDir = path.join(dir, "pages");
    const pages = fs.existsSync(pageDir)
      ? fs
          .readdirSync(pageDir, { withFileTypes: true })
          .filter((p) => p.isFile() && p.name.toLowerCase() !== "desktop.ini")
          .map((p) => p.name)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      : [];
    if (pages.length === 0) fail(`${e.name} has no pages\\ folder, or it is empty`);
    out.push({ id: expected.id || e.name, dir, expected, pages });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

function table(title: string, s: ScoreSummary): string[] {
  const lines = [`${title}: ${percent(s.score)} (${s.correct}/${s.total} items, ${s.contracts} contract${s.contracts === 1 ? "" : "s"})`];
  for (const f of s.perField) {
    lines.push(`  ${f.field.padEnd(26)} ${percent(f.accuracy).padStart(6)}  ${f.correct}/${f.total}`);
  }
  return lines;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const capAt = args.indexOf("--read-cap");
  const readCap = capAt >= 0 ? Number(args[capAt + 1]) : NaN;
  const corpusArg = args.find((a, i) => !a.startsWith("--") && i !== capAt + 1);
  if (!corpusArg || !Number.isInteger(readCap) || readCap < 1) {
    fail('usage: npx tsx scripts/testing/ai-score.ts "<corpus folder>" --read-cap <n>');
  }
  const corpus = path.resolve(corpusArg);
  if (!fs.existsSync(corpus) || !fs.statSync(corpus).isDirectory()) fail(`not a folder: ${corpus}`);
  const corpusName = path.basename(corpus);
  const typeKey = CORPUS_TYPES[corpusName.toLowerCase()];
  if (!typeKey) fail(`no document type is known for corpus ${corpusName} — add it to CORPUS_TYPES`);

  const repo = path.resolve(__dirname, "..", "..");
  const env = readEnv(repo);
  if (!env.apiKey) fail("ANTHROPIC_API_KEY is not set in .env");

  const contracts = listContracts(corpus);
  if (contracts.length === 0) fail(`no contract folder with an expected.json under ${corpus}`);
  // ⚠️ Before any money is spent: the whole corpus, or nothing.
  if (contracts.length > readCap) {
    fail(`the corpus holds ${contracts.length} contracts and the read cap is ${readCap}; nothing was read`);
  }

  const type = readType(typeKey, env.database, env.user);
  const templateFields: DocumentTemplateField[] = parseTemplateFields(type.templateFields);
  const kinds: Record<string, FieldKind> = Object.fromEntries(
    templateFields.map((f) => [f.key, f.type === "textarea" ? "text" : (f.type as FieldKind)]),
  );
  const systemPrompt = buildExtractSystemPrompt(templateFields, type.roles);
  const typeHintText = typeHintTextFor({ name: type.name, key: type.key });
  const fingerprint = promptFingerprint(systemPrompt, typeHintText);
  const commit = gitHead(repo);

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const outDir = path.join(corpus, "_runs", stamp);
  fs.mkdirSync(path.join(outDir, "raw"), { recursive: true });

  console.log(`ai-score ${corpusName}: ${contracts.length} contracts, read cap ${readCap}, commit ${commit.slice(0, 7)}, model ${EXTRACT_MODEL}, prompt ${fingerprint}`);
  console.log(`  template ${type.key}: ${templateFields.length} fields; roles: ${type.roles.length}`);

  const items: ItemResult[] = [];
  const failed: string[] = [];
  const notes: string[] = [];
  let reads = 0;

  for (const c of contracts) {
    const pages: ExtractPage[] = c.pages.map((fileName) => ({ fileName, mimeType: null }));
    const blocks = await buildPageBlocks(pages, async (p) => fs.readFileSync(path.join(c.dir, "pages", p.fileName)));
    if (blocks.fileBlocks.length === 0) {
      failed.push(`${c.id}: no page the model can read`);
      continue;
    }
    const body = buildExtractRequestBody({ isDiscover: false, systemPrompt, fileBlocks: blocks.fileBlocks, typeHintText });
    const t0 = Date.now();
    reads += 1;
    const answer = await callAnthropic(env.apiKey as string, body, blocks.extraHeaders);
    const secs = Math.round((Date.now() - t0) / 1000);
    if (!answer.ok) {
      const why = answer.kind === "http" ? `HTTP ${answer.status} ${answer.code}` : "no text in the answer";
      failed.push(`${c.id}: ${why}`);
      console.log(`  ${c.id}: ${blocks.fileBlocks.length} page(s), ${secs} s — READ FAILED: ${why}`);
      if (answer.kind === "http" && (answer.code === "insufficient_credits" || answer.code === "invalid_api_key")) break;
      continue;
    }
    fs.writeFileSync(path.join(outDir, "raw", `${c.id}.txt`), answer.textBlock, "utf8");
    if (answer.hitOutputLimit) notes.push(`${c.id}: the answer hit the output-token limit`);
    let interpreted: ReturnType<typeof interpretExtractText>;
    try {
      interpreted = interpretExtractText(answer.textBlock, templateFields);
    } catch (e) {
      failed.push(`${c.id}: the answer was not JSON (${(e as Error).message})`);
      console.log(`  ${c.id}: ${blocks.fileBlocks.length} page(s), ${secs} s — ANSWER NOT JSON`);
      continue;
    }
    const scored = scoreContract(c.expected, interpreted, kinds);
    items.push(...scored);
    const ok = scored.filter((i) => i.ok).length;
    console.log(`  ${c.id} [${c.expected.status}]: ${blocks.fileBlocks.length} page(s), ${secs} s — ${ok}/${scored.length}`);
  }

  const confirmedIds = new Set(contracts.filter((c) => c.expected.status === "confirmed").map((c) => c.id));
  const all = summarise(items);
  const confirmed = summarise(items.filter((i) => confirmedIds.has(i.contract)));

  const summary = {
    corpus: corpusName,
    documentType: type.key,
    date: new Date().toISOString(),
    commit,
    model: EXTRACT_MODEL,
    promptFingerprint: fingerprint,
    reads,
    readCap,
    contracts: contracts.length,
    confirmedContracts: confirmedIds.size,
    failed,
    notes,
    confirmed,
    all,
  };
  // Counts only — the same no-personal-data shape as the printed report.
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
  // The values: outside git, beside the corpus, never printed.
  fs.writeFileSync(path.join(outDir, "detail.json"), JSON.stringify(items, null, 2) + "\n", "utf8");

  console.log("");
  for (const l of table(`confirmed only (${confirmedIds.size} of ${contracts.length})`, confirmed)) console.log(l);
  console.log("");
  for (const l of table(`all contracts, confirmed or proposed (${contracts.length})`, all)) console.log(l);
  for (const f of failed) console.log(`  not scored: ${f}`);
  for (const n of notes) console.log(`  note: ${n}`);
  console.log(`  run files (outside git): ${outDir}`);
  console.log(
    `AI-SCORE: ${percent(confirmed.score)} over ${confirmedIds.size} confirmed · all ${contracts.length}: ${percent(all.score)} · prompt ${fingerprint} · ${reads} reads of cap ${readCap}${failed.length ? ` · ${failed.length} not scored` : ""}`,
  );
  process.exit(failed.length > 0 ? 2 : 0);
}

main().catch((e: unknown) => fail((e as Error).stack ?? String(e)));
