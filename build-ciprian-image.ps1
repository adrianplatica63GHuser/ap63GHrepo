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
#   - ga40prj-postgres container running with ALL migrations applied
#     (run scripts\Apply-Migration.ps1 first if unsure -- this script checks)
#
# What this script does:
#   0. Sanity checks (folder, .env)
#   0.5. PRE-FLIGHT: verifies dev DB has no unapplied migrations before dumping.
#        If any migration_*.sql in src\db\ is not recorded in schema_migrations,
#        the script aborts -- generating ciprian-schema-update.sql from an
#        incomplete schema would silently corrupt Ciprian's database.
#   1. Reads NEXT_PUBLIC_* values from your .env file
#   2. Builds the Docker image (takes 5-10 min on first run; faster after)
#   3. Exports the image to C:\dev\ga40prj.Ciprian\docker\app\ga40prj-app.tar
#      (as .tar.new until step 7 promotes it -- see the staging note below)
#   4. Dumps the current schema straight from ga40prj-postgres (safe, UTF-8 --
#      no manual pg_dump step) for the Ciprian init folder as 02-schema.sql
#      (used only the first time Ciprian's Docker volume initializes)
#   5. Assembles C:\dev\ga40prj.Ciprian\ciprian-schema-update.sql -- a single,
#      fixed-name file that fully wipes and rebuilds Ciprian's database (schema
#      AND reference/lookup data, both pulled live from ga40prj-postgres). This
#      is the file used for every schema update after the first delivery -- see
#      UC-C6 in the Operations Guide. There is no hand-maintained seed file
#      involved: reference data is pg_dump'd fresh from dev every time this
#      script runs, so it can never silently drift out of sync.
#   5.5 Regenerates the init folder's 03-reference-data.sql from that same live
#      dump. It used to be hand-maintained, and had rotted into a file that
#      aborts Ciprian's first boot outright -- see the step for the detail.
#   6. VERIFIES the assembled package against dev: every reference table's row
#      count, the document types and which of them carry a form, and the
#      presence of the schema itself. Refuses to promote anything on a
#      mismatch.
#   7. Promotes the verified files and zips the init folder for delivery.
#
# ⚠️ Every file that REPLACES one of Ciprian's is written as a sibling `.new`
# and only renamed into place by step 7 -- four of them: the tar, the update
# file and the two init .sql files. (README-INIT.txt and ciprian-init.zip are
# written in place, but only after step 6 has passed, so the property is the
# same.) A run that fails anywhere -- including in the verification --
# leaves Ciprian's folder exactly as the last good build left it, because the
# previous package is a known-good one and a build that cannot vouch for its
# replacement has no business destroying it.
#
# To update Ciprian after a new slice (whether or not it touches the DB):
#   1. Run scripts\Apply-Migration.ps1 to make sure dev is fully up to date
#   2. Run this script
#   3. Send Ciprian ALL THREE deliverables, names unchanged:
#        - ga40prj-app.tar             -> his docker\app\ (replace)
#        - ciprian-schema-update.sql   -> his folder root (replace)
#        - ciprian-init.zip            -> unpack over his
#                                         docker\postgres\init\ (replace the
#                                         three .sql files and README-INIT.txt)
#      The zip matters only on a first-time setup or a full reset (UC-C8) -- but
#      that is exactly why it has to be sent every time: he cannot unpack, on
#      the day he resets, a file he was never given. Before this it was never
#      sent at all, so his init folder still rebuilt his database from the day
#      he set the box up.
#   4. Ciprian runs update.bat, then applies ciprian-schema-update.sql per UC-C6
#      (this wipes and reloads his UAT database -- by design, at this stage)
#
# NOTE -- upcoming transition (data-preservation mode):
#   Once Ciprian starts keeping real data, the full-wipe delivery above will be
#   replaced by a delta-migration approach: only the migration_*.sql files that
#   Ciprian has NOT yet applied (identified by querying his schema_migrations
#   table) are sent and applied in order. The pre-flight check in Step 0.5 is
#   already the foundation for that: it confirms dev's schema_migrations is
#   complete before any delivery action. A future script
#   (ciprian-send-migrations.ps1 or similar) will handle the delta delivery.

$ErrorActionPreference = "Stop"

# ⚠️ Without this, every `if ($LASTEXITCODE -ne 0)` block below is dead code on
# PowerShell 7.4+. `$PSNativeCommandUseErrorActionPreference` graduated from
# experimental to ON by default there, which turns any non-zero exit from a
# NATIVE command (docker, and psql/pg_dump through it) into a terminating error
# under `Stop` -- so the script dies on the docker line itself and Adrian gets a
# raw exception instead of the tailored "is the container running?" message the
# next four lines were written to give him. The script checks $LASTEXITCODE
# after every native call and exits 1 itself; this just lets it get there.
# Assigning it on 7.0-7.3, where the variable does not exist, is harmless.
$PSNativeCommandUseErrorActionPreference = $false

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

# Discard whatever has been staged so far. Defined HERE, before the first
# staged write, because every early `exit 1` below it -- a failed docker save,
# a failed pg_dump, a missing 01-extensions.sql -- would otherwise strand its
# staged files, and the first of those is an ~800 MB .tar.new.
#
# The `$f` test before Test-Path is what makes it callable from those early
# exits: the later variables do not exist yet at the top of the script, and an
# unassigned variable is $null, which Test-Path rejects as an argument rather
# than treating as "no".
# Declared before the function so that a $PROFILE with Set-StrictMode -Version 2
# or later -- which a script inherits -- cannot turn "docker save failed" into
# "the variable cannot be retrieved because it has not been set".
$outputTarNew = $schemaDestNew = $updateFileDestNew = $initRefDestNew = $null

function Remove-StagedFiles {
    foreach ($f in @($updateFileDestNew, $initRefDestNew, $schemaDestNew, $outputTarNew)) {
        if ($f -and (Test-Path -LiteralPath $f)) {
            # try/catch, not a bare Remove-Item: $ErrorActionPreference is Stop,
            # so one failure (an AV hold on a file written seconds ago is the
            # realistic one) would throw straight out past the remaining files
            # AND past whatever message the caller was about to print.
            try {
                Remove-Item -LiteralPath $f -Force
                Write-Host "  discarded staged file: $f" -ForegroundColor Yellow
            } catch {
                Write-Host "  COULD NOT discard $f -- delete it by hand." -ForegroundColor Red
            }
        }
    }
}

# The `exit 1` paths below all call Remove-StagedFiles explicitly. This catches
# the other way out: under $ErrorActionPreference = "Stop" a File I/O failure
# TERMINATES rather than exits, and would otherwise strand up to four staged
# files -- the first of them an ~800 MB .tar.new -- with a raw exception and no
# word about them.
#
# ⚠️ It does NOT cover Ctrl-C. A pipeline stop raises PipelineStoppedException,
# which PowerShell delivers to `finally` and to nothing else -- not to trap,
# not to catch. Interrupting the 1-2 minute docker save still strands the
# .tar.new, and only a try/finally around the whole body would change that.
trap {
    Remove-StagedFiles
    Write-Host ""
    Write-Host "Aborted -- nothing in Ciprian's folder was changed." -ForegroundColor Red
    break
}

# ---- Step 0.5: pre-flight -- verify dev DB has no unapplied migrations -------
#
# pg_dump (Step 4) captures whatever state ga40prj-postgres is in right now.
# If a migration file exists in src\db\ but has not been applied, the dump
# produces an incomplete schema and Ciprian gets a corrupt database.
# This block aborts early with a clear error before any expensive work starts.

Write-Host ""
Write-Host "Pre-flight: checking dev migration state..." -ForegroundColor Cyan

# Is schema_migrations present in the dev DB?
# ⚠️ No `2>&1`, and a $LASTEXITCODE check under it. Both were the other way
# round until this slice, and together they turned "the container is not
# running" into a confident lie: `docker exec` writes `Error response from
# daemon: ...` to stderr, `2>&1` folded that into $smExists, `-eq "f"` was
# therefore false, the bootstrap branch never fired -- and the loop below then
# filled $appliedSet with error text, so every migration on disk looked
# unapplied and the script aborted telling Adrian to apply seventy migrations
# that were already applied. On PowerShell 7.4 that path was unreachable
# because the native-command preference terminated first; turning that off at
# the top of this file (see there) is what makes these checks load-bearing.
$smExists = docker exec ga40prj-postgres psql -U postgres -d ga40db -t -c `
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schema_migrations');" `
    | ForEach-Object { "$_".Trim() } | Where-Object { $_ -ne "" }

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: docker exec failed -- is the ga40prj-postgres container running?" -ForegroundColor Red
    Write-Host "       Start it with: docker compose -f docker\postgres\docker-compose.yml --env-file .env up -d" -ForegroundColor Yellow
    exit 1
}

if ($smExists -eq "f") {
    Write-Host ""
    Write-Host "ERROR: schema_migrations table not found in ga40prj-postgres." -ForegroundColor Red
    Write-Host "       Run  scripts\Apply-Migration.ps1  to bootstrap it, then retry." -ForegroundColor Yellow
    exit 1
}

# Read applied migration filenames from dev DB
$appliedRaw = docker exec ga40prj-postgres psql -U postgres -d ga40db -t -c `
    "SELECT filename FROM schema_migrations ORDER BY filename;"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: could not read schema_migrations from ga40prj-postgres." -ForegroundColor Red
    exit 1
}

$appliedSet = @{}
foreach ($line in $appliedRaw) {
    $trimmed = "$line".Trim()
    if ($trimmed -ne "") { $appliedSet[$trimmed] = $true }
}

# Compare against migration_*.sql files on disk
$migrationsDir  = Join-Path $repoRoot "src\db"
$migrationFiles = @(Get-ChildItem -Path $migrationsDir -Filter "migration_*.sql" | Sort-Object Name)
$unapplied      = @($migrationFiles | Where-Object { -not $appliedSet.ContainsKey($_.Name) })

if ($unapplied.Count -gt 0) {
    Write-Host ""
    Write-Host "ERROR: $($unapplied.Count) migration(s) in src\db\ have not been applied to dev:" -ForegroundColor Red
    foreach ($f in $unapplied) {
        Write-Host "         - $($f.Name)" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "       Generating ciprian-schema-update.sql now would capture an incomplete" -ForegroundColor Red
    Write-Host "       schema and corrupt Ciprian's database." -ForegroundColor Red
    Write-Host ""
    Write-Host "       Fix: run  scripts\Apply-Migration.ps1  then re-run this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "OK -- all $($appliedSet.Count) migration(s) applied. Dev schema is complete." -ForegroundColor Green

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

# NOTE (Slice #23.10.dev): NEXT_PUBLIC_DEV_TOOLS is deliberately NOT read from
# .env above, unlike every other NEXT_PUBLIC_* value. Adrian's .env has dev
# tools ON -- that is the whole point of it locally -- so harvesting the key
# here would ship AI Discover, the Metadata tab, Help content, Settings and the
# locale flags straight to Ciprian by inheritance, silently, on the next build.
# The build below hardcodes false. If a UAT build ever needs the diagnostics,
# change the literal on that line and change it back afterwards; do not wire it
# to .env.
#
# Reminder on why this must happen HERE and cannot be fixed on Ciprian's side:
# NEXT_PUBLIC_* is substituted into the JS bundle when `npm run build` runs
# inside the image. Setting the variable in his compose file or with
# `docker run -e` does nothing whatsoever -- the value baked now is the value
# he gets.

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
    --build-arg "NEXT_PUBLIC_DEV_TOOLS=false" `
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
$outputTar    = "$outputDir\ga40prj-app.tar"
# Staged like the SQL files, and for the same reason: every Step 6 failure path
# used to leave a NEW image sitting beside the PREVIOUS build's schema and
# reference data, under the exact filename Adrian sends. A message saying
# "nothing was changed" would have been a lie, and the lie invites shipping the
# tar on its own. The cost is that both copies exist between here and Step 7 --
# ~1.6 GB rather than ~0.8 GB, briefly -- and the promotion itself is a rename
# within one folder, so it is instant regardless of size.
$outputTarNew = "$outputTar.new"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Write-Host ""
Write-Host "Exporting image to $outputTarNew ..." -ForegroundColor Cyan
Write-Host "(This can take 1-2 minutes -- the file will be ~600-800 MB uncompressed.)"
Write-Host ""

docker save ga40prj-app:latest -o $outputTarNew

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker save failed." -ForegroundColor Red
    Remove-StagedFiles
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

# ⚠️ **NOTHING IN CIPRIAN'S FOLDER IS OVERWRITTEN UNTIL STEP 6 HAS PASSED.**
# Every generated file is written to a sibling `.new` first and promoted at the
# end. The reason is specific rather than tidy-mindedness: until this slice
# Step 4 overwrote init\02-schema.sql immediately, so a failure ANYWHERE after
# it -- including the verification added in Step 6 -- left that folder holding
# a new schema beside stale reference data, with no good copy anywhere to fall
# back to. Ciprian's init folder is the thing a full reset (UC-C8) rebuilds
# from, so a half-written one is a first boot that succeeds into a wrong
# database rather than failing loudly. `.new` is also invisible to the Postgres
# entrypoint, which runs only *.sql / *.sh / *.sql.gz -- so even a `.new` left
# behind by a crash cannot execute.
$schemaDest    = "$ciprianRoot\docker\postgres\init\02-schema.sql"
$schemaDestNew = "$schemaDest.new"

Write-Host ""
Write-Host "Dumping current schema from ga40prj-postgres..." -ForegroundColor Cyan

docker exec ga40prj-postgres pg_dump --schema-only --no-owner --no-privileges -U postgres -d ga40db -f /tmp/ga40prj-schema-dump.sql

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: pg_dump failed inside ga40prj-postgres. Is the container running?" -ForegroundColor Red
    Write-Host "       Start it with: docker compose -f docker\postgres\docker-compose.yml --env-file .env up -d"
    Remove-StagedFiles
    exit 1
}

docker cp ga40prj-postgres:/tmp/ga40prj-schema-dump.sql $schemaDestNew

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: docker cp failed -- could not retrieve the schema dump." -ForegroundColor Red
    Remove-StagedFiles
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
$schemaText = [System.IO.File]::ReadAllText($schemaDestNew)
$schemaText = $schemaText -replace 'CREATE SCHEMA topology;', 'CREATE SCHEMA IF NOT EXISTS topology;'
[System.IO.File]::WriteAllText($schemaDestNew, $schemaText, $utf8NoBom)

Write-Host ""
Write-Host "Schema SQL regenerated (staged as 02-schema.sql.new)." -ForegroundColor Green

# ---- Step 5: assemble ciprian-schema-update.sql (the fixed-name update file) ----
# This is the single file Adrian sends to Ciprian for every schema update (UC-C6).
# It is always regenerated in full, never hand-edited, and always has the same
# name -- there is nothing for Adrian to "identify" before sending it.
#
# Contents, in order:
#   1. A full wipe of the public schema (DROP SCHEMA ... CASCADE / CREATE SCHEMA)
#   2. The Postgres extensions Ciprian's stack needs (from his own 01-extensions.sql)
#   3. The schema just dumped above (identical to what Step 7 will promote to
#      02-schema.sql -- it is 02-schema.sql.new until then)
#   4. A fresh data-only dump of every reference table -- every lookup_* table
#      plus the extras named at the dump below -- pulled live from
#      ga40prj-postgres, NOT from any file in this repo, so it is always
#      exactly what dev currently has, with no separate step to remember.
#      ⚠️ This is also the ONLY path by which a document type's FORM reaches
#      Ciprian. `template_fields` on lookup_document_type is the form, it is
#      written by DocTypeEngine and the Reference Data form editor, and it
#      exists in NO file in this repository -- migration_072 seeds the
#      catalogue with `template_fields` NULL and says so. Dev's database is
#      the only copy, which is why Step 6 counts them rather than trusting it.
#
# Ciprian's database is fully disposable at this stage (UC-C6), so wiping it on
# every update is intentional, not a bug.

Write-Host ""
Write-Host "Dumping current reference/lookup data from ga40prj-postgres..." -ForegroundColor Cyan

# The table list is `lookup_*` PLUS an explicit extras list, and the extras are
# not decoration: `time_frame_setting` is reference data by every test that
# matters -- ten rows seeded by migration_063, edited from Administration ->
# Settings, and read by the dashboard counters, the expiry badges and
# recency-badge.tsx -- but it does not carry the `lookup_` prefix, so the
# pattern alone silently left it out. Its rows never reached Ciprian: the
# migrations that seed it are not applied on his side (his DB is rebuilt from
# this file, not from the migration chain), so his UAT ran on the hard-coded
# fallbacks in src/lib/time-frames/config.ts while dev ran on Adrian's values.
# Nothing failed -- getTimeFrameSettings() falls back per key, which is exactly
# why nothing said so for sixty-three migrations.
#
# `help_content` / `help_hint` are here for the same reason, and the reason
# they were nearly left out is worth writing down because it is a plausible
# test that gives the wrong answer: their EDITOR (/admin/help-content) used to
# be `devOnly: true` in src/components/sidebar/nav-config.ts and out of
# Ciprian's build. The READER was not gated at all -- breadcrumb-bar.tsx mounts
# <ScreenHelpButton /> on every screen, it fetches GET /api/help/[screenKey],
# and that route calls getHelpContent/listHelpHints directly without ever
# importing src/lib/features/dev-tools.ts. With the tables empty the button
# renders nothing, silently, exactly the way the time-frame fallbacks did.
#
# ⚠️ **THE TEST IS "DOES CIPRIAN'S BUILD READ THIS TABLE AT RUNTIME", NOT "IS
# ITS ADMIN SCREEN IN HIS NAV".** /admin/settings was `devOnly` too, and that
# test would have excluded time_frame_setting as well.
#
# ⚠️ **SLICE #32.19 REMOVED BOTH OF THOSE GATES, AND THE DUMP LIST IS STILL
# RIGHT WHILE ITS OLD ARGUMENT IS SPENT.** /admin/help-content and
# /admin/settings are ordinary Admin-Setup screens now, so Ciprian can reach
# both EDITORS, not just the readers. Nothing above changes -- the runtime test
# still picks the same three tables -- but a NEW consequence lands here and is
# recorded rather than discovered: he can now edit help content and time-frame
# thresholds on the UAT box, and the next run of this script overwrites both
# from dev, silently, because these tables are dumped whole. If that starts
# mattering, the fix is a merge or a warning at Step 6, not a change to this
# list.
#
# ⚠️ An EXACT NAME here carries only that one relation. `lookup_*` also matches
# any sequence named `lookup_*`, so a serial-keyed lookup's setval travels with
# it; a serial-keyed table added to this list by name would leave its sequence
# behind and collide on Ciprian's first insert. Every reference PK today is a
# uuid or a text key, so nothing is owed a setval yet.
# ⚠️ ONE list, used three times below -- the pg_dump -t arguments, the SQL that
# asks dev what those tables hold, and the SQL that lists everything else. A
# second hand-written copy of this list in Step 6 would make that step agree
# with this one by construction and catch nothing, which is the exact shape of
# bug it exists to find.
$refTablePatterns = @("lookup_*", "time_frame_setting", "help_content", "help_hint")

$dumpTableArgs = @()
foreach ($pattern in $refTablePatterns) { $dumpTableArgs += "-t"; $dumpTableArgs += $pattern }

# --strict-names: a pattern that matches NOTHING is an error rather than a
# silently smaller dump. Without it a renamed table leaves this exiting 0 with
# its rows quietly absent from the package.
#
# --disable-triggers: pg_dump orders --data-only output by CREATION order, NOT
# by foreign-key dependency. Today the junctions happen to have been created
# after their parents (lookup_doc_type_person_role after lookup_document_type
# and lookup_person_role), so the file loads -- by luck, not by design. The day
# that stops being true it breaks on Ciprian's FIRST BOOT, which is the most
# expensive place in this whole pipeline for it to break. Both consumers of
# this dump run as the postgres superuser (the docker entrypoint, and UC-C6's
# `docker exec ... psql -U postgres`), so the ALTER TABLE ... DISABLE TRIGGER
# ALL it emits is permitted on both.
#
# ⚠️ What it gives up: RI is not re-validated when the triggers come back on,
# so a junction row pointing at a missing parent would load silently instead of
# aborting at the offending statement. That is acceptable HERE and only here,
# because dev enforces those same FK constraints continuously -- an orphan
# cannot exist in the source this dumps from. Drop an FK from a reference table
# in a future migration and that argument goes with it.
docker exec ga40prj-postgres pg_dump --data-only --no-owner --no-privileges --strict-names --disable-triggers @dumpTableArgs -U postgres -d ga40db -f /tmp/ga40prj-refdata-dump.sql

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: pg_dump (data-only) failed inside ga40prj-postgres." -ForegroundColor Red
    Remove-StagedFiles
    exit 1
}

docker cp ga40prj-postgres:/tmp/ga40prj-refdata-dump.sql $refDataDumpLocal

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: docker cp failed -- could not retrieve the reference-data dump." -ForegroundColor Red
    Remove-StagedFiles
    exit 1
}

$extensionsSrc = "$ciprianRoot\docker\postgres\init\01-extensions.sql"
if (-not (Test-Path $extensionsSrc)) {
    Write-Host "ERROR: $extensionsSrc not found -- cannot assemble ciprian-schema-update.sql." -ForegroundColor Red
    Remove-StagedFiles
    exit 1
}

$updateFileDest    = "$ciprianRoot\ciprian-schema-update.sql"
$updateFileDestNew = "$updateFileDest.new"

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
# ⚠️ $schemaDestNew, NOT $schemaDest. Under staging (Step 4) the final name
# still holds the PREVIOUS build's schema until Step 7 promotes; reading it
# here would assemble this build's update file around last build's schema --
# and every check in Step 6 would still pass, because Step 6 verifies the
# reference DATA rather than the schema around it.
$schemaText      = [System.IO.File]::ReadAllText($schemaDestNew)
$refDataText     = [System.IO.File]::ReadAllText($refDataDumpLocal)

$combined = $header `
    + "-- ---- 2. Extensions (from Ciprian's 01-extensions.sql) -------------------`r`n" `
    + $extensionsText + "`r`n" `
    + "-- ---- 3. Schema (freshly dumped from dev, same as 02-schema.sql) ---------`r`n" `
    + $schemaText + "`r`n" `
    + "-- ---- 4. Reference/lookup data (freshly dumped from dev) -----------------`r`n" `
    + $refDataText

[System.IO.File]::WriteAllText($updateFileDestNew, $combined, $utf8NoBom)

# ---- Step 5.5: regenerate Ciprian's init/03-reference-data.sql ---------------
#
# The init/ folder is mounted at /docker-entrypoint-initdb.d in Ciprian's
# compose file, so 01-extensions -> 02-schema -> 03-reference-data run in order
# the first time the Postgres volume is created: on his first-ever setup, and
# again every time UC-C8 (`compose down -v`) throws the volume away.
#
# 02-schema.sql has been regenerated on every build since this script existed.
# 03-reference-data.sql was NOT -- it was a hand-maintained copy of
# src/db/sync-reference-data.sql, and it had rotted into a file that cannot
# run at all: it opens by truncating `lookup_others`, which migration_052
# dropped, and its INSERTs into lookup_document_type name (name, sort_order)
# while `key` has been NOT NULL since migration_071's rekey. Postgres runs
# each init file with ON_ERROR_STOP=1, so it aborts on its second statement
# and takes the whole first boot with it.
#
# The fix is to stop hand-maintaining it: it is now the same live dump that
# section 4 of ciprian-schema-update.sql carries, so a fresh volume and an
# applied update file agree by construction rather than by anyone remembering.
$initRefDest    = "$ciprianRoot\docker\postgres\init\03-reference-data.sql"
$initRefDestNew = "$initRefDest.new"

$initRefHeader = @"
-- 03-reference-data.sql
-- AUTO-GENERATED by build-ciprian-image.ps1 -- do not hand-edit, it is
-- overwritten on every build. Byte-for-byte the same reference data as
-- section 4 of ciprian-schema-update.sql, dumped live from ga40prj-postgres.
--
-- Runs once, from /docker-entrypoint-initdb.d, when Ciprian's Postgres volume
-- is first created -- his first setup, and after every UC-C8 reset. It assumes
-- 02-schema.sql has just created the tables, and it does not truncate anything
-- because on that path there is nothing to truncate.

"@

[System.IO.File]::WriteAllText($initRefDestNew, ($initRefHeader + $refDataText), $utf8NoBom)

# ⚠️ $refDataDumpLocal is deliberately NOT removed here. It is the only
# artefact showing what pg_dump actually selected, and Step 6 is where that
# question gets asked -- deleting it first leaves a failed verification with
# nothing to look at but a re-run. It is removed after Step 6 passes, and it is
# in .gitignore for the aborts in between.

Write-Host ""
Write-Host "ciprian-schema-update.sql assembled (staged)." -ForegroundColor Green
Write-Host "init\03-reference-data.sql regenerated from the same dump (staged)." -ForegroundColor Green

# ---- Step 6: prove the package actually carries the reference data ----------
#
# WHY A STEP THAT ONLY COUNTS THINGS EARNS ITS PLACE
#   Everything above is a pipeline of dumps, and a dump that silently selects
#   less than it should is indistinguishable from one that selected everything:
#   pg_dump exits 0 either way and the assembled file is well-formed either
#   way. Two ways that has already happened here:
#     - a reference table whose name does not match the `-t` patterns
#       (time_frame_setting, until this slice), and
#     - a document type with no form, which is a perfectly legal row and a
#       broken import, because `template_fields` is the ONLY copy of that form
#       and it lives nowhere but dev's database.
#
#   ⚠️ **THE THIRD ARM (c2) IS THE ONE THAT EARNS THE STEP, AND IT IS THERE
#   BECAUSE THE FIRST TWO CANNOT FIND THE NEXT `time_frame_setting`.** Asking
#   dev for "the tables matching $refTablePatterns" and the file for "the
#   tables pg_dump selected with $refTablePatterns" compares a list against
#   itself: a reference table matching neither pattern is absent from BOTH
#   sides and every row prints green. So (c2) lists every remaining public
#   table that HAS ROWS in dev and does not travel. Ciprian's operational
#   tables are empty by design at this stage, so on a normal build that list is
#   short and boring -- and a new reference table appears in it the first time
#   anyone seeds one, which is the day it needs to be seen.
#
#   ⚠️ The form count is a COUNT, not the executor. `documentTypeHasForm` in
#   src/lib/documents/status.ts parses each field and requires at least one
#   USABLE one; this asks jsonb whether the array is non-empty. A template of
#   entirely malformed fields would pass here and render no inputs there. That
#   is the honest limit of a SQL check, and it is why this warns about the
#   formless rather than certifying the rest.

Write-Host ""
Write-Host "Verifying the reference data in the assembled package..." -ForegroundColor Cyan

# A failed verification discards all four STAGED files and leaves whatever was
# in Ciprian's folder before this run exactly as it was. That is the whole
# point of staging: the previous package is a known-good one, and a build that
# cannot vouch for its replacement has no business destroying it.
function Stop-UnverifiedPackage {
    param([string[]]$Lines)

    Write-Host ""
    foreach ($l in $Lines) { Write-Host $l -ForegroundColor Red }

    Remove-StagedFiles

    Write-Host ""
    Write-Host "Package NOT ready to send -- nothing in Ciprian's folder was changed." -ForegroundColor Red
    Write-Host "Fix the above and re-run this script." -ForegroundColor Red
    exit 1
}

# Build the SQL predicate from the SAME list the dump used.
$refConds = @()
foreach ($pattern in $refTablePatterns) {
    if ($pattern.Contains("*")) {
        # pg_dump patterns: `*` is the wildcard and `_` is literal. LIKE is the
        # other way round, so `_` has to be escaped as it crosses over.
        $likePattern = ($pattern -replace '_', '\_') -replace '\*', '%'
        $refConds += "t.table_name LIKE '$likePattern'"
    } else {
        $refConds += "t.table_name = '$pattern'"
    }
}
$refPredicate = "(" + ($refConds -join " OR ") + ")"

# query_to_xml is how a set-returning query counts rows in tables it only knows
# by name -- there is no other way to do it in one round trip without dynamic
# SQL in a DO block, which cannot return a result set.
# COALESCE is not decoration: one NULL anywhere in the || chain these feed
# makes the whole line NULL, psql prints it as blank, the loops skip it, and a
# table drops silently out of the comparison. count(*) cannot be NULL today --
# this makes that an enforced invariant rather than an asserted one.
$countExpr = "COALESCE((xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t.table_name), false, true, '')))[1]::text, '?')"
$tableFilter = "t.table_schema = 'public' AND t.table_type = 'BASE TABLE'"

# -- a) what dev holds in the reference tables ---------------------------------
$devCountsSql = "SELECT t.table_name || '|' || $countExpr FROM information_schema.tables t WHERE $tableFilter AND $refPredicate ORDER BY 1"
$devCountsRaw = docker exec ga40prj-postgres psql -U postgres -d ga40db -t -A -c $devCountsSql

if ($LASTEXITCODE -ne 0) {
    Stop-UnverifiedPackage @("ERROR: could not read reference-table counts from ga40prj-postgres.")
}

$devCounts = [ordered]@{}
foreach ($line in $devCountsRaw) {
    $trimmed = "$line".Trim()
    if ($trimmed -eq "") { continue }
    $parts = $trimmed -split '\|', 2
    # A BLANK line is skipped above -- psql and Docker both emit one from time
    # to time and it names no table, so it cannot hide one. A NON-BLANK line
    # this loop cannot read is the opposite: it is a table dropping
    # out of the comparison, and a table nobody compared is a green run over an
    # unchecked table -- which is the one outcome this whole step exists to
    # prevent. ([int]$null is 0, so a silent skip would not even be visible as
    # a crash; it would read as a table with no rows.)
    # Both halves tested, because [int] on a non-numeric string is a
    # TERMINATING error here ($ErrorActionPreference is Stop) -- it would leave
    # the script by the trap with a raw .NET message instead of by the line
    # below, which is the one that says what to do about it.
    if ($parts.Count -ne 2 -or $parts[1] -notmatch '^\d+$') {
        Stop-UnverifiedPackage @("ERROR: unreadable row from the reference-table count query: '$trimmed'")
    }
    $devCounts[$parts[0]] = [int]$parts[1]
}

if ($devCounts.Count -eq 0) {
    Stop-UnverifiedPackage @(
        "ERROR: the reference-table count query returned nothing at all.",
        "       Not one table matched $($refTablePatterns -join ', ') in ga40prj-postgres."
    )
}

# -- b) what the generated file contains ---------------------------------------
# Counted off $combined, the exact text just written to disk, so this cannot
# drift from the delivered file the way a re-read could.
$fileCounts = @{}
$fileColumns = @{}
$fileRows = @{}
$fileLines  = $combined -split "`r?`n"
$i = 0
while ($i -lt $fileLines.Count) {
    # `"?` around the name: pg_dump quotes any identifier that is not all
    # lower-case, and an unmatched header would read as MISSING in arm (c) --
    # a build refused over a package that is in fact complete.
    if ($fileLines[$i] -match '^COPY public\."?([A-Za-z0-9_]+)"? \((.*)\) FROM stdin;') {
        $t = $matches[1]
        $fileColumns[$t] = ($matches[2] -split ',\s*')
        $block = @()
        $i++
        while ($i -lt $fileLines.Count -and $fileLines[$i] -ne '\.') { $block += $fileLines[$i]; $i++ }
        $fileCounts[$t] = $block.Count
        $fileRows[$t]   = $block
    }
    $i++
}

# -- c) every reference table dev has must be in the file, with the same rows --
# -- c0) the schema half, which nothing else in this step looks at ------------
# Every arm below is about reference DATA. A truncated docker cp or a pg_dump
# that produced a stub would leave all of them green -- correct COPY blocks
# over a schema that cannot build a database -- and Step 7 would promote it.
# Two named tables rather than a byte count: a threshold is a number someone
# has to keep true, and these two are the reference table this whole step is
# about and the busiest operational one.
# ⚠️ Tested against $schemaText, NOT $combined, and the difference is the whole
# value of the arm: pg_dump ends every file with the same completion marker, so
# a $combined.Contains() for it is satisfied by section 4's reference dump
# alone -- green over a schema section that stopped halfway.
# ⚠️ A LINE MATCH, not EndsWith. pg_dump closes the file with a three-line
# comment block -- "--", the marker, "--" -- so the last non-blank line is
# "--" and an EndsWith on the marker text is false on a perfectly complete
# dump. That draft would have failed EVERY build, on the one check whose whole
# job is to be believed.
if ($schemaText -notmatch '(?m)^-- PostgreSQL database dump complete\s*$') {
    Stop-UnverifiedPackage @(
        "ERROR: the schema dump does not end with pg_dump's completion marker.",
        "       It is truncated -- the reference data below it would load into a",
        "       database missing its later tables, indexes and constraints."
    )
}
# A named table as well as the marker, because a zero-byte file has no marker
# but neither does a file that never contained this table. Anchored, so it
# cannot be satisfied by a mention inside a comment.
if (-not [regex]::IsMatch($schemaText, '(?m)^CREATE TABLE public\.lookup_document_type\b')) {
    Stop-UnverifiedPackage @(
        "ERROR: the schema dump does not create lookup_document_type -- the table",
        "       every document type and every form in this package lives in."
    )
}

$verifyFailed = $false
Write-Host ""
Write-Host ("  {0,-32} {1,5}   {2,7}" -f "Reference table", "dev", "package") -ForegroundColor Gray
foreach ($t in $devCounts.Keys) {
    $devN = $devCounts[$t]
    if ($fileCounts.ContainsKey($t)) {
        $pkgN  = $fileCounts[$t]
        $pkgTx = "$pkgN"
    } else {
        $pkgN  = -1
        $pkgTx = "MISSING"
    }
    $colour = "Green"
    if ($pkgN -ne $devN) { $colour = "Red"; $verifyFailed = $true }
    elseif ($devN -eq 0) { $colour = "Yellow" }
    Write-Host ("  {0,-32} {1,5}   {2,7}" -f $t, $devN, $pkgTx) -ForegroundColor $colour
}

if ($verifyFailed) {
    Stop-UnverifiedPackage @(
        "ERROR: the package does not match dev's reference data (see the red rows).",
        "       MISSING means the -t patterns at Step 5 do not name that table;",
        "       a count mismatch means something wrote to dev between the dump and",
        "       this check."
    )
}

# -- c2) what dev holds that the package does NOT carry ------------------------
# ⚠️ **THIS ARM ONLY WORKS IF ITS OUTPUT IS NORMALLY EMPTY.** A raw list of
# every populated non-reference table on Adrian's dev box is ~25 lines of
# documents, persons, properties and their version tables on EVERY build, plus
# spatial_ref_sys's 8500 PostGIS rows -- and a list that is never empty stops
# being read by the third build, which disarms the one arm of Step 6 that can
# find a reference table nobody classified. So everything known to be
# operational (or extension-owned) is named here, and what prints is the
# REMAINDER: a table that is neither reference data nor known operational data.
#
# A name appearing here is not automatically a bug -- it is a question. Either
# it is new operational data, and belongs in this list, or it is new reference
# data, and belongs in $refTablePatterns. Leaving it unanswered is the only
# wrong move.
$knownOperationalTables = @(
    "spatial_ref_sys", "schema_migrations",
    "address", "app_users", "user_requests",
    "person", "natural_person", "judicial_person", "person_version",
    "property", "property_address", "property_corner", "property_corner_source",
    "property_version",
    "document", "document_page", "document_version",
    "person_document", "person_person", "property_document", "property_person",
    "property_property", "document_document",
    "groups", "group_member", "stamps", "stamp_member",
    "principal_object",
    "calculation_run", "calculation_run_output",
    "entity_metadata", "entity_metadata_version", "entity_provenance_log",
    "entity_cross_reference", "entity_tag"
)
$knownOperationalSql = "'" + ($knownOperationalTables -join "', '") + "'"

$otherCountsSql = "SELECT t.table_name || '|' || $countExpr FROM information_schema.tables t WHERE $tableFilter AND NOT $refPredicate AND t.table_name NOT IN ($knownOperationalSql) ORDER BY 1"
$otherCountsRaw = docker exec ga40prj-postgres psql -U postgres -d ga40db -t -A -c $otherCountsSql

if ($LASTEXITCODE -ne 0) {
    Stop-UnverifiedPackage @("ERROR: could not list the non-reference tables in ga40prj-postgres.")
}

$carriesData = @()
foreach ($line in $otherCountsRaw) {
    $trimmed = "$line".Trim()
    if ($trimmed -eq "") { continue }
    $parts = $trimmed -split '\|', 2
    # Same strictness as arm (a), and it matters more here: this is the arm
    # that finds a reference table nobody classified, so a row it quietly
    # dropped is the one row it existed to print.
    if ($parts.Count -ne 2 -or $parts[1] -notmatch '^\d+$') {
        Stop-UnverifiedPackage @("ERROR: unreadable row from the non-reference table query: '$trimmed'")
    }
    if ([int]$parts[1] -gt 0) { $carriesData += ("{0} ({1} rows)" -f $parts[0], $parts[1]) }
}

if ($carriesData.Count -gt 0) {
    Write-Host ""
    Write-Host "  ⚠️  UNCLASSIFIED tables with rows in dev that the package does NOT carry:" -ForegroundColor Yellow
    foreach ($c in $carriesData) { Write-Host "    $c" -ForegroundColor Yellow }
    Write-Host "  Each is either new operational data (add it to `$knownOperationalTables)" -ForegroundColor Yellow
    Write-Host "  or new reference data (add it to `$refTablePatterns and re-run). Not fatal," -ForegroundColor Yellow
    Write-Host "  because this script cannot tell which -- but do not ship without deciding." -ForegroundColor Yellow
}

# -- d) document types and their forms -----------------------------------------
# ⚠️ Three literals for two permanent refusals -- the catch-all answers to
# either key depending on how the database was built (see
# document-type-match.ts). They match BY KEY, and that is not
# quite what the application does. `typeMayHoldAForm` in
# src/lib/import/discover-run.ts excuses a card by key OR by NAME
# (isIdCardTypeName) and resolves the catch-all from data rather than a
# literal, so a card type hand-added under some other key is excused there and
# listed here. This is an advisory list, not a gate, and over-listing is the
# safe direction -- but do not read it as the same rule.
$formExempt = @("CARTE_IDENTITATE", "NECLASIFICAT", "UNCLASSIFIED")

# replace(name, newline, space): `name` is free text an administrator typed in
# the Reference Data editor, and psql -t -A prints it raw -- so a name holding a
# newline would arrive as TWO output lines, and the second, having no pipe in
# it, would fail the four-part guard below and refuse a package that is fine.
# translate() rather than replace(): PowerShell reads native output through a
# TextReader, which breaks a line on a bare CR as readily as on an LF, so
# handling only chr(10) covers half the cases. COALESCE for the same
# class of reason: one NULL anywhere in the chain makes the whole || expression
# NULL, which prints as a blank line and drops a real row out of the count.
$typesSql = "SELECT COALESCE(key, '?') || '|' || (CASE WHEN template_fields IS NULL THEN '0' ELSE '1' END) || '|' || (CASE WHEN jsonb_typeof(template_fields) = 'array' THEN jsonb_array_length(template_fields) ELSE 0 END)::text || '|' || translate(COALESCE(name, '?'), chr(10) || chr(13), '  ') FROM lookup_document_type ORDER BY name"
$typesRaw = docker exec ga40prj-postgres psql -U postgres -d ga40db -t -A -c $typesSql

if ($LASTEXITCODE -ne 0) {
    Stop-UnverifiedPackage @("ERROR: could not read document types from ga40prj-postgres.")
}

$withForm     = @()
$withoutForm  = @()
$devTemplates = 0
foreach ($line in $typesRaw) {
    $trimmed = "$line".Trim()
    if ($trimmed -eq "") { continue }
    # Limit 4, not a split on every pipe: a type NAME is free text an
    # administrator typed, and one containing a pipe would otherwise arrive
    # truncated in the report that exists to be trusted.
    $parts   = $trimmed -split '\|', 4
    # Same strictness as arms (a) and (c2): a row this cannot read is a
    # document type reported wrongly in the one report that exists to be
    # trusted, and $devTemplates miscounted underneath it.
    if ($parts.Count -ne 4 -or $parts[2] -notmatch '^\d+$') {
        Stop-UnverifiedPackage @("ERROR: unreadable row from the document-type query: '$trimmed'")
    }
    $key     = $parts[0]
    $hasJson = $parts[1]
    $fields  = [int]$parts[2]
    $name    = $parts[3]
    if ($hasJson -eq "1") { $devTemplates++ }
    if ($fields -gt 0)                     { $withForm    += "$name ($fields fields)" }
    elseif ($formExempt -notcontains $key) { $withoutForm += "$name [$key]" }
}

# The forms have to be checked in the FILE, not only in dev: the whole reason
# this step exists is that `template_fields` has no copy anywhere else, and a
# row count alone would stay green if the column itself stopped travelling.
# ⚠️ ONE lookup, and the guard is on ITS result. An earlier draft guarded with
# `-notcontains` and then indexed with [array]::IndexOf, which is the same
# question asked two ways: -notcontains is case-INSENSITIVE, IndexOf on a
# string[] is ordinal. A column arriving as anything but exactly lowercase
# would pass the guard, return -1 here, and then `$cells[-1]` reads the LAST
# cell of every row -- right today only because template_fields happens to be
# last in this COPY block, and silently wrong the day a column is added.
$dtCols = $fileColumns["lookup_document_type"]
$tfIndex = if ($null -eq $dtCols) { -1 } else { [array]::IndexOf([string[]]$dtCols, "template_fields") }
if ($tfIndex -lt 0) {
    Stop-UnverifiedPackage @(
        "ERROR: the lookup_document_type COPY block in the package does not carry",
        "       a template_fields column -- every document-type FORM would be lost."
    )
}
$pkgTemplates = 0
foreach ($row in $fileRows["lookup_document_type"]) {
    $cells = $row -split "`t"
    if ($cells.Count -gt $tfIndex -and $cells[$tfIndex] -ne '\N') { $pkgTemplates++ }
}

if ($pkgTemplates -ne $devTemplates) {
    Stop-UnverifiedPackage @(
        "ERROR: dev has $devTemplates document type(s) carrying template_fields, the",
        "       package carries $pkgTemplates. The forms did not survive the dump."
    )
}

if ($withForm.Count -eq 0) {
    Stop-UnverifiedPackage @(
        "ERROR: not one document type in dev has a form (template_fields).",
        "       Ciprian would get the whole catalogue and no way to enter anything",
        "       type-specific into any of it. Build the forms in DocTypeEngine first."
    )
}

Write-Host ""
# "carried by the package" is the NOT-NULL equality checked just above, which
# is a superset of $withForm (an empty [] array is not null). Say the thing the
# check actually proved.
Write-Host "  Document types with a form ($($withForm.Count) of $($devCounts['lookup_document_type'])); all $devTemplates templates carried by the package:" -ForegroundColor Green
foreach ($f in $withForm) { Write-Host "    $f" -ForegroundColor Green }

if ($withoutForm.Count -gt 0) {
    Write-Host ""
    Write-Host "  Document types with NO form ($($withoutForm.Count)) -- not fatal, but an" -ForegroundColor Yellow
    Write-Host "  import that meets one of these stops at the Slice #29.08 gate:" -ForegroundColor Yellow
    foreach ($f in $withoutForm) { Write-Host "    $f" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "Reference data verified against dev." -ForegroundColor Green

# ---- Step 7: promote the staged files, and package the init folder ----------
#
# Only now does anything in Ciprian's folder change. Move-Item -Force is a
# rename within one folder, so each promotion is atomic as far as anyone
# reading that folder is concerned -- there is no window where a file is half
# written.
Write-Host ""
Write-Host "Promoting the verified files..." -ForegroundColor Cyan

# ⚠️ **ORDER AND THE try/catch ARE BOTH LOAD-BEARING.** `Move-Item -Force`
# over an existing destination is not one atomic replace -- the provider
# removes the destination first -- so a failure here can leave a final name
# ABSENT, not merely stale. And under $ErrorActionPreference = "Stop" an
# unhandled failure would throw out of the script mid-loop, printing nothing
# after "Promoting...", leaving the folder in exactly the mixed state the
# staging was built to prevent, silently.
#
# The two init files go LAST and adjacent to each other, because they are the
# pair whose mismatch does the damage: a new 02-schema.sql beside a stale
# 03-reference-data.sql is a first boot that succeeds into a wrong database.
# The image and the update file are each self-contained.
$promotions = @(
    @{ New = $outputTarNew;      Final = $outputTar;      Label = "docker\app\ga40prj-app.tar" },
    @{ New = $updateFileDestNew; Final = $updateFileDest; Label = "ciprian-schema-update.sql" },
    @{ New = $schemaDestNew;     Final = $schemaDest;     Label = "init\02-schema.sql" },
    @{ New = $initRefDestNew;    Final = $initRefDest;    Label = "init\03-reference-data.sql" }
)

$promoted = @()
foreach ($pair in $promotions) {
    try {
        Move-Item -LiteralPath $pair.New -Destination $pair.Final -Force
        $promoted += $pair.Label
    } catch {
        Write-Host ""
        Write-Host "=====================================================" -ForegroundColor Red
        Write-Host " PARTIALLY PROMOTED -- DO NOT SEND THIS PACKAGE" -ForegroundColor Red
        Write-Host "=====================================================" -ForegroundColor Red
        Write-Host " Failed on: $($pair.Label)" -ForegroundColor Red
        Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host " Already replaced with this build's version:" -ForegroundColor Yellow
        if ($promoted.Count -eq 0) { Write-Host "   (none)" -ForegroundColor Yellow }
        foreach ($d in $promoted) { Write-Host "   $d" -ForegroundColor Yellow }
        Write-Host ""
        # ⚠️ The failing file gets its OWN line and is NOT reported as holding
        # the previous version. Move-Item -Force deletes the destination before
        # renaming, so a failure can leave that name MISSING rather than stale
        # -- and "still holding the previous build" would be a flat lie in the
        # case that hurts most, an init folder with no 02-schema.sql in it.
        Write-Host " UNKNOWN STATE -- may be the previous version, may be MISSING:" -ForegroundColor Red
        Write-Host "   $($pair.Label)   (this build's copy is still at $($pair.New))" -ForegroundColor Red
        Write-Host ""
        Write-Host " Still holding the PREVIOUS build's version:" -ForegroundColor Yellow
        $untouched = @($promotions.Label | Where-Object { $promoted -notcontains $_ -and $_ -ne $pair.Label })
        if ($untouched.Count -eq 0) { Write-Host "   (none)" -ForegroundColor Yellow }
        foreach ($d in $untouched) { Write-Host "   $d" -ForegroundColor Yellow }
        Write-Host ""
        Write-Host " Ciprian's folder now holds a mix of two builds. Re-run this" -ForegroundColor Red
        Write-Host " script once whatever holds that file has let go of it." -ForegroundColor Red
        Write-Host ""
        exit 1
    }
}

# -ErrorAction SilentlyContinue, deliberately: this is a gitignored scratch file
# in the repo root, and under $ErrorActionPreference = "Stop" a lock on it (an
# editor, an AV scan) would throw here -- after all four files are promoted and
# before the init zip is rebuilt, which is the exact mixed state everything
# above works to avoid, delivered with no message at all.
Remove-Item -LiteralPath $refDataDumpLocal -Force -ErrorAction SilentlyContinue

# ⚠️ **THE INIT FOLDER HAS TO BE SENT, AND FOR YEARS IT WAS NOT.** 02-schema.sql
# has been regenerated by Step 4 on every build since this script existed, and
# 03-reference-data.sql is regenerated by Step 5.5 now -- but both are written
# to ADRIAN'S staging copy of ga40prj.Ciprian, and the handover has always named
# exactly two files: the .tar and ciprian-schema-update.sql. So Ciprian's own
# init folder is still whatever he was given at first-time setup. It is the
# folder a full reset (UC-C8, `compose down -v`) rebuilds his database from, so
# what that reset actually restores on his machine is the schema and the
# reference data of the day he set the box up -- and, in his current copy, a
# 03-reference-data.sql that aborts the boot outright because it truncates a
# table migration_052 dropped.
#
# One zip, regenerated every build, sent with the other two. He only needs to
# unpack it before a reset or a first-time setup -- but he cannot unpack one he
# was never sent.
#
# ⚠️ An explicit file list, NOT `$initDir\*.sql`. That folder is unpacked
# straight over a directory the Postgres entrypoint auto-executes, in name
# order, so a glob ships whatever happens to be lying there -- a `00-fix.sql`
# left from a debugging session would run on Ciprian's first boot BEFORE the
# extensions. A named list also fails loudly when a file it expects is gone,
# where a glob would quietly build a smaller zip.
$initDir = "$ciprianRoot\docker\postgres\init"
$initZip = "$ciprianRoot\ciprian-init.zip"
#
# The zip carries its own instructions. Ciprian's README-UAT.txt names two
# files and knows nothing about this one, and he is a business user who is
# told to double-click .bat files -- handing him a zip with no note is handing
# him nothing. It is regenerated every build so it cannot go stale, and it
# lands in the init folder, where the Postgres entrypoint ignores it (it runs
# only *.sql / *.sh / *.sql.gz) and where it documents the folder it is in.
$initReadme = "$initDir\README-INIT.txt"
$initReadmeText = @"
GA40 -- what this folder is, and what to do with ciprian-init.zip
=================================================================

These .sql files are read ONCE by Postgres, when the database volume is
created for the first time. That happens exactly twice in the life of this
box:

  * the very first time you run start.bat, and
  * after a full reset -- stop.bat, then this ONE line, run from
    C:\dev\ga40prj.Ciprian\ (Command Prompt or PowerShell, either is fine):

      docker compose -f docker\postgres\docker-compose.yml --env-file .env -p ga40prj-ciprian down -v

    then start.bat  (UC-C8 in the Operations Guide). The -p matters: without
    it Docker names the project after the compose file's own folder
    ("postgres"), finds nothing under that name, reports success, and your
    data is still there.

At any other time they are inert. That is why it is easy to forget them, and
why forgetting them is expensive: a reset rebuilds your database from THESE
files, so if they are old, your fresh database is old -- old structure, old
document types, and none of the forms Adrian has built since.

SO: every time Adrian sends you a new ga40prj-app.tar and
ciprian-schema-update.sql, he also sends ciprian-init.zip. Unpack it over
this folder, replacing the files in it. It takes ten seconds and you do not
have to do anything else with it. It only matters on the day you reset -- and
that is the day it is too late to ask for it.

Nothing in here affects the app you are testing right now. Applying
ciprian-schema-update.sql (per UC-C6) is what updates the running database;
these files are the safety net underneath it.

Generated by build-ciprian-image.ps1 -- do not hand-edit.
"@
$initFiles = @(
    "$initDir\01-extensions.sql",
    "$initDir\02-schema.sql",
    "$initDir\03-reference-data.sql",
    $initReadme
)
# ⚠️ The README write is INSIDE this try. Everything from the promotion loop
# to the zip is the one stretch where a raw throw leaves four new files beside
# a zip from the last build -- the exact mixed delivery the staging exists to
# prevent, handed over with no message. An unguarded WriteAllText here would
# have been that throw.
try {
    [System.IO.File]::WriteAllText($initReadme, $initReadmeText, $utf8NoBom)
    Compress-Archive -LiteralPath $initFiles -DestinationPath $initZip -Force
} catch {
    Write-Host ""
    Write-Host "ERROR: could not write $initZip -- is it open in Explorer or a zip tool?" -ForegroundColor Red
    Write-Host "       The other four files ARE promoted and consistent, but the init zip" -ForegroundColor Red
    Write-Host "       beside them is missing or from a PREVIOUS build. Do not send that one." -ForegroundColor Red
    Write-Host "       $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Done." -ForegroundColor Green

# ---- Done --------------------------------------------------------------------

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Image ready : $outputTar" -ForegroundColor Green
Write-Host " Update file : $updateFileDest" -ForegroundColor Green
Write-Host " Init files  : $initZip" -ForegroundColor Green
Write-Host " Next step   : send ALL THREE files to Ciprian" -ForegroundColor Green
Write-Host "               1. ga40prj-app.tar      -> docker\app\ (replace)" -ForegroundColor Green
Write-Host "               2. ciprian-schema-update.sql -> folder root (replace)" -ForegroundColor Green
Write-Host "               3. ciprian-init.zip     -> unpack over" -ForegroundColor Green
Write-Host "                  docker\postgres\init\ (3 .sql + README-INIT.txt)" -ForegroundColor Green
Write-Host " Ciprian     : start.bat (first run) OR update.bat + apply" -ForegroundColor Green
Write-Host "               ciprian-schema-update.sql per UC-C6." -ForegroundColor Green
Write-Host "               The init files matter only on a first-time setup or" -ForegroundColor Green
Write-Host "               a full reset (UC-C8) -- but they have to be THERE" -ForegroundColor Green
Write-Host "               before the day he needs them." -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
