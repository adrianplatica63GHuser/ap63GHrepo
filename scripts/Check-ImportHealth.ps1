#Requires -Version 7
<#
.SYNOPSIS
  Answers the two import defects off the database in one command.

.DESCRIPTION
  Replaces the paste-block that was Appendix A of Identity.Rules.32.05.docx.
  Three things changed after the 32.05 UAT run of 2026-08-30:

    1. The container is found by NAME. Appendix A used
       `docker ps --filter "ancestor=postgis/postgis"`, and that filter
       resolves an untagged reference to `postgis/postgis:latest`, which is
       NOT what runs here (`postgis/postgis:16-3.4`). It would have fallen
       through to a `Select-String 'postgres|db'` fallback and worked by
       luck. The container is `ga40prj-postgres`; nothing needs detecting.

    2. Bug A is counted by PAGE IDENTITY, not by title. Appendix A grouped
       `document` by title, and the run proved that undercounts: the AI
       retitles a document differently on each read, so the two halves of a
       duplicated pair can hold DIFFERENT titles. Measured on run 5 —
       "FISA CORPULUI DE PROPRIETATE" (DOC01511) and "FISA CORPULUI DE
       PROPRIETATE TARLA 46, PARCELA 222/13/1" (DOC01519) are the same file
       imported twice, and a GROUP BY title finds neither. Grouping on the
       set of (file_name, file_size) found all three pairs. The title query
       is kept below as a cross-check and labelled as one.

    3. The Bug B sweep is split in two. Appendix A's second query ORed a
       real defect (pages whose file_size is NULL) with a sweep
       (single-page documents), so a row meant nothing until you worked out
       which limb produced it.

  ⚠️ Query 3 is EVIDENCE, NOT PROOF, for exactly the reason
  `src/lib/import/preexisting-check.ts` gives about its own key: two
  genuinely different scans off one machine can share a file name and a
  byte count. Read its rows against the source folders before deleting
  anything.

.EXAMPLE
  .\scripts\Check-ImportHealth.ps1
  .\scripts\Check-ImportHealth.ps1 -OutFile C:\dev\import-health.txt
#>
[CmdletBinding()]
param(
  [string] $Container = 'ga40prj-postgres',
  [string] $Database,
  [string] $DbUser,
  [string] $OutFile
)

$ErrorActionPreference = 'Stop'

# ⚠️ **Romanian is the only version that matters, and the first run of this
# script printed `ACT DE ├ÄMP─éR╚ÜEAL─é VOLUNTAR─é`.** psql emits UTF-8; PowerShell
# decodes a native command's stdout with [Console]::OutputEncoding, which on a
# Windows console is a legacy code page. Setting all three is what it takes:
# the console for what is displayed, $OutputEncoding for what crosses the pipe,
# and PGCLIENTENCODING so psql cannot be talked into anything else.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding           = [System.Text.Encoding]::UTF8
$env:PGCLIENTENCODING     = 'UTF8'

# ── Connection details ──────────────────────────────────────────────────────
# docker/postgres/docker-compose.yml defaults these to postgres/ga40db and
# lets .env override them, so read .env the same way rather than hardcoding.
# Default the report to the repo root rather than the caller's cwd — run from
# scripts\ the first time, it landed in scripts\import-health.txt.
$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not $OutFile) { $OutFile = Join-Path $repoRoot 'import-health.txt' }

$envFile = Join-Path $repoRoot '.env'
$fromEnv = @{}
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*(POSTGRES_USER|POSTGRES_DB)\s*=\s*(.+?)\s*$') {
      $fromEnv[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
    }
  }
}
if (-not $Database) { $Database = if ($fromEnv.POSTGRES_DB)   { $fromEnv.POSTGRES_DB }   else { 'ga40db'   } }
if (-not $DbUser)   { $DbUser   = if ($fromEnv.POSTGRES_USER) { $fromEnv.POSTGRES_USER } else { 'postgres' } }

# ── The container has to be up ──────────────────────────────────────────────
$running = (docker ps --format '{{.Names}}') -split '\r?\n' | Where-Object { $_ -eq $Container }
if (-not $running) {
  Write-Host "Container '$Container' is not running." -ForegroundColor Red
  Write-Host "Running containers:" -ForegroundColor Yellow
  docker ps --format '  {{.Names}}  ({{.Image}})'
  Write-Host "Start it with: docker compose -f docker/postgres/docker-compose.yml up -d" -ForegroundColor Yellow
  exit 1
}

$lines = [System.Collections.Generic.List[string]]::new()
function Emit([string]$s = '') { $lines.Add($s); Write-Host $s }

function Invoke-Q {
  param(
    [Parameter(Mandatory)] [string] $Number,
    [Parameter(Mandatory)] [string] $Title,
    [Parameter(Mandatory)] [string] $Reads,
    [Parameter(Mandatory)] [string] $Sql
  )
  Emit ''
  Emit ('─' * 78)
  Emit "$Number. $Title"
  Emit "   $Reads"
  Emit ('─' * 78)

  $out = $Sql | docker exec -i $Container psql -U $DbUser -d $Database -v ON_ERROR_STOP=1 -P pager=off 2>&1
  $text = ($out | Out-String).TrimEnd()
  if ($LASTEXITCODE -ne 0) {
    Emit "   QUERY FAILED (psql exit $LASTEXITCODE):"
    Emit $text
    return
  }
  Emit $text
}

Emit "Import health — $Container / $Database"
Emit "Run at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"

Invoke-Q -Number '1' `
  -Title 'BUG B — documents with no page at all' `
  -Reads 'Expect ZERO rows. Any row is a document nobody can ever see a scan of: either created before #32.05''s fix, or one whose tidy-up DELETE was refused — and in that case the run''s own row said so at the time.' `
  -Sql @'
SELECT d.code, d.title, d.created_at
  FROM document d
  LEFT JOIN document_page p ON p.document_id = d.id
 GROUP BY d.id, d.code, d.title, d.created_at
HAVING count(p.id) = 0
 ORDER BY d.created_at;
'@

Invoke-Q -Number '2' `
  -Title 'BUG B — pages stored with no byte size' `
  -Reads 'Expect ZERO rows. A NULL file_size makes a document permanently invisible to the Pre-existing stage, so it can never be recognised on a later import. This is a defect on its own, not a sweep.' `
  -Sql @'
SELECT d.code, d.title,
       count(p.id)         AS pages,
       count(p.file_size)  AS sized
  FROM document d
  JOIN document_page p ON p.document_id = d.id
 GROUP BY d.id, d.code, d.title
HAVING count(p.id) <> count(p.file_size)
 ORDER BY d.code;
'@

Invoke-Q -Number '3' `
  -Title 'BUG A — the same file imported twice, keyed on its pages' `
  -Reads 'The corrected Bug A count. Documents whose pages are the same set of (file name, byte size) are the same file imported twice, WHATEVER their titles say. EVIDENCE, NOT PROOF — two different scans off one machine can share a name and a size; check the rows against the source folders before deleting.' `
  -Sql @'
WITH sig AS (
  SELECT p.document_id,
         count(*) AS pages,
         md5(string_agg(
               p.file_name || '|' || coalesce(p.file_size::text, 'null'),
               E'\n' ORDER BY p.file_name, p.file_size)) AS page_sig
    FROM document_page p
   GROUP BY p.document_id
)
SELECT s.pages,
       count(*) AS copies,
       string_agg(d.code || ' = ' || coalesce(d.title, '(no title)'),
                  E'\n       ' ORDER BY d.code) AS documents
  FROM sig s
  JOIN document d ON d.id = s.document_id
 GROUP BY s.page_sig, s.pages
HAVING count(*) > 1
 ORDER BY count(*) DESC, s.pages DESC;
'@

Invoke-Q -Number '4' `
  -Title 'BUG A cross-check — documents sharing a title' `
  -Reads 'Appendix A''s original query, kept as a cross-check only. It UNDERCOUNTS: a pair whose second import was retitled differently does not appear here. Query 3 is the number to quote.' `
  -Sql @'
SELECT title, count(*) AS copies
  FROM document
 WHERE title IS NOT NULL
 GROUP BY title
HAVING count(*) > 1
 ORDER BY count(*) DESC, title;
'@

Invoke-Q -Number '5' `
  -Title 'CONTEXT — a page group that arrived with only one page' `
  -Reads 'Expect ZERO rows. The first run of this script listed all 62 single-page documents, which is 62 rows of nothing: a one-page .docx IS one page. A truncated page GROUP is the thing worth seeing, and its pages are numerically-named images. Authority is isPageGroupMember in src/lib/files/file-kinds.ts; the SQL below is a deliberately looser approximation of it, used only to narrow a sweep and never to decide anything.' `
  -Sql @'
-- The document must have exactly ONE page, and only then is that page's name
-- read. Grouping by file_name alongside the HAVING (the first draft) puts every
-- page of a multi-page document in a group of its own, each with count = 1, and
-- reports the lot.
WITH one_page AS (
  SELECT document_id, min(file_name) AS file_name
    FROM document_page
   GROUP BY document_id
  HAVING count(*) = 1
)
SELECT d.code, d.title, o.file_name
  FROM one_page o
  JOIN document d ON d.id = o.document_id
 WHERE o.file_name ~* '^[0-9]+\.(jpg|jpeg|png|tif|tiff|webp|gif|bmp)$'
 ORDER BY d.code;
'@

Emit ''
Emit ('─' * 78)
$lines -join [Environment]::NewLine | Set-Content -Path $OutFile -Encoding utf8
Write-Host "Saved to $((Resolve-Path $OutFile).Path)" -ForegroundColor Green
