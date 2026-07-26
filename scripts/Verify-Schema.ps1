<#
.SYNOPSIS
    Detect drift between the Drizzle schema and the actual database.

.DESCRIPTION
    Parses every pgTable("name", ...) declaration out of src\db\schema\index.ts
    and compares that list against information_schema.tables in the running
    container.

    This exists because schema_migrations can lie. migration_056 backfilled
    filenames 008-055 by assertion rather than by inspection, so a migration
    that was never actually applied is still recorded as applied, and
    Apply-Migration.ps1 will happily report "Database is up to date" while a
    table is missing. That is exactly how help_content / help_hint went absent
    until a 500 in the dev server surfaced it (Slice #21.09.help.error).

    Run this after Apply-Migration.ps1, and any time an API route reports
    'relation "..." does not exist'.

    Read-only: this script never writes to the database.

.PARAMETER Container
    Docker container name. Default: ga40prj-postgres

.PARAMETER Database
    Postgres database name. Default: ga40db

.PARAMETER DbUser
    Postgres user. Default: postgres

.PARAMETER ShowExtra
    Also list tables that exist in the database but are not declared in
    schema\index.ts. Off by default because several are legitimate
    (schema_migrations, spatial_ref_sys, PostGIS internals).

.EXAMPLE
    .\scripts\Verify-Schema.ps1

.EXAMPLE
    .\scripts\Verify-Schema.ps1 -ShowExtra

.NOTES
    Exit code 0 = no missing tables. Exit code 1 = drift found (suitable for CI).
#>
param(
    [string]$Container  = "ga40prj-postgres",
    [string]$Database   = "ga40db",
    [string]$DbUser     = "postgres",
    [switch]$ShowExtra
)

Set-StrictMode -Version Latest

# Resolve to absolute paths up front. Raw [System.IO.File] calls resolve
# relative paths against [Environment]::CurrentDirectory, which can differ
# from $PWD -- see the "Relative paths break raw [System.IO.File]" gotcha.
$repoRoot   = Split-Path -Parent $PSScriptRoot
$schemaFile = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "src\db\schema\index.ts"))

Write-Host "==== GA40 Schema Drift Check ===="
Write-Host "Container : $Container"
Write-Host "Database  : $Database"
Write-Host "Schema    : $schemaFile"
Write-Host "================================="
Write-Host ""

# ---------------------------------------------------------------------------
# Step 1 -- verify container is reachable
# ---------------------------------------------------------------------------
docker exec $Container psql -U $DbUser -d $Database -c "SELECT 1;" > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Cannot reach $Container. Is the container running? (docker ps)"
    exit 1
}

# ---------------------------------------------------------------------------
# Step 2 -- parse declared table names out of schema\index.ts
# ---------------------------------------------------------------------------
if (-not (Test-Path $schemaFile)) {
    Write-Error "Schema file not found: $schemaFile"
    exit 1
}

$schemaText = [System.IO.File]::ReadAllText($schemaFile)

# Matches:  pgTable("person", {        and        pgTable(
#                                                   "person",
# The [\s\S] class spans newlines; PowerShell regex has no /s flag by default.
# NOTE: do not name this $matches -- that collides with PowerShell's automatic
# $Matches variable and misbehaves under Set-StrictMode.
$tableMatches = [regex]::Matches($schemaText, 'pgTable\(\s*"([a-z_0-9]+)"')
$declared = @()
foreach ($m in $tableMatches) {
    $declared += $m.Groups[1].Value
}
$declared = @($declared | Sort-Object -Unique)

if ($declared.Count -eq 0) {
    Write-Error "Parsed 0 pgTable declarations from $schemaFile. Has the file format changed?"
    exit 1
}

Write-Host "Declared in schema\index.ts : $($declared.Count) table(s)"

# ---------------------------------------------------------------------------
# Step 3 -- read actual tables from the database
# ---------------------------------------------------------------------------
$sql = @"
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
"@

$rawLines = docker exec $Container psql -U $DbUser -d $Database -t -A -c $sql 2>&1
$actual   = @($rawLines | ForEach-Object { "$_".Trim() } | Where-Object { $_ -ne "" })

Write-Host "Present in database         : $($actual.Count) table(s)"
Write-Host ""

# ---------------------------------------------------------------------------
# Step 4 -- compare
# ---------------------------------------------------------------------------
$missing = @($declared | Where-Object { $actual -notcontains $_ })
$extra   = @($actual   | Where-Object { $declared -notcontains $_ })

if ($missing.Count -eq 0) {
    Write-Host "OK - every table declared in schema\index.ts exists in the database."
} else {
    Write-Host "MISSING - declared in schema\index.ts but NOT in the database:"
    foreach ($t in $missing) {
        Write-Host "   - $t"
    }
    Write-Host ""
    Write-Host "These tables are declared in code but do not exist. The API routes"
    Write-Host "that query them will return 500 with 'relation ... does not exist'."
    Write-Host ""
    Write-Host "To fix: find the migration that creates each table, then apply it"
    Write-Host "directly (Apply-Migration.ps1 will skip it if schema_migrations"
    Write-Host "already has a false entry):"
    Write-Host ""
    Write-Host '   docker cp src/db/migration_NNN_name.sql ga40prj-postgres:/tmp/mNNN.sql'
    Write-Host '   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/mNNN.sql'
}

if ($ShowExtra -and $extra.Count -gt 0) {
    Write-Host ""
    Write-Host "EXTRA - in the database but not declared in schema\index.ts:"
    Write-Host "(schema_migrations, spatial_ref_sys and PostGIS internals are expected here)"
    foreach ($t in $extra) {
        Write-Host "   - $t"
    }
}

Write-Host ""
Write-Host "================================="
Write-Host "Declared : $($declared.Count)"
Write-Host "Present  : $($actual.Count)"
Write-Host "Missing  : $($missing.Count)"
Write-Host "================================="

if ($missing.Count -gt 0) {
    exit 1
}
exit 0
