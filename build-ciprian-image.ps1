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
#
# To update Ciprian after a new slice:
#   1. Run this script again
#   2. Send the new ga40prj-app.tar to Ciprian (replace his copy)
#   3. Ciprian runs update.bat

$ErrorActionPreference = "Stop"

# ---- Step 0: sanity checks ---------------------------------------------------

if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env not found. Run this script from C:\dev\ga40prj\" -ForegroundColor Red
    exit 1
}

$ciprianRoot = "..\ga40prj.Ciprian"
if (-not (Test-Path $ciprianRoot)) {
    Write-Host "ERROR: $ciprianRoot does not exist. Create it first (mkdir C:\dev\ga40prj.Ciprian)." -ForegroundColor Red
    exit 1
}

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

# ---- Done --------------------------------------------------------------------

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Image ready: $outputTar" -ForegroundColor Green
Write-Host " Next step  : send this .tar file to Ciprian" -ForegroundColor Green
Write-Host "              (replace his docker\app\ga40prj-app.tar)" -ForegroundColor Green
Write-Host " Ciprian    : runs update.bat (or start.bat on first run)" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
