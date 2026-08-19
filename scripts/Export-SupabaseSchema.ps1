<#
.SYNOPSIS
    Regenerate src\db\supabase_schema_full.sql from the local Docker database.

.DESCRIPTION
    supabase_schema_full.sql is the from-scratch rebuild script for a Supabase
    project (run after supabase_reset.sql). It used to be hand-maintained, and
    it drifted badly: by Slice #21.09 it declared 37 tables where
    src\db\schema\index.ts declared 49, and 21 of those 37 were missing columns
    added by later migrations. Any database rebuilt from it was born broken.

    This script replaces hand-maintenance with generation, the same way
    build-ciprian-image.ps1 generates ciprian-schema-update.sql. Run it after
    every migration and commit the result.

    PRE-FLIGHT: aborts if any migration_*.sql in src\db is unapplied, or if
    Verify-Schema.ps1 reports a missing table. Generating the schema from an
    incomplete database is precisely how the drift got baked in last time.

.PARAMETER Container
    Docker container name. Default: ga40prj-postgres

.PARAMETER Database
    Postgres database name. Default: ga40db

.PARAMETER DbUser
    Postgres user. Default: postgres

.PARAMETER SkipVerify
    Skip the Verify-Schema.ps1 pre-flight. Only for recovering a database you
    know is incomplete; the output must not be committed.

.EXAMPLE
    .\scripts\Export-SupabaseSchema.ps1

.NOTES
    Never use  docker exec ... pg_dump > file.sql  on Windows. PowerShell's >
    redirection writes UTF-16LE with a BOM, and psql then chokes on the null
    bytes and mangles Romanian diacritics. This script always dumps to the
    container filesystem and copies the file out with docker cp.
#>
param(
    [string]$Container = "ga40prj-postgres",
    [string]$Database  = "ga40db",
    [string]$DbUser    = "postgres",
    [switch]$SkipVerify
)

Set-StrictMode -Version Latest

$repoRoot   = Split-Path -Parent $PSScriptRoot
$outFile    = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "src\db\supabase_schema_full.sql"))
$rawFile    = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "src\db\.schema_dump_raw.sql"))

Write-Host "==== GA40 Supabase Schema Export ===="
Write-Host "Container : $Container"
Write-Host "Database  : $Database"
Write-Host "Output    : $outFile"
Write-Host "====================================="
Write-Host ""

# ---------------------------------------------------------------------------
# Step 1 -- container reachable
# ---------------------------------------------------------------------------
docker exec $Container psql -U $DbUser -d $Database -c "SELECT 1;" > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Cannot reach $Container. Is the container running? (docker ps)"
    exit 1
}

# ---------------------------------------------------------------------------
# Step 2 -- pre-flight: no unapplied migrations
# ---------------------------------------------------------------------------
Write-Host "Pre-flight: checking for unapplied migrations..."

$appliedRows = docker exec $Container psql -U $DbUser -d $Database -t -A `
    -c "SELECT filename FROM schema_migrations;" 2>&1
$applied = @{}
foreach ($row in $appliedRows) {
    $r = "$row".Trim()
    if ($r -ne "") { $applied[$r] = $true }
}

$migrationsDir = Join-Path $repoRoot "src\db"
$allFiles = Get-ChildItem -Path $migrationsDir -Filter "migration_*.sql" | Sort-Object Name
$pending  = @($allFiles | Where-Object { -not $applied.ContainsKey($_.Name) })

if ($pending.Count -gt 0) {
    Write-Host ""
    Write-Host "ABORTING - $($pending.Count) unapplied migration(s):"
    foreach ($p in $pending) { Write-Host "   - $($p.Name)" }
    Write-Host ""
    Write-Host "Run .\scripts\Apply-Migration.ps1 first."
    exit 1
}
Write-Host "  OK - no pending migrations."

# ---------------------------------------------------------------------------
# Step 3 -- pre-flight: schema matches schema\index.ts
# ---------------------------------------------------------------------------
if ($SkipVerify) {
    Write-Host "Pre-flight: schema drift check SKIPPED (-SkipVerify)."
    Write-Host "  WARNING: do not commit the output of this run."
} else {
    Write-Host "Pre-flight: checking for schema drift..."
    $verify = Join-Path $PSScriptRoot "Verify-Schema.ps1"
    & $verify -Container $Container -Database $Database -DbUser $DbUser | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ABORTING - Verify-Schema.ps1 reported missing tables."
        Write-Host "Run it directly to see which:  .\scripts\Verify-Schema.ps1"
        Write-Host ""
        Write-Host "Generating supabase_schema_full.sql from an incomplete database"
        Write-Host "is how the previous drift was baked in. Fix the database first."
        exit 1
    }
    Write-Host "  OK - no drift."
}
Write-Host ""

# ---------------------------------------------------------------------------
# Step 4 -- dump schema to the CONTAINER filesystem, then copy out
# ---------------------------------------------------------------------------
# Dumping to the container and using docker cp avoids PowerShell's UTF-16LE
# redirection corruption entirely.
Write-Host "Dumping schema..."

$tmpInContainer = "/tmp/ga40_schema_dump.sql"

docker exec $Container pg_dump -U $DbUser $Database `
    --schema-only --no-owner --no-privileges --schema=public `
    -f $tmpInContainer
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed."
    exit 1
}

docker cp "${Container}:${tmpInContainer}" $rawFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "docker cp failed."
    exit 1
}
Write-Host "  OK - raw dump retrieved."

# ---------------------------------------------------------------------------
# Step 5 -- post-process
# ---------------------------------------------------------------------------
Write-Host "Post-processing..."

$body = [System.IO.File]::ReadAllText($rawFile)

# The dump emits CREATE SCHEMA for the schema it covers, and replayed onto a
# database that already has it -- and `public` ALWAYS already exists -- psql
# aborts under ON_ERROR_STOP with 'schema "public" already exists'.
#
# This was a single -replace for `topology`, which under `--schema=public`
# pg_dump never emits at all, so it could not have fired; `public` was fixed by
# hand in the generated file instead, in Slice #29.04, which meant the very next
# run of this script would have put the failure straight back. The pattern below
# covers any unquoted schema name -- in practice only `public` can appear here,
# and a name pg_dump has to quote ("user", "Mixed") would not match, which is
# noted rather than handled because this filter cannot produce one. (Slice #31.01)
$body = $body -replace '(?m)^CREATE SCHEMA ([A-Za-z_][A-Za-z0-9_]*);', 'CREATE SCHEMA IF NOT EXISTS $1;'

# pg_dump opens with  set_config('search_path', '', false)  -- an EMPTY search
# path, for the whole SESSION, because everything it then emits is schema-
# qualified and it does not want to depend on the caller's path. Correct for
# the dump; a trap for whatever runs it. scripts/supabase-sync.ts applies this
# file through its `supaPool` and then issues unqualified TRUNCATEs on the same
# connection, which failed with `relation "lookup_property_person_role" does
# not exist` about a table that had just been created two thousand lines above.
# Reproduced exactly: apply the file and TRUNCATE in one psql session and the
# same error appears; do it in two sessions and it does not.
#
# So put the path back. `false` (session-wide, not transaction-local) mirrors
# what pg_dump did, and undoes it for the rest of the connection's life.
$body = $body + @"

--
-- Restore a usable search_path for the session that applied this file.
-- pg_dump emptied it at the top; every consumer that issues an unqualified
-- statement afterwards on the same connection needs it back. (Slice #29.04)
--

SELECT pg_catalog.set_config('search_path', 'public', false);
"@

# Normalise CRLF -> LF (.gitattributes enforces LF everywhere in this repo).
$body = $body -replace "`r`n", "`n"

$stamp  = Get-Date -Format "yyyy-MM-dd HH:mm"
$header = @"
-- ============================================================
-- ga40prj -- Full Schema Script (Supabase)
--
-- GENERATED FILE -- DO NOT EDIT BY HAND.
-- Regenerate with:  .\scripts\Export-SupabaseSchema.ps1
--
-- Generated : $stamp
-- Source    : local Docker database ($Database @ $Container)
--
-- Applies the complete schema from scratch after running
-- supabase_reset.sql. Run in the Supabase SQL Editor.
-- PostGIS must already be enabled in the project.
--
-- This file was hand-maintained until Slice #21.09.help.error, by which
-- point it had drifted to 37 of 49 tables with 21 more missing columns.
-- It is now generated from the live schema so it cannot drift again.
-- For an ADDITIVE repair of an existing database (which this file is not --
-- it assumes an empty schema), use supabase_repair_missing_tables.sql.
-- ============================================================

-- Every extension the schema below depends on. pg_dump does not emit these
-- (it dumps objects, not the extensions their operator classes come from), so
-- they are prepended here. pg_trgm was missing until Slice #31.01, which meant
-- this file died 1748 lines in with `operator class "public.gin_trgm_ops" does
-- not exist for access method "gin"` -- on a file whose whole job is to build a
-- database from scratch. Nothing had ever applied it to an empty database.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

"@

[System.IO.File]::WriteAllText($outFile, $header + $body)

Remove-Item $rawFile -ErrorAction SilentlyContinue
docker exec $Container rm -f $tmpInContainer > $null 2>&1

# ---------------------------------------------------------------------------
# Step 6 -- report
# ---------------------------------------------------------------------------
$tableCount = ([regex]::Matches($body, '(?m)^CREATE TABLE')).Count

Write-Host "  OK - written."
Write-Host ""
Write-Host "====================================="
Write-Host "Tables in output : $tableCount"
Write-Host "Output file      : $outFile"
Write-Host "====================================="
Write-Host ""
Write-Host "Review with 'git diff src/db/supabase_schema_full.sql' before committing."
