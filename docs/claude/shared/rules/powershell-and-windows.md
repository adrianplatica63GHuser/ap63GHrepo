# Windows / PowerShell 5.1

Always loaded: commit delivery happens outside any file scope.

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

- **`pg_dump` on Windows → UTF-16LE corruption.** PowerShell's `>` redirection saves files as UTF-16LE with BOM (`FF FE`). PostgreSQL's `psql` expects UTF-8; the null bytes corrupt SQL parsing and diacritics. **Never use `docker exec ... pg_dump > file.sql`.** Always let pg_dump write to the container filesystem, then copy out:
    ```powershell
    docker exec ga40prj-postgres pg_dump -U postgres ga40db -f /tmp/dump.sql
    docker cp ga40prj-postgres:/tmp/dump.sql ./dump.sql
    ```
    If you already have a suspect file, detect/fix encoding with `file`, `iconv -f UTF-16LE -t UTF-8`, strip CRLF (`sed -i 's/\r//'`) and BOM (`sed -i '1s/^\xEF\xBB\xBF//'`).

- **Non-ASCII characters in `.ps1` files break under Windows PowerShell 5.1.** It parses a no-BOM `.ps1` using the system codepage (the file-writing tools save UTF-8 without a BOM), so decorative non-ASCII (box-drawing `─`/`│`, smart quotes, em-dashes) becomes mojibake and can break tokenization (`ParserError: UnexpectedToken`). **Stick to plain ASCII in every `.ps1` file** — use `----`/`====` for dividers.

- **Relative paths break raw `[System.IO.File]` calls in `.ps1` scripts.** PowerShell cmdlets and external processes (`docker cp`, etc.) resolve relative paths against `$PWD`. Raw .NET static calls (`[System.IO.File]::ReadAllText`/`WriteAllText`) resolve them against the process-wide `[Environment]::CurrentDirectory`, which can silently diverge from `$PWD` (seen drifted to `C:\Windows\`). **Always resolve to an absolute path first** (`$repoRoot = $PSScriptRoot`; `[System.IO.Path]::GetFullPath((Join-Path $repoRoot "..\rel"))`) before any raw `[System.IO.File]` call.
