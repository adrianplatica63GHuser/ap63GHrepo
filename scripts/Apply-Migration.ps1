<#
.SYNOPSIS
    Apply pending database migrations to the local Docker Postgres container.

.DESCRIPTION
    Compares migration_*.sql files in src\db against the schema_migrations
    table in the running container and applies any that have not been recorded.
    Stops on the first failure so a broken migration does not get skipped.

    If schema_migrations does not exist yet, the script bootstraps itself by
    applying migration_056_schema_migrations.sql first.

.PARAMETER Container
    Docker container name. Default: ga40prj-postgres

.PARAMETER Database
    Postgres database name. Default: ga40db

.PARAMETER DbUser
    Postgres user. Default: postgres

.EXAMPLE
    .\scripts\Apply-Migration.ps1

.EXAMPLE
    .\scripts\Apply-Migration.ps1 -Container my-postgres -Database mydb
#>
param(
    [string]$Container = "ga40prj-postgres",
    [string]$Database  = "ga40db",
    [string]$DbUser    = "postgres"
)

Set-StrictMode -Version Latest

$repoRoot      = Split-Path -Parent $PSScriptRoot
$migrationsDir = Join-Path $repoRoot "src\db"

Write-Host "==== GA40 Migration Runner ===="
Write-Host "Container : $Container"
Write-Host "Database  : $Database"
Write-Host "Folder    : $migrationsDir"
Write-Host "================================"
Write-Host ""

# ---------------------------------------------------------------------------
# Helper: run a SQL string and return trimmed, non-empty stdout lines.
# ---------------------------------------------------------------------------
function Invoke-Psql {
    param([string]$Sql)
    $lines = docker exec $Container psql -U $DbUser -d $Database -t -c $Sql 2>&1
    return ($lines | ForEach-Object { "$_".Trim() } | Where-Object { $_ -ne "" })
}

# ---------------------------------------------------------------------------
# Step 1 -- verify container is reachable
# ---------------------------------------------------------------------------
Write-Host "Checking container..."
docker exec $Container psql -U $DbUser -d $Database -c "SELECT 1;" > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Cannot reach $Container. Is the container running? (docker ps)"
    exit 1
}
Write-Host "Container OK."
Write-Host ""

# ---------------------------------------------------------------------------
# Step 2 -- bootstrap schema_migrations if it does not exist yet
# ---------------------------------------------------------------------------
$tableCheck = (Invoke-Psql "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schema_migrations');") -join ""

if ($tableCheck -eq "f") {
    Write-Host "schema_migrations not found -- bootstrapping..."
    $bootstrap = Join-Path $migrationsDir "migration_056_schema_migrations.sql"
    if (-not (Test-Path $bootstrap)) {
        Write-Error "Bootstrap file not found: $bootstrap"
        exit 1
    }
    $tmpBoot = "/tmp/migration_056_schema_migrations.sql"
    docker cp $bootstrap "${Container}:${tmpBoot}"
    docker exec $Container psql -U $DbUser -d $Database -f $tmpBoot
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Bootstrap failed. Aborting."
        exit 1
    }
    Write-Host "Bootstrap complete."
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Step 3 -- load the set of already-applied migrations
# ---------------------------------------------------------------------------
$appliedRows = Invoke-Psql "SELECT filename FROM schema_migrations ORDER BY filename;"
$applied = @{}
foreach ($row in $appliedRows) {
    if ($row -ne "") {
        $applied[$row] = $true
    }
}
Write-Host "Already applied : $($applied.Count) migration(s)"

# ---------------------------------------------------------------------------
# Step 4 -- find pending migrations
# ---------------------------------------------------------------------------
$allFiles = Get-ChildItem -Path $migrationsDir -Filter "migration_*.sql" | Sort-Object Name
$pending  = @($allFiles | Where-Object { -not $applied.ContainsKey($_.Name) })
Write-Host "Pending         : $($pending.Count) migration(s)"
Write-Host ""

if ($pending.Count -eq 0) {
    Write-Host "Database is up to date. Nothing to do."
    exit 0
}

# ---------------------------------------------------------------------------
# Step 5 -- apply each pending migration in sorted order
# ---------------------------------------------------------------------------
$ok   = 0
$fail = 0

foreach ($file in $pending) {
    Write-Host "Applying $($file.Name) ..."

    $tmpPath  = "/tmp/$($file.Name)"
    $checksum = (Get-FileHash -Algorithm MD5 -Path $file.FullName).Hash

    docker cp $file.FullName "${Container}:${tmpPath}"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAILED (docker cp). Stopping."
        $fail++
        break
    }

    docker exec $Container psql -U $DbUser -d $Database -f $tmpPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAILED (psql). Fix the error and re-run. Stopping."
        $fail++
        break
    }

    # Record the successful apply
    $safeName = $file.Name.Replace("'", "''")
    docker exec $Container psql -U $DbUser -d $Database -c "INSERT INTO schema_migrations (filename, checksum) VALUES ('$safeName', '$checksum') ON CONFLICT (filename) DO NOTHING;" > $null 2>&1

    Write-Host "  OK  (MD5: $checksum)"
    $ok++
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "================================"
Write-Host "Applied  : $ok"
Write-Host "Failed   : $fail"
Write-Host "Baseline : $($applied.Count) (were already recorded)"
Write-Host "================================"

if ($fail -gt 0) {
    exit 1
}
