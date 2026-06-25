# build-ciprian-image.ps1
#
# Builds the GA40 UAT Docker image for Ciprian's PC and exports it.
# Run from C:\dev\ga40prj\ in PowerShell:
#
#   .\build-ciprian-image.ps1
#
# Prerequisites:
#   - Docker Desktop running
#   - .env file present in C:\dev\ga40prj\ with real values filled in
#   - C:\dev\ga40prj.Ciprian\ folder exists (created once manually)
#   - ga40prj-postgres container running with your current local schema applied
#
# What this script does:
#   1. Reads NEXT_PUBLIC_* values from your .env file
#   2. Builds the Docker image (takes 5-10 min on first run; faster after)
#   3. Exports the image to C:\dev\ga40prj.Ciprian\docker\app\ga40prj-app.tar
#   4. Dumps the current schema straight from ga40prj-postgres (safe, UTF-8 --
#      no manual pg_dump step) into the Ciprian init folder as 02-schema.sql
#      (used only the first time Ciprian's Docker volume initializes)
#   5. Assembles C:\dev\ga40prj.Ciprian\ciprian-schema-update.sql -- a single,
#      fixed-name file that fully wipes and rebuilds Ciprian's database (schema
#      AND reference/lookup data, both pulled live from ga40prj-postgres). This
#      is the file used for every schema update after the first delivery -- see
#      UC-C6 in the Operations Guide. There is no hand-maintained seed file
#      involved: reference data is pg_dump'd fresh from dev every time this
#      script runs, so it can never silently drift out of sync.
#
# To update Ciprian after a new slice (whether or not it touches the DB):
#   1. Run this script again
#   2. Send the new ga40prj-app.tar AND ciprian-schema-update.sql to Ciprian
#      (replace both of his copies, same filenames every time)
#   3. Ciprian runs update.bat, then applies ciprian-schema-update.sql per UC-C6
#      (this wipes and reloads his UAT database -- by design, at this stage)

$ErrorActionPreference = "Stop"

# ---- Step 0: sanity checks ---------------------------------------------------

if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env not found. Run this script from C:\dev\ga40prj\" -ForegroundColor Red
    exit 1
}

$repoRoot = $PSScriptRoot
$ciprianRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "..\ga40prj.Ciprian"))
if (-not (Test-Path $ciprianRoot)) {
    Write-Host "ERROR: $ciprianRoot does not exist. Create it first (mkdir C:\dev\ga40prj.Ciprian)." -ForegroundColor Red
    exit 1
}
$refDataDumpLocal = Join-Path $repoRoot "ga40prj-refdata-dump.sql"

# ---- Step 1: read NEXT_PUBLIC_* from .env ------------------------------------

$envVars = @{}
Get-Content ".env" | ForEach-Object {
    if ($_ -match '^([A-Za-z0-9_]+)=(.+)$') {
        $envVars[$matches[1]] = $matches[2].Trim()
    }
}

$mapsKey = $envVars['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY']

if ($envVars.ContainsKey('NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID')) {
    $mapsMapId = $envVars['NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID']
} else {
    $mapsMapId = 'DEMO_MAP_ID'
}

$sbUrl  = $envVars['NEXT_PUBLIC_SUPABASE_URL']
$sbAnon = $envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']

if (-not $mapsKey) {
    Write-Host "WARNING: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not found in .env -- maps will not work." -ForegroundColor Yellow
}

# ---- Step 2: build the Docker image ------------------------------------------

Write-Host ""
Write-Host "Building GA40 UAT Docker image..." -ForegroundColor Cyan
Write-Host "(First build takes 5-10 min; subsequent builds are faster due to layer caching.)"
Write-Host ""

docker build `
    --build-arg "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$mapsKey" `
    --build-arg "NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=$mapsMapId" `
    --build-arg "NEXT_PUBLIC_SUPABASE_URL=$sbUrl" `
    --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=$sbAnon" `
    --build-arg "NEXT_PUBLIC_APP_URL=http://localhost:3000" `
    -t ga40prj-app:latest `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: docker build failed (exit code $LASTEXITCODE)." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Build successful." -ForegroundColor Green

# ---- Step 3: export the image ------------------------------------------------

$outputDir = "$ciprianRoot\docker\app"
$outputTar = "$outputDir\ga40prj-app.tar"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Write-Host ""
Write-Host "Exporting image to $outputTar ..." -ForegroundColor Cyan
Write-Host "(This can take 1-2 minutes -- the file will be ~600-800 MB uncompressed.)"
Write-Host ""

docker save ga40prj-app:latest -o $outputTar

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker save failed." -ForegroundColor Red
    exit 1
}

Write-Host "Export complete." -ForegroundColor Green

# ---- Step 4: regenerate schema SQL directly from the running Postgres container ----
# This file is the combined SQL migration applied to a fresh Postgres instance.
#
# IMPORTANT -- do NOT generate this file with `pg_dump ... > file.sql` in PowerShell.
# PowerShell's `>` redirect writes UTF-16LE with a BOM, which Postgres's
# docker-entrypoint-initdb.d cannot parse -- it silently corrupts the init script,
# the schema never gets created, and the app fails with "Failed to load" against an
# empty database the next time someone starts from a fresh volume. (This is exactly
# what happened to Ciprian's UAT package after the Slice.14.03 laptop migration.)
# Always dump *inside* the container with `-f`, then `docker cp` the result out --
# that path is always UTF-8, no redirect involved.

$schemaDest = "$ciprianRoot\docker\postgres\init\02-schema.sql"

Write-Host ""
Write-Host "Dumping current schema from ga40prj-postgres..." -ForegroundColor Cyan

docker exec ga40prj-postgres pg_dump --schema-only --no-owner --no-privileges -U postgres -d ga40db -f /tmp/ga40prj-schema-dump.sql

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: pg_dump failed inside ga40prj-postgres. Is the container running?" -ForegroundColor Red
    Write-Host "       Start it with: docker compose -f docker\postgres\docker-compose.yml --env-file .env up -d"
    exit 1
}

docker cp ga40prj-postgres:/tmp/ga40prj-schema-dump.sql $schemaDest

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: docker cp failed -- could not retrieve the schema dump." -ForegroundColor Red
    exit 1
}

# Safety net: pg_dump always emits a bare "CREATE SCHEMA topology;" when PostGIS
# topology is installed. Ciprian's 01-extensions.sql already creates that schema
# (via CREATE EXTENSION IF NOT EXISTS postgis_topology), so the bare statement would
# fail with "schema topology already exists" on first boot and abort the rest of this
# init script (Postgres's docker-entrypoint runs each file with ON_ERROR_STOP=1) --
# meaning none of the ~30 application tables after it would get created either.
# Make it idempotent. Written via .NET so it's plain UTF-8 with no BOM, regardless of
# PowerShell version.
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$schemaText = [System.IO.File]::ReadAllText($schemaDest)
$schemaText = $schemaText -replace 'CREATE SCHEMA topology;', 'CREATE SCHEMA IF NOT EXISTS topology;'
[System.IO.File]::WriteAllText($schemaDest, $schemaText, $utf8NoBom)

Write-Host ""
Write-Host "Schema SQL regenerated and copied to Ciprian's init folder." -ForegroundColor Green

# ---- Step 5: assemble ciprian-schema-update.sql (the fixed-name update file) ----
# This is the single file Adrian sends to Ciprian for every schema update (UC-C6).
# It is always regenerated in full, never hand-edited, and always has the same
# name -- there is nothing for Adrian to "identify" before sending it.
#
# Contents, in order:
#   1. A full wipe of the public schema (DROP SCHEMA ... CASCADE / CREATE SCHEMA)
#   2. The Postgres extensions Ciprian's stack needs (from his own 01-extensions.sql)
#   3. The schema just dumped above (identical to 02-schema.sql)
#   4. A fresh data-only dump of every lookup_* table, pulled live from
#      ga40prj-postgres -- NOT from any file in this repo, so it is always
#      exactly what dev currently has, with no separate step to remember.
#
# Ciprian's database is fully disposable at this stage (UC-C6), so wiping it on
# every update is intentional, not a bug.

Write-Host ""
Write-Host "Dumping current reference/lookup data from ga40prj-postgres..." -ForegroundColor Cyan

docker exec ga40prj-postgres pg_dump --data-only --no-owner --no-privileges -t 'lookup_*' -U postgres -d ga40db -f /tmp/ga40prj-refdata-dump.sql

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: pg_dump (data-only) failed inside ga40prj-postgres." -ForegroundColor Red
    exit 1
}

docker cp ga40prj-postgres:/tmp/ga40prj-refdata-dump.sql $refDataDumpLocal

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: docker cp failed -- could not retrieve the reference-data dump." -ForegroundColor Red
    exit 1
}

$extensionsSrc = "$ciprianRoot\docker\postgres\init\01-extensions.sql"
if (-not (Test-Path $extensionsSrc)) {
    Write-Host "ERROR: $extensionsSrc not found -- cannot assemble ciprian-schema-update.sql." -ForegroundColor Red
    exit 1
}

$updateFileDest = "$ciprianRoot\ciprian-schema-update.sql"

$header = @"
-- ciprian-schema-update.sql
-- AUTO-GENERATED by build-ciprian-image.ps1 -- do not hand-edit, it is
-- overwritten on every build. Always has this same filename (UC-C6).
--
-- WARNING: running this file WIPES Ciprian's entire database -- every table,
-- both operational data and reference/lookup data -- then rebuilds it to
-- exactly match Adrian's dev database at the time this file was generated.
-- This is intentional at this stage of the project: Ciprian's UAT data does
-- not need to be preserved across updates.
--
-- Apply with (from C:\dev\ga40prj.Ciprian\, in PowerShell):
--   docker cp ciprian-schema-update.sql ciprian-ga40prj-postgres:/tmp/ciprian-schema-update.sql
--   docker exec ciprian-ga40prj-postgres psql -U postgres -d ga40db -v ON_ERROR_STOP=1 -f /tmp/ciprian-schema-update.sql 2>&1 | Tee-Object -FilePath schema-update.log

-- ---- 1. Wipe everything --------------------------------------------------
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

"@

$extensionsText = [System.IO.File]::ReadAllText($extensionsSrc)
$schemaText      = [System.IO.File]::ReadAllText($schemaDest)
$refDataText     = [System.IO.File]::ReadAllText($refDataDumpLocal)

$combined = $header `
    + "-- ---- 2. Extensions (from Ciprian's 01-extensions.sql) -------------------`r`n" `
    + $extensionsText + "`r`n" `
    + "-- ---- 3. Schema (freshly dumped from dev, same as 02-schema.sql) ---------`r`n" `
    + $schemaText + "`r`n" `
    + "-- ---- 4. Reference/lookup data (freshly dumped from dev) -----------------`r`n" `
    + $refDataText

[System.IO.File]::WriteAllText($updateFileDest, $combined, $utf8NoBom)
Remove-Item $refDataDumpLocal -Force

Write-Host ""
Write-Host "ciprian-schema-update.sql assembled -- ready to send to Ciprian." -ForegroundColor Green

# ---- Done --------------------------------------------------------------------

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Image ready : $outputTar" -ForegroundColor Green
Write-Host " Update file : $updateFileDest" -ForegroundColor Green
Write-Host " Next step   : send BOTH files to Ciprian" -ForegroundColor Green
Write-Host "               (replace his docker\app\ga40prj-app.tar" -ForegroundColor Green
Write-Host "                and his ciprian-schema-update.sql)" -ForegroundColor Green
Write-Host " Ciprian     : start.bat (first run) OR update.bat + apply" -ForegroundColor Green
Write-Host "               ciprian-schema-update.sql per UC-C6" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
