# Windows / PowerShell 7

Always loaded: the commands Claude hands to Adrian — the push, a seed run, an unblock — land in his
shell, outside any file scope.

## The shell this assumes

**PowerShell 7 (`pwsh`) is assumed to be the DEFAULT PROFILE, not merely installed.** Every command
written for Adrian is written to land in `pwsh`. This is the assumption most likely to break
silently later — a new laptop, a fresh VS Code profile, a scheduled task, or Explorer's right-click
"Run with PowerShell" will hand you Windows PowerShell 5.1 again. It does announce itself,
unmistakably — a six-line block whose middle line reads `The token '&&' is not a valid statement
separator in this version.` and whose `FullyQualifiedErrorId` is `InvalidEndOfLine`. No other shell
produces that. Confirm with `$PSVersionTable.PSEdition` (expect `Core`) and `$PSVersionTable.PSVersion`
(expect `7.x`), then re-run in `pwsh`. A `&&` chain is rejected at parse time, so that statement did
not run. Whether the lines *above* it ran depends on how the block was pasted. **Assume everything
above the failing line already ran.** PSReadLine has no bracketed-paste support — the request
(PSReadLine #1471) has been open since 2020 — so nothing distinguishes pasted text from typing.
Windows Terminal — the default terminal on Windows 11, and VS Code's integrated terminal pastes the
same way — handles the paste itself and writes the block straight into the console input, where every
embedded newline is an Enter:
each line above the `&&` executed as it landed. **The exception is the one host that lets PSReadLine
handle the paste**: conhost with PSReadLine's own Ctrl+V binding, which drops the whole block into the
editing buffer as a single parse unit, so the ParserError kills all of it. (conhost's right-click
paste is keystrokes again.) The error message does not tell you which happened — check state before
re-running, and never assume a destructive line above the `&&` was skipped.

## What PS7 buys, and what to use

- **Chain dependent *commands* with `&&` and `||`, never `;` or a newline.** `&&` runs the next
  command only if the previous one succeeded (it keys off `$?` and `$LASTEXITCODE`, which together
  cover native exit codes and cmdlet non-terminating errors); `;` and a plain newline run it
  regardless. The canonical trap is `git add x ; git commit -m "..."` — the `add` fails, the `commit`
  runs anyway and ships whatever was *already* staged, exit 0, looking fine. (Claude's own commits use
  a pathspec — `git commit -m "..." -- <files>` — which closes that hole independently; see
  `C:\dev\.claude\rules\git-and-commits.md`.) **Never use `;` to join two commands where the second depends on
  the first.**

    **An assignment cannot be the left side of `&&`.** `&&` has higher precedence than `=`, so
    `$env:PGPASSWORD = 'x' && psql ...` parses as `$env:PGPASSWORD = ('x' && psql ...)`: `psql` runs
    *before* the variable is set, and the chain's output is what lands in the variable. No error is
    raised. Assignments go on their own line; `&&` chains only commands:
    ```powershell
    $env:PGPASSWORD = 'x'
    psql -h localhost -U postgres -f seed.sql && Write-Host 'seeded'
    ```
    `;` is not banned after an assignment — it is the *only* correct joiner there. If a one-liner is
    genuinely forced, `$env:PGPASSWORD = 'x'; psql ...` is safe: an assignment has no failure for `&&`
    to guard. The ban on `;` is between two **commands**, where the second depends on the first.

- **`$PSNativeCommandUseErrorActionPreference = $true`** — mainstream in **PS 7.4** (default `$false`);
  in 7.3 it exists only behind the `PSNativeCommandErrorActionPreference` experimental feature and the
  assignment is otherwise silently ignored. It makes a native command — `git`, `docker`, `npm` — that
  exits non-zero raise a PowerShell error instead of only setting `$LASTEXITCODE`. It is **not** an
  independent switch: that error is dispatched **according to `$ErrorActionPreference`**, so on its
  own, with the default `Continue`, nothing stops. Set both, in this order, at the top of any `.ps1`
  that shells out:
    ```powershell
    $ErrorActionPreference = 'Stop'
    $PSNativeCommandUseErrorActionPreference = $true   # no-op before 7.4
    ```
  `$LASTEXITCODE` is still set either way. For commands that use a non-zero exit to mean something
  other than failure (`robocopy`), disable it in a scoped block and test `$LASTEXITCODE` yourself.

- **`??`, `??=` and `? :`** are available. `[int]$port = $env:PORT ?? 3000` beats a four-line `if` —
  note the cast: `$env:PORT` is always a string and the fallback is an `[int]`, so without it the
  variable's type depends on whether the env var was set, and later comparisons change meaning.

- **`ForEach-Object -Parallel`** for genuinely independent work (`-ThrottleLimit` defaults to 5). Each
  iteration is a separate runspace, so `$using:var` is required to read an outer variable.
  **Re-assigning** a variable inside the block does not propagate out — but a `$using:` reference type
  is the *same object*, so `$using:list.Add(...)` really does mutate outer state, from N threads, with
  no locking. Collect results from the pipeline (`$out = $items | ForEach-Object -Parallel { ... }`) or
  use a `System.Collections.Concurrent` type — never a plain `[List[]]` or hashtable. Not worth it
  below a few seconds of work per item.

- **`ConvertFrom-Json -AsHashtable`** (PS6+) avoids `PSCustomObject` property-access pain, and
  `Test-Json` (6.1+) validates before parsing.

## Still true regardless of shell version

- **`pg_dump` output: write inside the container, then copy out.** PS7's `>` defaults to UTF-8 without
  a BOM, so 5.1's UTF-16LE corruption is gone — but that is not the reason to avoid `>`. PowerShell
  decodes a native command's stdout to text using `[Console]::OutputEncoding`, which on Windows
  defaults to the OEM console code page, not UTF-8. `pg_dump`'s UTF-8 bytes get read as that code page
  and re-encoded, so `ăîâșț` arrives as `─â├«├ó╚Ö╚Ť` — mojibake, not a visible replacement character,
  which is why it survives a quick eyeball. (Setting `[Console]::OutputEncoding` to UTF-8 does decode
  a valid-UTF-8 dump correctly — but it is per-session state nobody remembers to set, and any byte
  that is *not* valid UTF-8 then becomes a real U+FFFD, which unlike mojibake is unrecoverable. Do not
  rely on it.) `pg_dump -f` + `docker cp` is byte-exact, bypasses PowerShell entirely, and needs no
  console state:
    ```powershell
    docker exec ga40prj-postgres pg_dump -U postgres ga40db -f /tmp/dump.sql
    docker cp ga40prj-postgres:/tmp/dump.sql ./dump.sql
    ```
    **A dump written by `pg_dump ... > dump.sql` under 5.1 has BOTH problems** — wrong container *and*
    mangled characters. Converting the encoding fixes the container and leaves the text corrupt, so it
    will look repaired when it is not. Re-run `pg_dump` instead. The recipe below is only for a
    container-only case, and only one: a file that **5.1's `Out-File` or `>`** wrote from data
    PowerShell never decoded, i.e. UTF-16LE. Nothing PS7 wrote needs it — `Set-Content`, `Out-File`
    and `>` all default to `utf8NoBOM` in PS7. And 5.1's `Set-Content` defaults to the **ANSI code
    page**, not UTF-16. Read that one with `-Encoding ansi` (PS 7.4+; on 7.0–7.3 pass the numeric code
    page instead — on a Romanian-locale box that is **1250**). Not `-Encoding Default`: that spelling
    is 5.1-only and PS7's binder rejects it, and `[System.Text.Encoding]::Default` is UTF-8 in .NET
    Core, not ANSI. `-Encoding Unicode` on an ANSI file silently produces garbage. **But do not expect
    Romanian to survive the round trip.** Code page 1250 has no `ș`/`ț` (U+0219/U+021B, comma-below) —
    only the cedilla look-alikes `ş`/`ţ` — so 5.1's `Set-Content` wrote each of them as a literal `?`
    and no read encoding brings them back. A 5.1 `Set-Content` file holding Romanian is a
    *both-problems* file too: re-generate it, don't re-encode it.
    ```powershell
    # 5.1-written Out-File / ">" output only (UTF-16LE):
    (Get-Content -Raw -Encoding Unicode .\dump.sql) -replace "`r`n", "`n" |
        Set-Content -NoNewline -Encoding utf8NoBOM .\dump.fixed.sql
    ```

- **Relative paths break raw `[System.IO.File]` calls in `.ps1` scripts.** PowerShell cmdlets and
  external processes (`docker cp`, etc.) resolve relative paths against `$PWD`. Raw .NET static calls
  (`[System.IO.File]::ReadAllText`/`WriteAllText`) resolve them against the process-wide
  `[Environment]::CurrentDirectory`, which can silently diverge from `$PWD` (seen drifted to
  `C:\Windows\`). **Always resolve to an absolute path first** (`$repoRoot = $PSScriptRoot`;
  `[System.IO.Path]::GetFullPath((Join-Path $repoRoot "..\rel"))`) before any raw `[System.IO.File]` call.

- **Keep `.ps1` files plain ASCII, and make the 5.1 case fail loudly.** PS7 reads a no-BOM `.ps1` as
  UTF-8, so ASCII is no longer a correctness rule — it is kept as a cheap habit for the artefacts 5.1
  can still launch without anyone choosing it: Explorer's built-in "Run with PowerShell" verb (still
  `System32\WindowsPowerShell\v1.0\powershell.exe`; PS7's installer adds a *separate* "Run with
  PowerShell 7" entry only if that option was ticked) and an old Task Scheduler entry naming
  `powershell.exe`. **CI is not on this list** — GitHub Actions' default shell for `run:` on Windows
  runners is `pwsh`; only an explicit `shell: powershell` gets 5.1.
  ASCII alone buys little, because any script using `&&`, `??` or `-Parallel` is a *parse* error in
  5.1 whatever its encoding. So every `.ps1` that must never run under 5.1 opens with:
    ```powershell
    #Requires -Version 7.0
    ```
  Expect the ParserError, not the `#Requires` message, when the file also contains PS7-only syntax —
  `#Requires` is enforced against the parsed script, so a parse failure wins. Both messages are
  unambiguous; neither is silent. Use `----`/`====` for dividers rather than box-drawing characters.
