#!/usr/bin/env bash
# Claude's side of the test runner protocol (Slices Propus.2, Propus.3). Runs in
# the device VM, over the bridge; the runner itself runs on Windows (runner.ts).
#
#   claude.sh request <sequence> [only-path ...]   write a request for HEAD; prints its id
#   claude.sh request reconcile <folder>           the one sequence with an argument: a folder
#                                                  NAME under C:\dev\TEST.DATA\Test.Claude\ (#36.22)
#   claude.sh wait <id> [seconds]                  poll its result (default 170 s, inside the 180 s cap)
#   claude.sh show <id>                            print a result as it stands
#   claude.sh ping [seconds]                       request + wait for the sequence that runs nothing
#
# Sequences: ping · full · full-db · static · e2e · jest · verify-rebuild
#            push (main, fast-forward, on a green full) · ci (read Actions for HEAD)
#            migrate-local (Apply-Migration + Export-SupabaseSchema, confirmed migrations only)
#            reconcile <folder> (what became of every file of that folder after an import; read-only)
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
    out.push(`runner result ${r.id}: ${String(r.status).toUpperCase()} — sequence ${r.sequence ?? "?"} on ${r.commit ? r.commit.slice(0, 7) : "?"}${r.only ? ` (only ${r.only.join(", ")})` : ""}${r.folder ? ` (folder ${r.folder})` : ""}`);
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

status_of() { node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).status)}catch{console.log("unreadable")}' "$1"; }

request() {
  local seq="$1"; shift
  local head; head="$(git -C "$repo" rev-parse HEAD)" || { echo "git rev-parse HEAD failed" >&2; return 2; }
  local id; id="$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"
  local folder=""
  if [ "$seq" = "reconcile" ]; then
    [ $# -ge 1 ] || { echo "usage: claude.sh request reconcile <folder>" >&2; return 2; }
    folder="$1"; shift
  fi
  mkdir -p "$ch/requests"
  node -e '
    const [id, seq, commit, folder, ...only] = process.argv.slice(1);
    const r = { version: 1, id, sequence: seq, commit };
    if (only.length) r.only = only;
    if (folder) r.folder = folder;
    process.stdout.write(JSON.stringify(r));
  ' "$id" "$seq" "$head" "$folder" "$@" > "$ch/requests/$id.json.tmp" || return 2
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
  *)       sed -n '2,17p' "$0"; exit 2 ;;
esac
