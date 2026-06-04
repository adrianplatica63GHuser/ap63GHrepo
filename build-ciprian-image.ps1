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
#
# What this script does:
#   1. Reads NEXT_PUBLIC_* values from your .env file
#   2. Builds the Docker image (takes 5-10 min on first run; faster after)
#   3. Exports the image to C:\dev\ga40prj.Ciprian\docker\app\ga40prj-app.tar
#   4. Copies the latest schema migration SQL into the Ciprian init folder
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

# ---- Step 4: copy latest schema SQL into Ciprian's init folder ---------------
# This file is the combined SQL migration applied to a fresh Postgres instance.
# Generate it with:
#   pg_dump --schema-only --no-owner --no-privileges -d ga40db > supabase_migrations.sql

$schemaSrc  = "supabase_migrations.sql"
$schemaDest = "$ciprianRoot\docker\postgres\init\02-schema.sql"

if (Test-Path $schemaSrc) {
    Copy-Item $schemaSrc $schemaDest -Force
    Write-Host ""
    Write-Host "Schema SQL copied to Ciprian's init folder." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "WARNING: supabase_migrations.sql not found -- skipping schema copy." -ForegroundColor Yellow
    Write-Host "         Ciprian will need to apply the schema manually via pgAdmin on first run."
    Write-Host "         Generate it with: pg_dump --schema-only --no-owner -d ga40db > supabase_migrations.sql"
}

# ---- Done --------------------------------------------------------------------

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Image ready: $outputTar" -ForegroundColor Green
Write-Host " Next step  : send this .tar file to Ciprian" -ForegroundColor Green
Write-Host "              (replace his docker\app\ga40prj-app.tar)" -ForegroundColor Green
Write-Host " Ciprian    : runs update.bat (or start.bat on first run)" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
