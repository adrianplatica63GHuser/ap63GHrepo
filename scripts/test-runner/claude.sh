#!/usr/bin/env bash
# Claude's side of the test runner protocol (Slices Propus.2, Propus.3). Runs in
# the device VM, over the bridge; the runner itself runs on Windows (runner.ts).
#
#   claude.sh request <sequence> [only-path ...]   write a request for HEAD; prints its id
#   claude.sh request targeted [only-path ...]     what a slice runs (#39.15): lint + tsc whole, e2e
#                                                  and jest ONLY the paths named — none named, none run
#   claude.sh request reconcile <folder>           a sequence with an argument: a folder
#                                                  NAME under C:\dev\TEST.DATA\Test.Claude\ (#36.22)
#   claude.sh request ai-score <corpus> <readCap>  score the AI's reading of a corpus under
#                                                  Test.Claude\ai-corpus\ — SPENDS one read per
#                                                  contract; readCap >= the corpus's size (#36.23)
#   claude.sh request ai-rescore <corpus>          score earlier runs' saved answers again; no reads
#   claude.sh wait <id> [seconds]                  poll its result (default 170 s, inside the 180 s cap)
#   claude.sh show <id>                            print a result as it stands
#   claude.sh ping [seconds]                       request + wait for the sequence that runs nothing
#   claude.sh regression                           the last whole regression run, when the next is
#                                                  due, and that run's result (#39.15)
#
# Sequences: ping · targeted · full · full-db · static · e2e · jest · verify-rebuild
#            targeted is what a slice runs; full is the whole regression — every two weeks, started
#            by the runner itself when idle (auto-<time>-full), or when a header says „Regression: full"
#            push (main, fast-forward, on a green targeted or full) · ci (read Actions for HEAD)
#            migrate-local (backup, Apply-Migration + Export-SupabaseSchema, committed migrations only)
#            reconcile <folder> (what became of every file of that folder after an import; read-only)
#            ai-score <corpus> <readCap> (paid: the app's own extraction over a labelled corpus, scored)
#            ai-rescore <corpus> (free: the saved answers of every earlier run, scored again)
#            forms-export (every document type's form, read from the local database, written
#                          to src/db/document-type-forms.json; full ends with forms-drift) (#37.05)
#            backup (the archive — live database read, dump + pages + manifest into OneDrive, 14 days kept)
#            restore-drill (the newest backup restored beside live on 5434 + the app on 3200,
#                           every row and file reconciled, torn down) (#37.11)
#            migrate-local backs up first. The runner also backs up daily and drills monthly on its own.
#            measure-fields (how long the archive's values are, per field on the detail screens;
#                            read-only, longest values masked; the table is the log) (#37.12)
#            seed-rehearsal (the newest backup restored on 5434, the big dev seed run, refused a second
#                            time, removed; every table counted before and after) (#39.21)
#
# wait/ping exit: 0 passed · 1 failed · 2 error · 3 refused · 4 still running · 5 no result yet
#                 6 held — a guard said this waits for Adrian; the step's summary names why
#
# It POLLS A FILE, never a process: the VM cannot see Windows processes, and a
# pgrep would match its own command line (sandbox-and-toolchain.md).
set -u
repo="$(cd "$(dirname "$0")/../.." && pwd)"
ch="$repo/.test-runner"
cmd="${1:-}"; shift || true

show() {
  node -e '
    const fs = require("fs");
    const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const out = [];
    out.push(`runner result ${r.id}: ${String(r.status).toUpperCase()} — sequence ${r.sequence ?? "?"} on ${r.commit ? r.commit.slice(0, 7) : "?"}${r.only ? ` (only ${r.only.join(", ")})` : ""}${r.folder ? ` (folder ${r.folder})` : ""}${r.readCap ? ` (read cap ${r.readCap})` : ""}`);
    if (r.refusal) out.push(`  refused: ${r.refusal.code} — ${r.refusal.message}`);
    for (const s of r.steps || []) {
      out.push(`  ${s.name.padEnd(15)} ${s.status.padEnd(10)} ${s.seconds === null ? "" : s.seconds + " s  "}${s.summary}`);
      for (const n of s.notes || []) out.push(`  ${"".padEnd(15)} note: ${n}`);
      if (s.log && s.status !== "passed" && s.status !== "skipped" && s.status !== "held") out.push(`  ${"".padEnd(15)} log: ${s.log}`);
    }
    if (r.dirty && r.dirty.length) out.push(`  working tree beyond HEAD: ${r.dirty.join(" · ")}`);
    out.push(`  received ${r.receivedAt}, finished ${r.finishedAt ?? "-"}, runner pid ${r.runner?.pid ?? "?"} on ${r.runner?.host ?? "?"}`);
    console.log(out.join("\n"));
  ' "$1"
}

# The schedule: November 4, 2026 (Toronto midnight), then every 14 days (Adrian, 2026-10-12).
# The newest whole regression: `.test-runner/regression.json` (the runner's record, which outlives
# result pruning) or the newest whole full/full-db result file, whichever is later. The test mirrors
# protocol.ts → isWholeRegression; keep the two together. (#39.15)
regression() {
  node -e '
    const fs = require("fs"), path = require("path");
    const ch = process.argv[1], days = 14, first = "2026-11-04T05:00:00.000Z";
    const runs = [];
    try { const r = JSON.parse(fs.readFileSync(path.join(ch, "regression.json"), "utf8")); if (r.id && r.finishedAt) runs.push(r); } catch {}
    let files = [];
    try { files = fs.readdirSync(path.join(ch, "results")).filter((f) => f.endsWith(".json")); } catch {}
    for (const f of files) {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(ch, "results", f), "utf8"));
        if (r.source === "runner" && (r.sequence === "full" || r.sequence === "full-db") && !r.only &&
            (r.status === "passed" || r.status === "failed") && r.finishedAt) runs.push({ id: r.id, status: r.status, finishedAt: r.finishedAt });
      } catch {}
    }
    runs.sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
    const last = runs[0];
    // The schedule (protocol.ts → regressionDueAt): the first of first + k × 14 days after the last whole run.
    const step = days * 86400000, f0 = Date.parse(first), t = last ? Date.parse(last.finishedAt) : NaN;
    const due = new Date(Number.isNaN(t) || t < f0 ? f0 : f0 + (Math.floor((t - f0) / step) + 1) * step);
    if (!last) { console.log(`no whole regression run on record — next due: ${due.toISOString()}`); process.exit(0); }
    console.log(`last whole regression: ${last.id} — ${String(last.status).toUpperCase()}, finished ${last.finishedAt}`);
    console.log(`next due: ${due.toISOString()}${due.getTime() <= Date.now() ? " (due now: the runner starts it when idle on a clean tree)" : ""}`);
    console.log(last.id);
  ' "$ch" | {
    IFS= read -r a && echo "$a"; IFS= read -r b && echo "$b"; IFS= read -r id || exit 0
    [ -f "$ch/results/$id.json" ] && show "$ch/results/$id.json" || echo "  (its result file has been pruned; regression.json keeps only the date and verdict)"
  }
}

status_of() { node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).status)}catch{console.log("unreadable")}' "$1"; }

request() {
  local seq="$1"; shift
  local head; head="$(git -C "$repo" rev-parse HEAD)" || { echo "git rev-parse HEAD failed" >&2; return 2; }
  local id; id="$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"
  local folder="" cap=""
  if [ "$seq" = "reconcile" ] || [ "$seq" = "ai-rescore" ]; then
    [ $# -ge 1 ] || { echo "usage: claude.sh request $seq <folder>" >&2; return 2; }
    folder="$1"; shift
  fi
  if [ "$seq" = "ai-score" ]; then
    [ $# -ge 2 ] || { echo "usage: claude.sh request ai-score <corpus> <readCap>" >&2; return 2; }
    folder="$1"; cap="$2"; shift 2
  fi
  mkdir -p "$ch/requests"
  node -e '
    const [id, seq, commit, folder, cap, ...only] = process.argv.slice(1);
    const r = { version: 1, id, sequence: seq, commit };
    if (only.length) r.only = only;
    if (folder) r.folder = folder;
    if (cap) r.readCap = Number(cap);
    process.stdout.write(JSON.stringify(r));
  ' "$id" "$seq" "$head" "$folder" "$cap" "$@" > "$ch/requests/$id.json.tmp" || return 2
  mv -f "$ch/requests/$id.json.tmp" "$ch/requests/$id.json"   # the runner reads only *.json: rename is the commit point
  echo "$id"
}

wait_for() {
  local id="$1" secs="${2:-170}" f="$ch/results/$1.json" st=""
  local end=$(( $(date +%s) + secs ))
  while [ "$(date +%s)" -lt "$end" ]; do
    if [ -f "$f" ]; then
      st="$(status_of "$f")"
      case "$st" in passed|failed|error|refused|held) break ;; esac
    fi
    sleep 5
  done
  if [ ! -f "$f" ]; then
    if [ -f "$ch/requests/$id.json" ]; then echo "no result yet for $id — the request is still waiting to be picked up (is the runner alive? Install-TestRunner.ps1 -Check)"; else echo "no result yet for $id"; fi
    return 5
  fi
  show "$f"
  case "$(status_of "$f")" in passed) return 0 ;; failed) return 1 ;; error) return 2 ;; refused) return 3 ;; held) return 6 ;; *) return 4 ;; esac
}

case "$cmd" in
  request) [ $# -ge 1 ] || { echo "usage: claude.sh request <sequence> [only ...]" >&2; exit 2; }; request "$@" ;;
  wait)    [ $# -ge 1 ] || { echo "usage: claude.sh wait <id> [seconds]" >&2; exit 2; }; wait_for "$@" ;;
  show)    [ -f "$ch/results/${1:-}.json" ] || { echo "no result for ${1:-}" >&2; exit 5; }; show "$ch/results/$1.json" ;;
  ping)    id="$(request ping)" || exit 2; wait_for "$id" "${1:-20}" ;;
  regression) regression ;;
  *)       sed -n '2,40p' "$0"; exit 2 ;;
esac
