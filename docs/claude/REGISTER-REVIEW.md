# Register review — the Monday procedure

**What this is.** Every Monday at 08:00 Toronto time a Cowork scheduled task on Adrian's computer
starts a fresh session whose whole prompt is „follow `docs/claude/REGISTER-REVIEW.md`". This file
is that procedure. It is improved by a commit, never by editing the task. A session may also run it
by hand on any day; everything below takes the run's date, not „Monday".

It reads two things — `docs/claude/FOLLOW-UP-REGISTER.md` (Claude's own register, Slice #36.10)
and `C:\dev.docs\Defecte\GA40.Defecte.xlsx` (Ciprian's defect log, Slice #36.11) — and leaves
three:

1. **The register, re-checked**, committed as one `docs(register):` commit.
2. **A one-page review** — `C:\dev.docs\01.Slice.Inputs\Register.Reviews\<date>\Review.<date>.docx`.
3. **At most three proposed fix slices**, one `.docx` each beside it, named `Propus.1.docx`,
   `Propus.2.docx`, `Propus.3.docx` — proposals, because the next free slice number is only known
   when Adrian picks one. When he does, he gives it that number; the proposal needs no other edit.

Then a push notification says the review is ready.

## What a review may and may not change

| May | May not |
|---|---|
| A row's **Status**, **Status note** and **Last checked**, following the six statuses in the register's header | The register's fields, statuses, kinds or impact scale (Slice #36.10 owns them), or any row's ID. Never delete a row. |
| Mark a row `duplicate` of another, `resolved` with the commit that fixed it, `superseded`, or `ignored` under the closing rule below | Mark anything `resolved` without a commit hash — the guard test refuses it, and so does the register's header |
| Add `FU-nnn` to „Referință registru" on a defect-log row that matches a register row | Change a defect-log row's **Stare** or any other column — those are Adrian's and Ciprian's |
| Write the files under `Register.Reviews\<date>\` | Any file in the repo other than the register. No code, no test, no rule file — a fault in this procedure is written on the review page for Adrian, not fixed by the run |
| Commit the register (`add`/`commit` only, by pathspec) | Push, or anything on the go-ahead list in `C:\dev\CLAUDE.md` → Autonomy |

The run is unattended. **It never asks.** Where something needs Adrian it writes it in the review's
first lines and carries on. Adversarial review rounds are suspended until 2027-01-19 and a review is
not one — it re-checks rows, it does not hunt for new findings.

## Step 0 — set up

1. Read `C:\dev\CLAUDE.md`, `ga40prj\CLAUDE.md` and `C:\dev\.claude\rules\git-and-commits.md` +
   `sandbox-and-toolchain.md` (the quarantine recipe is needed for the commit).
2. `git --no-optional-locks status --short`. **If `docs/claude/FOLLOW-UP-REGISTER.md` is already
   modified in the working tree, stop editing the register**: someone is mid-slice. Still write the
   review from HEAD, say so in its first line, and skip Step 7's commit.
3. Extract the helper at the bottom of this file and run the scan (paths are the device-bridge
   mounts; `$D` is the run's date, `YYYY-MM-DD`, in Toronto):
   ```bash
   cd "$HOME/mnt/dev/ga40prj"
   sed -n '/^```python register-review-helper$/,/^```$/{//!p}' docs/claude/REGISTER-REVIEW.md > "$HOME/rr.py"
   D=$(TZ=America/Toronto date +%F)
   python3 "$HOME/rr.py" scan --date "$D"
   python3 "$HOME/rr.py" defects "$HOME/mnt/dev.docs/Defecte/GA40.Defecte.xlsx"
   ```
   `scan` prints every number the steps below need. It decides nothing.

## Step 1 — re-verify every open and planned row against HEAD

The baseline is the last `docs(register):` commit (before the first review: `d1b4fd6`, which the
#36.10 harvest checked every row against). `scan` sorts the open and planned rows into buckets:

- **UNCHANGED** — every evidence file it could resolve is untouched since the baseline, and no commit
  since then names the row. The code the row describes is byte-for-byte the code that was checked,
  so the row is still true: **Last checked = today**, nothing else.
- **CHANGED**, **MISSING**, **NOPATH**, **MENTIONED** — read each against HEAD and decide:
  - the code is gone → `superseded`, note says what replaced it;
  - a later commit fixed it → `resolved`, note = `Slice #nn.nn <hash>` (take the hash from
    `git log -S`/`git log -- <path>`, never from memory);
  - still true → Last checked = today, and correct the Evidence line numbers if they moved.
- **TEST GAPS vs ADDED TEST FILES** — test files were added since the baseline; open only those whose
  name or `describe` could plausibly close one of the listed gaps.
- A row whose note opens **„Unverified:"** depends on a database or a screen. Re-check only its code
  half; leave the „Unverified:" as it is.

`planned` rows whose named slice has shipped without them go back to `open` with one line saying so.

## Step 2 — merge duplicates

Read the open rows by **Area** (the table is not sorted by area; sort a copy). Two rows are duplicates
only when one fix closes both **and** they describe the same fault — not merely the same file. Mark the
younger one `duplicate` with the older's `FU-nnn` in its note, and move its `Raised` refs onto the
older row. Rows that are related but distinct (one fix would make the other moot) are not duplicates;
they are bundle candidates for Step 5.

## Step 3 — read the defect log

Rows with a real ID (`D-nnnn`; the `EXEMPLU-n` rows are ignored). **Every `Confirmat` row not yet in
a slice** („Rezolvat în" empty) is a candidate, and it **outranks a register row of the same impact**,
because a real user reported it. Map its Severitate onto the impact scale: data loss or wrong data
saved → `data`; anything Ciprian sees → `user`. When a log row describes a register row, write the
`FU-nnn` into its „Referință registru" and treat the two as one candidate. If the log has no real rows,
the review says so in one line and works from the register alone.

## Step 4 — rank

Tiers, in order:

1. **Data risk** — impact `data`, or a log row whose effect is lost or wrong data.
2. **What Ciprian would see** — impact `user`.
3. **What blocks the next planned feature work** — a `dev` row the next feature slice would trip on.
   The next planned feature work is the newest slice description under `01.Slice.Inputs\` that no
   commit cites yet; when there is none, it is the line of work last week's `feat:` commits were on.
4. **Developer-only** — the rest of `dev`.

`cosmetic` rows are never a slice of their own; they only ride in a sweep (Step 5).

Within a tier, in order: **(a)** reachable in Ciprian's ordinary use today, before anything that needs a
race, a second account, a lost disk or unverified data to bite; **(b)** in the area of the next planned
feature work; **(c)** smaller Size first; **(d)** more `Raised` refs first; **(e)** lower `FU` number.

## Step 5 — bundle

Small items (XS, S) that share an **Area** go into one „sweep" slice rather than a slice each, up to
about one slice of work (two S, or one S and a few XS). An XS data-risk row may stand alone only when
no other small open row shares its area. A row whose note says it must be fixed „alongside" another
goes with that one or not at all. An M or L row is a slice of its own.

## Step 6 — propose, under the balance rule

**Count last week** — the seven days before the run's date. `scan` prints the numbers; they come
from `git log --since=<D−7> --until=<D> --format=%s`:

- **fix** commits: subject matches `^fix(\(…\))?!?:`;
- **build** commits: `^(feat|test)(\(…\))?!?:` or `^docs\(testing\)!?:`;
- everything else (`docs(claude)`, `chore`, `refactor`, `docs(register)`) counts for neither;
- **N**, the week's slices: distinct `Slice #nn.nn` ids whose first citation anywhere in history falls
  in the window, and never less than 4.

**The slate:**

- Non-data-risk fix slices: **target round(N ÷ 4)**, **never more than floor(N ÷ 3)**; one fewer when
  last week's fix share (fix ÷ (fix + build)) was above one in three.
- **Data-risk slices are exempt from that ratio and go first.**
- **Never more than three fix slices in one slate**, data risk included.
- **If the register's open count has grown three reviews running** (`scan`'s TREND block), the
  review's first line says so — „Open rows have grown three weeks running: a, b, c, d" — and the
  slate is **not** widened. That is a signal for Adrian about how much is being noticed, not a
  licence to fix more.

Each slated row gets `Slated <D> Propus.<n>` appended to its Status note (once — a row already
carrying a `Slated` marker keeps its first one). It stays `open`: a proposal is not a plan. The slice
that takes it marks it `planned`/`resolved`, as `ga40prj/CLAUDE.md` → „Ending a slice" says.

### The closing rule — the register gets shorter too

- **Proposing.** An `open` row with impact `dev` or `cosmetic`, whose **last** `Raised` date is six
  weeks (42 days) or more before the run, that carries no `Slated` marker, no `Proposed ignored` and no
  `Keep:` — `scan` lists them — gets `Proposed ignored <D>: <one-line reason>` appended to its note,
  and is listed on the review page. The reason says why doing nothing is acceptable, not that it is old.
  When no honest reason exists — the row sits in the area the next planned feature work is going
  into, or its gap is on a path that writes data — it is **withheld**: not proposed, listed under
  Closing with that reason, and judged again by the next run. Withheld is not `Keep:`.
- **Objecting.** Adrian objects by adding a line `FU-nnn <optional reason>` to
  `C:\dev.docs\01.Slice.Inputs\Register.Reviews\Keep.txt`, or by telling any session. The next run
  reads `Keep.txt` first; for each id it removes the `Proposed ignored …` text and appends
  `Keep: <reason, or „Adrian”> (<D>)`. A `Keep:` row is never proposed again.
- **Applying.** A `Proposed ignored <date>` from an **earlier** run with no objection becomes status
  `ignored`, note `<the reason> (proposed <date>, no objection)`. `ignored` is reversible by reopening.

## Step 7 — write the register and commit

Edit with the helper so every mechanical change is exact:

```bash
python3 "$HOME/rr.py" touch --date "$D" --all-open          # Last checked on every open/planned row
python3 "$HOME/rr.py" set FU-nnn --status resolved --note "Slice #nn.nn <hash> — <what>" --date "$D"
python3 "$HOME/rr.py" set FU-nnn --append-note "Slated $D Propus.1"
python3 "$HOME/rr.py" summary --date "$D" --label "register review $D"
```

`touch --all-open` is right only after every non-UNCHANGED row has been read in Step 1. Then check
the table the way the guard test does (`src/__tests__/follow-up-register.test.ts`: eleven cells a
row, IDs contiguous, vocabulary, a hash on every `resolved`, summary equal to the table) and
`git --no-optional-locks diff --stat` — **one file changed**. Commit it by pathspec inside the
quarantine recipe of `sandbox-and-toolchain.md`:

```
docs(register): review <D> — <n> re-checked, <changes in a phrase>, slate Propus.1–<k>
```

The body lists every status change with its reason, the slate by FU ids, the ignore proposals and
the balance numbers. Attribution lines as the session's reminder gives them. If the commit fails with
a lock Claude did not strand, leave the edit uncommitted and put the single unblock line on the
review page — the review itself still ships.

## Step 8 — write the review and the proposals

Folder: `C:\dev.docs\01.Slice.Inputs\Register.Reviews\<D>\`. Write each document as plain text
(paragraphs separated by one blank line, first paragraph = the heading) and convert it with
`python3 "$HOME/rr.py" docx <src.txt> <out.docx>` — Heading 2 for the first paragraph, plain
paragraphs after, the shape of every `Slice.nn.nn.docx`. Keep the `.txt` sources out of the folder.
Check each `.docx` by converting it back (`pandoc -t plain`) before finishing.

**The review — one page, in this order:**

1. `Register review <D>` (heading).
2. **The first line** is the one thing Adrian must know: the three-week growth signal if it fired;
   else anything the run could not do (a lock, a dirty register); else
   „Open <before> → <after>; <k> fix slices proposed; nothing needs you but the pick."
3. **What changed since last week** — resolved / superseded / duplicate / ignored, each `FU-nnn`
   with its reason in a line; „nothing" when nothing did.
4. **The slate** — per proposal: `Propus.n — <title>`, the FU ids (and D-ids), why it ranks there, in
   two lines.
5. **Balance** — the numbers from Step 6 and the rule's result, in two lines.
6. **Closing** — rows proposed for `ignored` today with their reasons; rows withheld, and why; rows ignored today.
7. **Next in line** — the five rows that just missed the slate, one line each.
8. **Defect log** — one line.
9. **What Adrian does** — pick (or not); give the picked proposal the next slice number; object to
   an ignore through `Keep.txt`.

**Each proposal** is a slice description in `docs/claude/SLICE-HEADER-TEMPLATE.md`'s shape — read
it, and the `write-slice-description` skill if the session has it:

```
Slice Propus.<n> — <register review D>
## Propus.<n> — <title>
Goal: <what is true when it is done — an outcome, naming the FU ids it closes>
Inputs: 01.Slice.Inputs\Register.Reviews\<D>
Out of scope: <the neighbouring rows it deliberately leaves, by FU id>
Depth: normal
Constraint:
<what is already shipped around it and must not be relitigated; the row's own fix line; that the
slice closes its rows in its last commit, as „Ending a slice" says>
### What this covers
1. …
```

Every sentence in a proposal comes from reading the code at HEAD during this run, not from the
row's text alone: a proposal that points at a moved line wastes the run that picks it.

## Step 9 — notify

`PushNotification`, one line: `Register review <D>: <k> fix slices proposed (<FU ids>); <first line>`.

## The helper

```python register-review-helper
#!/usr/bin/env python3
"""Register-review helper. Source of truth: docs/claude/REGISTER-REVIEW.md (this block).
Run from the ga40prj top level. Stdlib only, except `defects` (openpyxl) and `docx` (python-docx).
Nothing here commits, and nothing here decides: `scan` reports, the edit commands do exactly
what they are told."""
import argparse, datetime as dt, os, re, subprocess, sys

REG = "docs/claude/FOLLOW-UP-REGISTER.md"
FIRST_BASELINE = "d1b4fd6"   # what Slice #36.10's harvest checked every row against
STATUSES = ["open", "planned", "resolved", "ignored", "duplicate", "superseded"]
IMPACTS = ["data", "user", "dev", "cosmetic"]
PATH_RE = re.compile(r"[A-Za-z0-9_.\[\]/-]+\.(?:tsx|ts|mts|mjs|js|sql|json|ps1|yml|yaml|md|txt|css)\b")
FU_RE = re.compile(r"(?<![A-Za-z0-9])FU-\d{3}(?!\d)")
TEST_DIRS = ("src/__tests__/", "e2e/", "docs/testing/")

def git(*a):
    return subprocess.run(["git", "--no-optional-locks", *a], capture_output=True, text=True, check=True).stdout

def cells(line):
    p = [c.strip() for c in re.split(r"(?<!\\)\|", line)]
    return p[1:-1]

def load(text=None):
    text = open(REG, encoding="utf8").read() if text is None else text
    lines = text.split("\n")
    rows = []
    for i, l in enumerate(lines):
        if re.match(r"^\|\s*FU-\d{3}\s*\|", l):
            rows.append((i, cells(l)))
    return lines, rows

def dates(s):
    return [dt.date.fromisoformat(x) for x in re.findall(r"\d{4}-\d{2}-\d{2}", s)]

def today(a):
    return dt.date.fromisoformat(a) if a else dt.date.today()

def baseline():
    for line in git("log", "--format=%h %s", "--", REG).splitlines():
        sha, subj = line.split(" ", 1)
        if subj.startswith("docs(register):"):
            return sha, "last review commit"
    return FIRST_BASELINE, "no review commit yet — #36.10 harvest baseline"

def summary_counts(rows):
    t = {s: [0] * 4 for s in STATUSES}
    for _, c in rows:
        t[c[8]][IMPACTS.index(c[6])] += 1
    return t

def cmd_scan(a):
    D = today(a.date)
    lines, rows = load()
    base, why = baseline()
    changed = set(git("diff", "--name-only", f"{base}..HEAD").split())
    added = set(git("diff", "--name-only", "--diff-filter=A", f"{base}..HEAD").split())
    log = git("log", f"{base}..HEAD", "--format=@@%h %s%n%b")
    mentions = {}
    for chunk in log.split("@@")[1:]:
        sha = chunk.split(" ", 1)[0]
        for fu in set(FU_RE.findall(chunk)):
            mentions.setdefault(fu, []).append(sha)
    print(f"# scan {D}  HEAD {git('rev-parse','--short','HEAD').strip()}  baseline {base} ({why})")
    print(f"changed since baseline: {len(changed)} files; added: {len(added)}")
    for f in sorted(changed): print(f"  {'A' if f in added else 'M'} {f}")
    changed_base = {os.path.basename(f) for f in changed}
    buckets = {k: [] for k in ["UNCHANGED", "CHANGED", "MISSING", "NOPATH", "MENTIONED"]}
    absence = []
    for _, c in rows:
        if c[8] not in ("open", "planned"): continue
        fu = c[0]
        toks = sorted(set(PATH_RE.findall(c[5])))
        resolved = [t for t in toks if os.path.isfile(t)]
        unresolved = [t for t in toks if t not in resolved]
        if fu in mentions: buckets["MENTIONED"].append((fu, ",".join(mentions[fu])))
        elif not toks: buckets["NOPATH"].append((fu, ""))
        elif any(t in changed for t in resolved) or any(os.path.basename(t) in changed_base for t in unresolved):
            buckets["CHANGED"].append((fu, " ".join(t for t in toks if t in changed or os.path.basename(t) in changed_base)))
        elif not resolved: buckets["MISSING"].append((fu, " ".join(toks)))
        else: buckets["UNCHANGED"].append((fu, ""))
        if c[2] == "test gap" and any(f.startswith(TEST_DIRS) for f in added): absence.append(fu)
    for k in ["MENTIONED", "CHANGED", "MISSING", "NOPATH"]:
        print(f"\n## {k} ({len(buckets[k])}) — read these against HEAD")
        for fu, x in buckets[k]: print(f"  {fu} {x}")
    print(f"\n## UNCHANGED ({len(buckets['UNCHANGED'])}) — evidence files untouched since baseline: still true")
    print("  " + " ".join(fu for fu, _ in buckets["UNCHANGED"]))
    if absence:
        print(f"\n## TEST GAPS vs ADDED TEST FILES ({len(absence)}) — test files were added since baseline; confirm none closes one of these")
        print("  " + " ".join(absence))
    # closing rule
    cut = D - dt.timedelta(days=42)
    print(f"\n## PENDING IGNORE PROPOSALS (made by an earlier review, apply now unless Adrian objected)")
    for _, c in rows:
        m = re.search(r"Proposed ignored (\d{4}-\d{2}-\d{2})", c[9])
        if c[8] == "open" and m and dt.date.fromisoformat(m.group(1)) < D:
            print(f"  {c[0]} proposed {m.group(1)}")
    print(f"\n## NEW IGNORE CANDIDATES (open, dev/cosmetic, last raised <= {cut}, never slated, no proposal, no Keep:)")
    for _, c in rows:
        if c[8] != "open" or c[6] not in ("dev", "cosmetic"): continue
        if re.search(r"Slated \d|Proposed ignored|Keep:", c[9]): continue
        last = max(dates(c[1]))
        if last <= cut: print(f"  {c[0]} {c[6]} {c[7]} last raised {last} — {c[4][:90]}")
    # balance
    since, until = D - dt.timedelta(days=7), D
    subj = git("log", f"--since={since} 00:00", f"--until={until} 00:00", "--format=%s").splitlines()
    fix = sum(bool(re.match(r"^fix(\([^)]*\))?!?:", s)) for s in subj)
    build = sum(bool(re.match(r"^(feat|test)(\([^)]*\))?!?:|^docs\(testing\)!?:", s)) for s in subj)
    first = {}
    for chunk in git("log", "--format=@@%ad %s%n%b", "--date=short").split("@@")[1:]:
        d = dt.date.fromisoformat(chunk[:10])
        for sid in set(re.findall(r"Slice #(\d+\.\d+)", chunk)):
            first[sid] = min(first.get(sid, d), d)
    new = sorted(s for s, d in first.items() if since <= d < until)
    n = max(len(new), 4)
    target = min(3, int(n / 4 + 0.5)); cap = min(3, n // 3)
    share = fix / (fix + build) if fix + build else 0.0
    adj = target - 1 if share > 1 / 3 else target
    print(f"\n## BALANCE window {since} .. {until - dt.timedelta(days=1)}")
    print(f"  commits: fix {fix}, build (feat/test/docs(testing)) {build}, other {len(subj) - fix - build}; fix share {share:.2f}")
    print(f"  slices started in window: {len(new)} ({', '.join(new) or '—'}); N used = {n}")
    print(f"  non-data-risk fix slices: target round(N/4) = {target}, cap floor(N/3) = {cap}, hard cap 3;"
          f" after share rule (>1/3 last week -> -1): {max(0, min(adj, cap))}. Data-risk slices exempt from the ratio, not from the cap of 3.")
    # trend
    print("\n## TREND (open count at each review commit, newest first; then the working tree)")
    for line in git("log", "--format=%h %ad %s", "--date=short", "--", REG).splitlines():
        sha, d, subj1 = line.split(" ", 2)
        if subj1.startswith("docs(register):"):
            _, r = load(git("show", f"{sha}:{REG}"))
            print(f"  {d} {sha} open {sum(1 for _, c in r if c[8] == 'open')}")
    print(f"  now (working tree) open {sum(1 for _, c in rows if c[8] == 'open')}")

def write_row(lines, idx, c):
    lines[idx] = "| " + " | ".join(c) + " |"

def cmd_touch(a):
    D = today(a.date).isoformat()
    lines, rows = load(); want = set(a.ids); hit = 0
    for i, c in rows:
        if c[0] in want or (a.all_open and c[8] in ("open", "planned")):
            c[10] = D; write_row(lines, i, c); hit += 1
    open(REG, "w", encoding="utf8", newline="\n").write("\n".join(lines)); print(f"touched {hit}")

def cmd_set(a):
    lines, rows = load()
    for i, c in rows:
        if c[0] != a.id: continue
        if a.status:
            assert a.status in STATUSES, a.status; c[8] = a.status
        if a.note is not None: c[9] = a.note.replace("|", "\\|")
        if a.append_note: c[9] = (c[9] + " · " if c[9] else "") + a.append_note.replace("|", "\\|")
        if a.date: c[10] = a.date
        write_row(lines, i, c)
        open(REG, "w", encoding="utf8", newline="\n").write("\n".join(lines)); print(" | ".join(c)); return
    sys.exit(f"{a.id} not found")

def cmd_summary(a):
    text = open(REG, encoding="utf8").read(); _, rows = load(text); t = summary_counts(rows)
    tot = [sum(t[s][k] for s in STATUSES) for k in range(4)]
    out = [f"As of {a.date}, {a.label} — {len(rows)} entries. Rows are status, columns are impact.", "",
           "| Status | data | user | dev | cosmetic | Total |", "|---|---:|---:|---:|---:|---:|"]
    out += [f"| {s} | " + " | ".join(map(str, t[s])) + f" | {sum(t[s])} |" for s in STATUSES]
    out.append("| **total** | " + " | ".join(map(str, tot)) + f" | {sum(tot)} |")
    text = re.sub(r"(<!-- summary:begin -->\n)[\s\S]*?(\n<!-- summary:end -->)", lambda m: m.group(1) + "\n".join(out) + m.group(2), text)
    open(REG, "w", encoding="utf8", newline="\n").write(text); print("\n".join(out))

def cmd_defects(a):
    import openpyxl
    ws = openpyxl.load_workbook(a.path, data_only=True)["Jurnal"]
    hdr = [c.value for c in ws[1]]; ix = {h: k for k, h in enumerate(hdr)}
    real = [r for r in ws.iter_rows(min_row=2, values_only=True) if isinstance(r[0], str) and re.match(r"^D-\d{4}$", r[0])]
    print(f"defect log rows: {len(real)} (EXEMPLU rows ignored)")
    for r in real:
        print(f"  {r[0]} {r[ix['Stare']]} | {r[ix['Tip']]} | sev {r[ix['Severitate']]} | prio {r[ix['Prioritate']]} | "
              f"rezolvat în {r[ix['Rezolvat în']] or '—'} | registru {r[ix['Referință registru']] or '—'} | {r[ix['Titlu']]}")

def cmd_docx(a):
    import docx
    d = docx.Document(); paras = open(a.src, encoding="utf8").read().split("\n\n")
    d.add_heading(paras[0].strip(), level=2)
    for p in paras[1:]:
        if p.strip(): d.add_paragraph(p.strip("\n"))
    d.save(a.out); print(f"wrote {a.out} ({len(paras)} paragraphs)")

ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
p = sp.add_parser("scan"); p.add_argument("--date"); p.set_defaults(f=cmd_scan)
p = sp.add_parser("touch"); p.add_argument("--date"); p.add_argument("--all-open", action="store_true"); p.add_argument("ids", nargs="*"); p.set_defaults(f=cmd_touch)
p = sp.add_parser("set"); p.add_argument("id"); p.add_argument("--status"); p.add_argument("--note"); p.add_argument("--append-note"); p.add_argument("--date"); p.set_defaults(f=cmd_set)
p = sp.add_parser("summary"); p.add_argument("--date", required=True); p.add_argument("--label", required=True); p.set_defaults(f=cmd_summary)
p = sp.add_parser("defects"); p.add_argument("path"); p.set_defaults(f=cmd_defects)
p = sp.add_parser("docx"); p.add_argument("src"); p.add_argument("out"); p.set_defaults(f=cmd_docx)
a = ap.parse_args(); a.f(a)
```
