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

.PARAMETER UpdateBaseline
    Rewrite src/db/rebuild-known-differences.txt from what this run actually
    finds, instead of checking against it. NOT a verification: the check exits 3
    and never reports a pass, so a re-baseline is always deliberate and always
    leaves a diff to read before it is committed.

    This switch exists because the flag it forwards could not be reached from
    here. The generated baseline's own header used to say
    `npm run db:verify-rebuild -- --update-baseline`, which needs a server
    already running AND psql on PATH -- and there is none on a Windows box with
    only Docker Desktop, so it dies with `spawnSync psql ENOENT` before step 2.
    Adrian hit exactly that during Slice #29.07. The header now points here.

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

.EXAMPLE
    .\scripts\Verify-Rebuild.ps1 -UpdateBaseline
#>
param(
    [int]$Port = 5433,
    [switch]$Keep,
    [switch]$UpdateBaseline
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

    # PROBE WITH THE CLIENT THE CHECK USES, AND REQUIRE A ROW BACK.
    # This polled `pg_isready` and broke out of the loop while the image was
    # still running initdb, so the check ran against a server that was not
    # there and reported "cannot reach a Postgres server" -- measured on
    # Adrian's machine, with the container's own log ending at "performing
    # post-bootstrap initialization". Whatever made that probe answer yes,
    # `SELECT 1` returning the string 1 cannot: it is the same binary, the same
    # transport and the same credentials the next step uses, and it is tested on
    # its output rather than only on an exit code.
    #
    # 180 probes: a cold first boot of postgis/postgis on Docker Desktop runs
    # initdb and then loads postgis, topology, fuzzystrmatch and tiger_geocoder,
    # which on WSL2 routinely takes longer than a minute. verify-rebuild.ts
    # retries the first connection for 120s of its own besides.
    Write-Host "Waiting for it to accept connections (up to 180 probes)..."
    $ready = $false
    foreach ($i in 1..180) {
        Start-Sleep -Seconds 1
        if ($i % 15 -eq 0) { Write-Host "  ...still waiting ($i s)" }
        $PSNativeCommandUseErrorActionPreference = $false
        $probe = docker exec -e PGPASSWORD=$password $container psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc 'SELECT 1' 2> $null
        $probeCode = $LASTEXITCODE
        $PSNativeCommandUseErrorActionPreference = $true
        if ($probeCode -eq 0 -and "$probe".Trim() -eq '1') {
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
    # --container, not bare --host/--port: there is no psql or pg_dump on a
    # Windows machine that has only Docker Desktop, and the first version of
    # this script died on Adrian's box with `spawnSync psql ENOENT` before it
    # reached step 2. The check runs both binaries inside the container instead,
    # which is what every other script in this repo does -- and which also makes
    # a client/server version mismatch impossible.
    $nodeArgs = @(
        (Join-Path $repoRoot 'node_modules\tsx\dist\cli.mjs'),
        (Join-Path $repoRoot 'scripts\verify-rebuild.ts'),
        '--container', $container,
        '--host', '127.0.0.1',
        '--port', "$Port",
        '--user', 'postgres',
        '--password', $password
    )
    if ($Keep)           { $nodeArgs += '--keep' }
    if ($UpdateBaseline) { $nodeArgs += '--update-baseline' }

    if ($UpdateBaseline) {
        Write-Host "-UpdateBaseline: rewriting src\db\rebuild-known-differences.txt."
        Write-Host "This is NOT a verification run - it exits 3 and reports no pass."
        Write-Host "Read the diff before committing the file."
        Write-Host ""
    }

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
