<#
.SYNOPSIS
    The one comparison of src\db\migration_*.sql against schema_migrations.

.DESCRIPTION
    Dot-sourced, not run. Two scripts ask the same question -- "does this
    database hold the migrations this repository has, and are they the same
    files?" -- and until Slice #34.31 they answered it differently:

      scripts\Apply-Migration.ps1   hashed every file and compared every
                                    recorded checksum (Slice #34.18).
      build-ciprian-image.ps1       compared FILENAMES only, and so passed a
                                    dev database holding a migration that had
                                    been corrected since it was applied -- then
                                    dumped that schema into Ciprian's image.

    #34.18 found the second one and named it rather than fixing it. This file
    is the fix, and the reason it is a file rather than a second correction is
    that a THIRD caller is already foreseeable (Verify-Rebuild, a CI check):
    the point is that the next one costs a dot-source, not a third transcription
    of the same bucketing.

    ⚠️ **NOTHING HERE PRINTS, AND NOTHING HERE EXITS.** The two callers have
    genuinely different jobs at the end of it -- the runner prints a repair
    block and exits 2, the image build discards staged files and exits 1 -- and
    a shared function that decided that for them would have to grow a switch
    for each. They return data; the caller decides. That also makes every
    function here testable without a database.

    ⚠️ **AND NOTHING HERE ASSUMES STRICT MODE EITHER WAY.**
    Apply-Migration.ps1 sets `Set-StrictMode -Version Latest`;
    build-ciprian-image.ps1 does not, but inherits whatever a $PROFILE set. So
    every variable is assigned before it is read, every collection is wrapped
    in @() before .Count, and no property is read off a value that might be
    $null.

.NOTES
    Requires PowerShell 7 (pwsh). Both callers already do.
#>

# ---------------------------------------------------------------------------
# Get-MigrationFilesOnDisk -- enumerate src\db ONCE, and hash every file.
#
# ⚠️ The folder is checked before it is walked, and it is walked ONCE.
# A missing or unreadable src\db makes Get-ChildItem write a non-terminating
# error and return nothing, which used to end a run at "Database is up to
# date. Nothing to do.", exit 0 -- with every recorded row in the NO FILE
# bucket, under a heading telling the reader it is not evidence of anything.
# Enumerating once also removes a race: the pending list used to come from a
# second walk, so a file appearing between the two was applied with an EMPTY
# checksum and became permanently unverifiable. (Slice #34.18 review round 3.)
#
# ⚠️ Test-Path -PathType Container returns True for a directory that cannot be
# ENUMERATED, and Get-ChildItem then returns nothing with no error at all -- so
# a guard on Test-Path alone passes, every recorded row lands in NO FILE, and
# the run ends cheerfully. A sparse or half-copied checkout reaches the same
# place. Hence the second test on the count.
#
# Returns a [pscustomobject]:
#   Error      : $null, or a sentence naming what is wrong. Non-null means
#                every other field is empty and the caller must stop.
#   Files      : @() of FileInfo, sorted by Name.
#   OnDisk     : @{ filename -> full path }
#   HashOnDisk : @{ filename -> MD5 (upper-case hex) }
#   ByHash     : @{ MD5 -> @(filenames carrying it) }
# ---------------------------------------------------------------------------
function Get-MigrationFilesOnDisk {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$MigrationsDir
    )

    $empty = [pscustomobject]@{
        Error = $null; Files = @(); OnDisk = @{}; HashOnDisk = @{}; ByHash = @{}
    }

    if (-not (Test-Path -LiteralPath $MigrationsDir -PathType Container)) {
        $empty.Error = "Migrations folder not found: $MigrationsDir."
        return $empty
    }

    # -File, because -Filter matches a DIRECTORY named migration_*.sql too.
    $files = @(Get-ChildItem -LiteralPath $MigrationsDir -Filter "migration_*.sql" -File |
               Sort-Object Name)

    if ($files.Count -eq 0) {
        $empty.Error = "No migration_*.sql found in $MigrationsDir. Either the folder is empty or it cannot be read; a database with recorded migrations and no files on disk is not a state to call up to date."
        return $empty
    }

    $onDisk     = @{}
    $hashOnDisk = @{}
    $byHash     = @{}

    foreach ($f in $files) {
        # -ErrorAction here, because under Set-StrictMode -Version Latest
        # `.Hash` on the nothing Get-FileHash returns for an unreadable path is
        # a raw PropertyNotFoundException.
        # -LiteralPath, matching the Test-Path above: -Path glob-expands, so a
        # migration whose name contains [ or ] matches nothing and produces
        # "Cannot read <file>" about a file that is perfectly readable.
        $fh = Get-FileHash -Algorithm MD5 -LiteralPath $f.FullName -ErrorAction SilentlyContinue
        if ($null -eq $fh) {
            $empty.Error = "Cannot read $($f.FullName)."
            return $empty
        }
        $h = $fh.Hash
        $onDisk[$f.Name]     = $f.FullName
        $hashOnDisk[$f.Name] = $h
        if (-not $byHash.ContainsKey($h)) { $byHash[$h] = @() }
        $byHash[$h] += $f.Name
    }

    return [pscustomobject]@{
        Error = $null; Files = $files; OnDisk = $onDisk
        HashOnDisk = $hashOnDisk; ByHash = $byHash
    }
}

# ---------------------------------------------------------------------------
# ConvertTo-AppliedMigrationMap -- parse the rows of
#
#     SELECT filename || E'\t' || coalesce(checksum, '') FROM schema_migrations
#
# into @{ filename -> stored hash }, with "" for a row that carries none.
#
# coalesce() turns a NULL into the empty string, which the comparison reads as
# "unknown" and never as "changed" -- the two are different facts and are
# reported as different sentences. Rows written before this runner began
# hashing, and everything migration_056 backfilled by assertion, have nothing
# to compare.
#
# A row whose checksum is NULL arrives as "<filename><TAB>", and a caller that
# trims each line has already removed that trailing tab -- so the split yields
# ONE element and the else branch is the normal path for every migration_056
# backfill row, not an error case.
#
# ⚠️ `filename` is a case-SENSITIVE primary key in Postgres; a PowerShell
# hashtable is case-INSENSITIVE. Two rows differing only in case would collapse
# into one key here, the second silently overwriting the first's checksum, and
# the discarded row would never be compared. That is reported rather than
# guessed at: DuplicateName names the collision and Applied is returned empty.
#
# Returns a [pscustomobject]:
#   DuplicateName : $null, or the filename recorded twice in different case.
#   Applied       : @{ filename -> stored MD5, or "" }
# ---------------------------------------------------------------------------
function ConvertTo-AppliedMigrationMap {
    [CmdletBinding()]
    param(
        # ⚠️ **BOTH Allow attributes, and the second one is not decoration.** A
        # Mandatory parameter rejects an empty string, and it applies that test
        # to every ELEMENT of a [string[]] -- so without AllowEmptyString this
        # function throws on the blank line `psql -t` prints after its last
        # row, which is to say on every ordinary call. Found by running it.
        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [AllowEmptyString()]
        [string[]]$Rows
    )

    $applied = @{}

    foreach ($row in $Rows) {
        # ⚠️ **LINE ENDINGS ONLY, NOT `Trim()`.** Both callers pass `psql -t -A`
        # output, which carries no alignment padding to strip - so a general
        # trim would strip nothing psql put there and one thing POSTGRES did:
        # a `filename` recorded with a leading or trailing space. See the note
        # on the split below for why that key must survive intact. What has to
        # come off is the carriage return `docker exec` leaves on every line.
        $line = "$row".Trim([char]13, [char]10)
        if ($line.Trim() -eq "") { continue }

        # ⚠️ The parts are NOT trimmed, and that is not an oversight. `filename`
        # is a case-sensitive primary key in Postgres and a name recorded with
        # a leading or trailing space is a DIFFERENT key there. Normalising it
        # here would file that row under a name the table does not hold, report
        # it as Absent, and print a repair -- `UPDATE schema_migrations ...
        # WHERE filename = '<recorded name>'` -- that matches zero rows, so the
        # run would stop for ever on a command that cannot work. The whole LINE
        # ends in line-ending characters only, so a name recorded with a
        # leading or trailing space reaches Compare-MigrationState intact.
        #
        # ⚠️ **BOTH CALLERS HAVE TO AGREE ABOUT THIS, AND FOR ONE ROUND THEY
        # DID NOT.** Apply-Migration.ps1 reads through its own `Invoke-Psql`,
        # which used to `Trim()` every line before this function saw it - so
        # there a leading space on a recorded filename was eaten, the row was
        # filed under the trimmed name, and a migration that had NEVER been
        # applied was reported as applied, exit 0. Worse once the two callers
        # differed: build-ciprian-image.ps1 (no pre-trim) refused the same
        # database and told Adrian to run Apply-Migration.ps1, which said it
        # was up to date - a loop with no way out by following the message.
        # `Invoke-Psql` now trims line endings only, for that reason, and its
        # own comment says so. If either side is ever widened back to a bare
        # `Trim()`, both must be.
        $parts = $line -split "`t", 2
        $name  = $parts[0]
        if ($name -eq "") { continue }

        if ($applied.ContainsKey($name)) {
            return [pscustomobject]@{ DuplicateName = $name; Applied = @{} }
        }
        $applied[$name] = if ($parts.Count -gt 1) { $parts[1] } else { "" }
    }

    return [pscustomobject]@{ DuplicateName = $null; Applied = $applied }
}

# ---------------------------------------------------------------------------
# Compare-MigrationState -- the buckets, from the two maps above.
#
# Returns a [pscustomobject]:
#   Changed     : @(@{Name; Stored; Actual})  recorded, and the file no longer
#                                             hashes to what was stored.
#   Renamed     : @(@{Name; NowCalled})       recorded, no file of that name,
#                                             but an UNRECORDED file carries
#                                             the stored hash.
#   ClaimedTwin : @{ file on disk -> @(recorded names claiming it) }
#   Miscased    : @(@{Recorded; OnDisk})      same file, different spelling.
#   Unknown     : @(filename)                 recorded with no checksum.
#   Absent      : @(filename)                 recorded, no file, no twin.
#   Pending     : @(FileInfo)                 on disk, not recorded.
#   Comparable  : [int] rows that had something to compare.
#
# ⚠️ A RENAME IS NOT A MISSING FILE: the same SQL is still on disk under a new
# name, so it looks pending and would be applied a SECOND time. The stored hash
# identifies it exactly, which is why this is a report and not a guess.
# (Slice #34.18 review round 2.)
#
# ⚠️ Only when the twin is itself UNRECORDED. A file carrying this hash that
# already has its own row is not somewhere this migration "went" -- nothing is
# at risk, and calling it a rename produced a permanent exit 2 whose own
# printed repair (UPDATE ... SET filename = ...) then failed on the primary
# key. Two byte-identical migrations are enough to reach that state.
#
# ClaimedTwin exists so the caller can say when TWO recorded names claim one
# file -- there the printed UPDATE works once and then fails on the primary
# key. (Review round 4.)
# ---------------------------------------------------------------------------
function Compare-MigrationState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]$Disk,
        [Parameter(Mandatory)][hashtable]$Applied
    )

    $changed     = @()
    $renamed     = @()
    $claimedTwin = @{}
    $miscased    = @()
    $unknown     = @()
    $absent      = @()

    foreach ($name in ($Applied.Keys | Sort-Object)) {
        $stored = $Applied[$name]

        if (-not $Disk.OnDisk.ContainsKey($name)) {
            $twins = @()
            if ($stored -ne "" -and $Disk.ByHash.ContainsKey($stored)) {
                $twins = @($Disk.ByHash[$stored] | Where-Object { -not $Applied.ContainsKey($_) })
            }
            if ($twins.Count -gt 0) {
                foreach ($t in $twins) {
                    if (-not $claimedTwin.ContainsKey($t)) { $claimedTwin[$t] = @() }
                    $claimedTwin[$t] += $name
                }
                $renamed += [pscustomobject]@{ Name = $name; NowCalled = ($twins -join ", ") }
            } else {
                $absent += $name
            }
            continue
        }

        # Windows matches filenames case-insensitively; Postgres does not. A row
        # typed by hand in the wrong case therefore looks applied here while
        # being a different primary key there -- and the pending test below
        # would report the real migration as already applied and never run it.
        $realName = [System.IO.Path]::GetFileName($Disk.OnDisk[$name])
        if ($realName -cne $name) {
            $miscased += [pscustomobject]@{ Recorded = $name; OnDisk = $realName }
            continue
        }

        if ($stored -eq "") {
            $unknown += $name
            continue
        }

        # -ne on strings is case-INSENSITIVE in PowerShell, which is what is
        # wanted here: Get-FileHash returns upper-case hex, and a row
        # re-recorded by hand may not. Use -cne if that ever needs to become a
        # difference.
        if ($stored -ne $Disk.HashOnDisk[$name]) {
            $changed += [pscustomobject]@{
                Name = $name; Stored = $stored; Actual = $Disk.HashOnDisk[$name]
            }
        }
    }

    $pending = @($Disk.Files | Where-Object { -not $Applied.ContainsKey($_.Name) })

    return [pscustomobject]@{
        Changed     = @($changed)
        Renamed     = @($renamed)
        ClaimedTwin = $claimedTwin
        Miscased    = @($miscased)
        Unknown     = @($unknown)
        Absent      = @($absent)
        Pending     = $pending
        Comparable  = $Applied.Count - @($unknown).Count - @($absent).Count - @($renamed).Count - @($miscased).Count
    }
}
