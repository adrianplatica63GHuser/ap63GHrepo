#Requires -Version 7.4
<#
.SYNOPSIS
    Run the cloud rebuild path end to end against a throwaway Postgres.

.DESCRIPTION
    Starts a disposable postgis/postgis:16-3.4 container, hands it to
    scripts/verify-rebuild.ts, and removes it again. Nothing here touches
    ga40prj-postgres, and nothing here can reach Supabase: the container listens
    on 127.0.0.1 only, on a port of its own, and the check itself refuses any
    host that is not loopback and any server whose `postgres` database is not
    empty.

    This is the local half of Slice #31.01. The other half is
    .github/workflows/db-rebuild.yml, which runs the same verify-rebuild.ts
    against a service container on every push. Both call the same script, so
    there is no second copy of the logic to disagree with the first.

    Takes two to three minutes: the migration chain is applied to four databases,
    and a cold first boot of the image adds to that.

.PARAMETER Port
    Host port for the throwaway container. Default 5433, so it cannot collide
    with the dev container on 5432.

.PARAMETER Keep
    Leave the container and its scratch databases behind, for poking at with
    psql. Remove it with:  docker rm -f ga40prj-rebuild-check

.NOTES
    EXIT CODES, passed straight through from verify-rebuild.ts:
      0  PASS
      1  FAIL
      2  PARTIAL (PostGIS was faked -- cannot happen from this script, which
         always starts a real postgis image)
      3  the baseline was rewritten, not a verification run

    7.4, not 7.0. $PSNativeCommandUseErrorActionPreference does not exist before
    7.3, so on 7.0-7.2 every toggle below is a no-op -- and on those versions
    `$ErrorActionPreference='Stop'` promotes native stderr merged with 2>&1 into
    a terminating error, which is a second way for a docker call to kill this
    script. Rather than support both mechanisms, the file requires the version
    where one of them exists and does not merge stderr anywhere.

    $PSNativeCommandUseErrorActionPreference is deliberately turned OFF around
    every docker call and around node. `pg_isready` exits 2 while the server is still starting, which is
    the readiness loop's NORMAL state, and `node` exits 1 when the check finds
    something, which is a result. With the preference on, both are terminating
    errors -- the first aborted this script on every run under PowerShell 7.4+,
    before it had ever called the check. (Found by the Slice #31.01 adversarial
    review, along with the fact that `$args` is an automatic variable that every
    script block redefines, so an earlier version invoked node with no arguments
    at all and reported success.)

.EXAMPLE
    .\scripts\Verify-Rebuild.ps1

.EXAMPLE
    .\scripts\Verify-Rebuild.ps1 -Keep
#>
param(
    [int]$Port = 5433,
    [switch]$Keep
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true   # no-op before PS 7.4

$container = 'ga40prj-rebuild-check'
$image     = 'postgis/postgis:16-3.4'
$password  = 'rebuild-check'
$repoRoot  = Split-Path -Parent $PSScriptRoot

Write-Host "==== GA40 rebuild verification ===="
Write-Host "Container : $container  (throwaway)"
Write-Host "Image     : $image"
Write-Host "Port      : 127.0.0.1:$Port"
Write-Host "==================================="
Write-Host ""

# A leftover from an interrupted run would otherwise fail the port bind with a
# message about the port rather than about the container. `docker rm -f` on a
# container that does not exist exits 0 -- but `docker` itself exits non-zero
# when the daemon is not running, and with the native-error preference on that
# is a terminating error at this line rather than a useful message.
$PSNativeCommandUseErrorActionPreference = $false
docker rm -f $container 2> $null > $null
$PSNativeCommandUseErrorActionPreference = $true

Push-Location $repoRoot   # verify-rebuild.ts finds the repo from the WORKING
                          # DIRECTORY, not from its own path, so running this
                          # script from anywhere else would start the container
                          # and then fail to find the repo.
try {
    Write-Host "Starting the throwaway server..."
    # Bound to 127.0.0.1 explicitly. A bare -p 5433:5432 listens on every
    # interface, which is not what a database this script is about to destroy
    # should be doing.
    docker run -d --name $container `
        -e POSTGRES_PASSWORD=$password `
        -p "127.0.0.1:${Port}:5432" `
        $image > $null

    # 180 probes, not 60: a cold first boot of postgis/postgis on Docker Desktop
    # runs initdb and then loads postgis, topology, fuzzystrmatch and
    # tiger_geocoder, which on WSL2 routinely takes longer than a minute.
    Write-Host "Waiting for it to accept connections (180 probes, several minutes at worst)..."
    $ready = $false
    $LASTEXITCODE = 0   # so the read below is defined under Set-StrictMode even
                        # if the pre-clean above is ever removed
    foreach ($i in 1..180) {
        Start-Sleep -Seconds 1
        if ($i % 15 -eq 0) { Write-Host "  ...still waiting ($i s)" }
        # -h 127.0.0.1 makes this a TCP check, which is what the check itself
        # uses. Without it pg_isready goes over the container's Unix socket and
        # answers yes during the entrypoint's socket-only initdb phase -- while
        # the postgis image is still loading its extensions and nothing is
        # listening on TCP -- so the loop broke early and the check then failed
        # with "cannot reach a Postgres server".
        $PSNativeCommandUseErrorActionPreference = $false
        docker exec $container pg_isready -h 127.0.0.1 -U postgres -q 2> $null > $null
        $PSNativeCommandUseErrorActionPreference = $true
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
    }
    if (-not $ready) {
        Write-Host ""
        Write-Host "The container never became ready. Its log:"
        # Preference off: a non-zero exit here would pre-empt the throw below,
        # replacing the explanation with a NativeCommandExitException.
        $PSNativeCommandUseErrorActionPreference = $false
        docker logs --tail 40 $container
        $PSNativeCommandUseErrorActionPreference = $true
        throw "$container did not accept connections within 180s."
    }
    Write-Host "  OK."
    Write-Host ""

    # NOT $args. It is an automatic variable that every function and script
    # block redefines, so a value assigned to it here is invisible one scope in.
    $nodeArgs = @(
        (Join-Path $repoRoot 'node_modules\tsx\dist\cli.mjs'),
        (Join-Path $repoRoot 'scripts\verify-rebuild.ts'),
        '--host', '127.0.0.1',
        '--port', "$Port",
        '--user', 'postgres',
        '--password', $password
    )
    if ($Keep) { $nodeArgs += '--keep' }

    # Toggled in place rather than inside a `& { }` block: a script block is a
    # child scope, and getting a value back out of one is exactly the kind of
    # subtlety that made the previous version of this file never run the check.
    $PSNativeCommandUseErrorActionPreference = $false
    node @nodeArgs
    $checkExit = $LASTEXITCODE
    $PSNativeCommandUseErrorActionPreference = $true
    exit $checkExit
}
finally {
    Pop-Location
    if ($Keep) {
        Write-Host ""
        Write-Host "-Keep: $container is still running on 127.0.0.1:$Port."
        Write-Host "Remove it with:  docker rm -f $container"
        Write-Host "NOTE: the next run of this script removes it first, so look now."
    } else {
        # Preference off: a throw in the finally block would replace the check's
        # own exit code (0/1/2/3) with a PowerShell error, and the exit code is
        # the whole point of running this from anything other than a keyboard.
        $PSNativeCommandUseErrorActionPreference = $false
        docker rm -f $container 2> $null > $null
        $PSNativeCommandUseErrorActionPreference = $true
    }
}
