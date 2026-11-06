#!/usr/bin/env bash
# Vercel "Ignored Build Step" — wired in vercel.json → ignoreCommand.
#
# Why: Hobby counts the function bundles of EVERY deployment it keeps (30 days)
# against a 10 GB "Function Storage" allowance. The test runner pushes main after
# every slice — ~350 pushes in 30 days by 2026-11-06 — so each push was a
# ~20 MB deployment kept for a month, and the team reached 75% with no traffic.
# Nobody needs the cloud copy to follow every slice, so build at most one
# deployment per MIN_HOURS and skip the rest.
#
# Vercel's contract: exit 1 = BUILD this commit, exit 0 = SKIP it.
# A skipped commit shows as "Canceled" (Ignored Build Step) and stores nothing.
#
#   [deploy]       anywhere in the commit message -> always build
#   [skip deploy]  anywhere in the commit message -> always skip
#   GA40_DEPLOY_MIN_HOURS (Vercel env var, default 20) -> the throttle
#
# Anything this script cannot work out makes it BUILD (fail open): a
# deployment too many costs 20 MB, a deployment missed hides a fix.
set -u

min_hours="${GA40_DEPLOY_MIN_HOURS:-20}"
msg="${VERCEL_GIT_COMMIT_MESSAGE:-}"
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"

build() { echo "ga40 ignore-step: BUILD - $1"; exit 1; }
skip()  { echo "ga40 ignore-step: SKIP - $1"; exit 0; }

case "$msg" in *"[skip deploy]"*) skip "[skip deploy] in the commit message" ;; esac
case "$msg" in *"[deploy]"*)      build "[deploy] in the commit message" ;; esac

case "$min_hours" in ''|*[!0-9]*) build "GA40_DEPLOY_MIN_HOURS='$min_hours' is not a whole number" ;; esac
[ -n "$prev" ] || build "no previous deployment on this branch"

# Vercel clones shallow, so the last deployed commit is usually not local.
if ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
  git fetch --quiet --depth=1 origin "$prev" 2>/dev/null \
    || build "last deployed commit $prev could not be fetched"
fi

prev_time="$(git log -1 --format=%ct "$prev" 2>/dev/null)"
[ -n "$prev_time" ] || build "could not read the date of $prev"

age_hours=$(( ( $(date +%s) - prev_time ) / 3600 ))
if [ "$age_hours" -ge "$min_hours" ]; then
  build "last deployed commit $prev is ${age_hours}h old (throttle ${min_hours}h)"
fi
skip "last deployed commit $prev is only ${age_hours}h old (throttle ${min_hours}h); put [deploy] in a commit message to force one"
