# Git — how Claude commits

Always loaded: Claude commits on every slice, and the mechanics below are what keep those commits
from taking Adrian's work with them.

The *contract* — who may do what — lives in `C:\dev\CLAUDE.md` → Autonomy. This file is the how.

## Read without taking the lock

`git status` and `git diff` are not read-only: both refresh and rewrite the index, so both take
`.git/index.lock`. Over the device bridge, which cannot unlink it afterwards, **a read can leave a
lock that blocks the next `add` or `commit`**. So:

- Read with **`git --no-optional-locks status`**. Measured: the flag stops git taking the lock at
  all, which is exactly what it is for — and `cmd_status` is its only call site in git 2.30–2.43.
  **Pass it on `diff` too, for consistency, but do not rely on it there:** `builtin/diff.c` ignores
  it and refreshes the index regardless. `diff` is safe for a different reason — it only refreshes
  when the refresh will genuinely change the index, so its lock is committed by rename, never
  rolled back, and so never stranded. `status` on a settled index is the one that rolls back, and
  the rollback is the unlink that strands.
- Let the **commit be the first command that touches the index**. A successful commit renames the
  lock over `.git/index`, so there is nothing left to unlink.
- `log`, `show` and `blame` never take it and need no flag.

**A successful commit still strands the rest of the set** — `HEAD.lock`, `next-index-<n>.lock`, a
`tmp_obj_*` per object written, and `objects/maintenance.lock` unless you passed
`-c maintenance.auto=false` — and `HEAD.lock` is the one that
bites: it blocks your **next** commit in the same slice with `fatal: cannot lock ref 'HEAD' … File
exists`, exit 128. **Claude clears that itself and carries on**, by moving exactly the paths git named
in its own `warning: unable to unlink '<path>'` output into `.git/_stranded_locks/` — the bridge can
move what it cannot delete. The test, what falls outside it, and the two different lines Adrian gets
are all in `C:\dev\.claude\rules\sandbox-and-toolchain.md`. Read it before assuming a commit that
exited 0 left nothing behind.

## Stage and commit by explicit path

**Never `git add -A`, `.` or `-u`** — the working tree may hold things that are not this slice. And
**commit by explicit path too**:

```
git add <any new files> && git commit -m "message" -- <every path in this slice>
```

**Over the device bridge that whole chain goes inside the quarantine recipe's brace group**, both
halves, with `-c maintenance.auto=false` on each — `git add … && git commit … 2>"$o"` binds as
`add && (commit 2>"$o")`, so the `add`'s own stranded temps escape the capture and are still there
when the next command runs. The recipe is in `C:\dev\.claude\rules\sandbox-and-toolchain.md`.

Reading `git status` first is not enough on its own. A plain `git commit` writes the *whole* index,
including hunks Adrian staged in VS Code's Source Control panel before you looked — they land under
your message, exit 0, looking fine. A pathspec commit takes only the paths you name and leaves the
rest of the index exactly as it was. If `status` shows something staged that is not yours, leave it
staged, commit your paths, and say so in the handover.

What the pathspec cannot close is the second between the `add` and the `commit`: it takes the file's
content *at commit time*, so if Adrian saves one of your slice's files in that gap you commit his
newer edit.

The pathspec also closes the classic `add`-fails-then-`commit`-runs hole independently: if the `add`
fails, the path is unknown to git and the commit aborts with `error: pathspec '<file>' did not match
any file(s) known to git`, exit 1, writing nothing. `&&` is still the right joiner — it leaves the
`add` error as the last thing on screen instead of burying it above output from a command that ran
anyway. (`&&` vs `;`, and why an `$env:` assignment can never be the left side of `&&`, are in
`C:\dev\.claude\rules\powershell-and-windows.md`.)

## A rename needs both halves named

`git mv old new` stages an add *and* a delete. `git commit -- new` commits only the add and leaves the
delete staged, so `HEAD` ends up carrying **both copies**. Name `old` and `new` both.

Done right, `git show --stat HEAD` reads `old => new`. Done wrong it reads `new | N +` — an add where
you expected a rename — and `git --no-optional-locks status --short` still shows `D old`. Fixed with
`git commit --amend --no-edit -- <old>`, subject to the carve-out.

## Check the commit you just made

Run `git show --stat HEAD` **and `git --no-optional-locks status --short`** after: the first catches a
commit that took too much, the second catches one that took too little — anything of *yours* still
staged did not go in. If the file list is wrong, say so immediately.

## Amending

**Every amend is allowed only under the carve-out in `C:\dev\CLAUDE.md` → Autonomy:** run
`git branch -r --contains HEAD` first, and if it prints anything the commit is already pushed — do not
amend, fix it forward in the next commit and say so in the handover. Claude having made the commit
this session does not mean it is unpushed; Adrian pushes, and he can push between the commit and the
amend.

**Always `--no-edit`.** A bare `git commit --amend` re-opens the message in an editor, and the bridge
has no terminal: with `GIT_EDITOR`/`EDITOR` unset git aborts with `error: Terminal is dumb, but EDITOR
unset` (or `error: There was a problem with the editor 'editor'`), exit 1, **and the amend does not
happen** — leaving the index in exactly the state check 1 below warns about. `--no-edit` keeps the
existing message and needs no terminal; a message fix uses `-m` and is safe for the same reason.

**To add a file that was left out:**
`git add <it, if it is new> && git commit --amend --no-edit -- <the missed path>` — with a pathspec,
amend keeps the rest of the commit and leaves the index alone, so nothing of Adrian's is swept in. An
untracked path fails with `error: pathspec ... did not match`, which is why the `add` comes first.

**Amend cannot remove a file that should not have gone in.** Two checks before touching anything, both
of which mean *stop* rather than *proceed carefully*:

1. `git show --stat HEAD` — **if what you want to remove is everything the commit contains, stop
   here.** Removing it would leave an empty commit, which `git commit --amend` refuses (`would make it
   empty`, exit 1) *after* you have already unstaged the file — leaving it staged for removal:
   `D <file>` if the commit added it, `M <file>` if the commit only modified it, and in both cases
   **the path is still on disk**. Put it back with `git restore --source=HEAD --staged -- <file>`
   before anything else, and do not read that lone `D <file>` as check 2's rename carve-out — that
   one's `<old>` is gone from disk. `git reset HEAD^` needs a go-ahead. `--allow-empty` is not on the
   go-ahead list at all — **the amend carve-out would in fact permit it** — but it keeps a commit that
   contains nothing, which "each commit compiles, is scoped to one thing" does not allow. Hand `git reset --soft HEAD^` to Adrian instead — `--soft`,
   not git's suggested plain `reset`, so anything he has staged stays staged — and carry on. On a root
   commit there is no `HEAD^` (`fatal: ambiguous argument 'HEAD^'`, exit 128); hand
   `git update-ref -d HEAD` there instead, which drops the commit and leaves the index and the files
   exactly as they are, on an unborn branch.
2. `git diff --cached --name-only` — the fix ends in a `git commit --amend --no-edit` with **no
   pathspec**, which writes the *whole* index, so anything Adrian has staged lands in your commit.
   After a clean pathspec commit it prints nothing. **If anything prints, do not run the no-pathspec
   amend**: leave the extra file in the commit and say so in the handover.
   **One entry can be yours, and it is a different problem: a `D <old>` left staged by a `git mv`
   whose commit named only `new`.** The tell is that `<old>` is gone from disk —
   `git --no-optional-locks status --short` shows `D <old>` with no `?? <old>` beside it, and `git show --stat HEAD` reads `new | N +` where a
   rename should be. (A `D <file>` whose path is still on disk as `?? <file>` is check 1's trap, not
   this one; go back to check 1.) That is a commit that took too *little*, and it is fixed forward
   with `git commit --amend --no-edit -- <old>`: the pathspec means **this check does not gate it** —
   amend records the deletion of a path that is gone from disk, the commit becomes the rename it
   should have been, and everything else staged is left exactly as it was. Fix that first, then re-run
   this check.

Both clean: `git restore --source=HEAD~1 --staged -- <file>` then `git commit --amend --no-edit`. That
drops the file from the commit and leaves Adrian's working copy untouched; it works whether the commit
modified the file or added it new (for a new file the index entry goes away and the file stays on
disk, untracked). **On the first commit of a repo there is no `HEAD~1`** —
`git restore --source=HEAD~1` is `fatal: could not resolve HEAD~1`, exit 128. Use
`git rm --cached -- <file>` there instead, then the same `git commit --amend --no-edit` — subject to
check 1, which on a root commit is the same trap. If an amend has already failed and left `D <file>`
staged, put it back with `git restore --source=HEAD --staged -- <file>` before doing anything else.

## The banned set, in full

These need an explicit go-ahead (the contract states this; the enumeration lives here). **Any git
command that changes the working tree, `HEAD` or a ref by something other than adding a commit** —
the obvious ones being `reset --hard`, `rebase`, `commit --amend` (except under the carve-out),
`clean`, `branch -D`, `checkout`/`switch` to another branch, and any force-push. Four read as harmless
and are not (and writing `git config` makes five):

- **`stash`** — it takes Adrian's uncommitted work off disk, and his editor buffers won't know.
- **`pull`** — with `pull.rebase` set it *is* a rebase, and a conflicted one needs a banned command to
  escape. **`merge`** and **`cherry-pick`** are the same shape.
- **`gc`** — it prunes the reflog that makes "a commit is reversible in one command" true.
- **`git config`** (writing) — `.git/config` is not versioned, so a setting you change is invisible to
  Adrian and permanent.

**Exempt:** `git restore --staged` and `git rm --cached` touch only the index; `git mv` moves a file
Claude is authoring anyway, which is no more a working-tree change than an `Edit`. **`revert` is
exempt only when it applies cleanly** — a conflicting `git revert` stops with `REVERT_HEAD` set and
conflict markers on disk, and the ways out are `git revert --abort`/`--skip`, both banned. If a revert
conflicts and the resolution is obvious, resolve it and commit it: a pathspec commit *is* allowed
mid-revert, unlike mid-merge (`fatal: cannot do a partial commit during a merge`). Otherwise hand
`git revert --abort` to Adrian and carry on.

**Over the device bridge that exemption is theoretical: `revert` cannot run at all** — it needs the
index lock twice, and dies on the one it stranded itself, exit 128, on a clean board. Hand the whole
revert to Adrian. The measurement, and which other commands share the shape, are in
`C:\dev\.claude\rules\sandbox-and-toolchain.md`.

## Commit messages

Conventional prefixes — `feat:`, `fix:`, `chore:`, `ci:`, `docs(scope):`, `test:`. The subject is the
prefix and one line. **The body is where the per-slice detail goes** — what changed and why, the
decisions taken under "Claude decides", anything listed as "Fixed in passing". The working contract
says that detail lives in git history; Claude writes that history now, so the body is the only place
it exists.
