<#
.SYNOPSIS
    Apply pending database migrations to the local Docker Postgres container.

.DESCRIPTION
    Compares migration_*.sql files in src\db against the schema_migrations
    table in the running container and applies any that have not been recorded.
    Stops on the first failure so a broken migration does not get skipped.

    Before applying anything it also VERIFIES the migrations that are already
    recorded: each stored MD5 is compared against the file on disk, and a file
    that has changed since it was applied stops the run. That check is why
    "up to date" now means the file that ran is the file in the repository, and
    not merely that the name is in the table.

    If schema_migrations does not exist yet, the script bootstraps itself by
    applying migration_056_schema_migrations.sql first.

.PARAMETER Container
    Docker container name. Default: ga40prj-postgres

.PARAMETER Database
    Postgres database name. Default: ga40db

.PARAMETER DbUser
    Postgres user. Default: postgres

.PARAMETER ShowUnknown
    List by name the recorded migrations that carry no checksum, instead of
    only counting them. Off by default: on a database seeded by migration_056's
    backfill there are about sixty of them, every run, and they are not a
    problem -- see Step 4. Same spirit as Verify-Schema.ps1 -ShowExtra.

.EXAMPLE
    .\scripts\Apply-Migration.ps1

.EXAMPLE
    .\scripts\Apply-Migration.ps1 -Container my-postgres -Database mydb

.NOTES
    Exit 0 = nothing pending, or everything pending applied.
    Exit 1 = the run could not proceed or did not finish: container
             unreachable, src\db missing, empty or unreadable, a migration
             file that cannot be hashed, bootstrap file missing, bootstrap
             failed, a psql query failed, or a migration failed to apply.
    Exit 2 = schema_migrations and src\db disagree about a migration that is
             already recorded. Three places raise it: two rows differing only
             in case (Step 3); a recorded file that is changed, renamed or
             recorded under a different case (Step 4); and a recorded name with
             no file arriving alongside anything pending, which is what a
             rename looks like once the file was also edited (Step 5).
             NOTHING was applied by any of them.
    Exit 3 = a migration APPLIED but its row could not be recorded. Do not
             re-run until the row exists; see the message, which prints the
             exact INSERT.
#>
param(
    [string]$Container = "ga40prj-postgres",
    [string]$Database  = "ga40db",
    [string]$DbUser    = "postgres",
    [switch]$ShowUnknown
)

Set-StrictMode -Version Latest

# PowerShell 7.4+ turns a non-zero native exit code into a terminating error
# when $ErrorActionPreference is 'Stop', and preference variables are inherited
# from the caller's scope -- a $PROFILE or a wrapper setting Stop would make
# every `if ($LASTEXITCODE -ne 0)` block in this file dead code and replace its
# tailored message with a raw NativeCommandExitException. build-ciprian-image.ps1
# carries the same line for the same reason. (Slice #34.18 review.)
$PSNativeCommandUseErrorActionPreference = $false

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
#
# ⚠️ **NO `2>&1`, AND `$LASTEXITCODE` IS CHECKED. Both are load-bearing, and
# this script had neither.** build-ciprian-image.ps1 already carries the fix
# and the reason: merging stderr into stdout makes an ERROR MESSAGE PARSE AS
# DATA. Step 3 below reads rows out of this function, so one stderr line --
# `FATAL: the database system is in recovery mode`, `too many connections`, a
# docker warning -- became a "recorded migration". Step 2 was worse: it
# compares the whole output to "f", so noise ahead of the answer silently
# skipped the bootstrap, Step 3 then read the ERROR text for a missing table as
# three more rows, and Step 5 saw every file on disk as pending and re-applied
# the lot against a live database. (Found by the Slice #34.18 adversarial
# review, which also pointed out that the new Step 4 would have printed those
# three rows under a heading calling them "not fatal".)
#
# -A (unaligned) as well as -t. Trim() below already removes aligned mode's
# padding, so this is not a fix for a bug -- it is the difference between
# parsing a table drawn for a human and reading a value written for a machine,
# and it takes the column widths out of the contract. Note psql's own default
# separator in unaligned mode is `|`, which is why Step 3's query joins its two
# values with a TAB: a second column added later cannot then be mistaken for
# the delimiter.
# ---------------------------------------------------------------------------
function Invoke-Psql {
    param([string]$Sql)
    $lines = docker exec $Container psql -U $DbUser -d $Database -t -A -c $Sql
    if ($LASTEXITCODE -ne 0) {
        Write-Error "psql exited $LASTEXITCODE. Nothing has been applied. Query was: $Sql"
        exit 1
    }
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
    if (-not (Test-Path -LiteralPath $bootstrap)) {
        Write-Error "Bootstrap file not found: $bootstrap"
        exit 1
    }
    $tmpBoot = "/tmp/migration_056_schema_migrations.sql"
    docker cp $bootstrap "${Container}:${tmpBoot}"
    # Checked, like every other docker call here: a failed copy leaves whatever
    # was already at that path inside the container, and psql then applies THAT
    # as the bootstrap. Step 6's cp has always been checked; this one was not.
    if ($LASTEXITCODE -ne 0) {
        Write-Error "docker cp of the bootstrap migration failed. Nothing has been applied."
        exit 1
    }
    docker exec $Container psql -U $DbUser -d $Database -v ON_ERROR_STOP=1 -f $tmpBoot
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Bootstrap failed. Aborting."
        exit 1
    }
    Write-Host "Bootstrap complete."
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Step 3 -- load the set of already-applied migrations, WITH their checksums
#
# The checksum column has existed since migration_056 and this runner has
# written one on every apply since; nothing has ever read one back. It is read
# here, so the hashtable holds filename -> stored hash rather than
# filename -> $true. coalesce() turns a NULL into the empty string, which
# Step 4 reads as "unknown" and never as "changed" -- the two are different
# facts and are reported as different sentences.
# ---------------------------------------------------------------------------
$appliedRows = Invoke-Psql "SELECT filename || E'\t' || coalesce(checksum, '') FROM schema_migrations ORDER BY filename;"
$applied = @{}
foreach ($row in $appliedRows) {
    if ($row -ne "") {
        # A row whose checksum is NULL arrives as "<filename><TAB>", and
        # Invoke-Psql's Trim() has already removed that trailing tab -- so the
        # split yields ONE element and the else branch below is the normal
        # path for every migration_056 backfill row, not an error case.
        $parts = $row -split '\t', 2
        $name  = $parts[0]
        # `filename` is a case-SENSITIVE primary key in Postgres; a PowerShell
        # hashtable is case-INSENSITIVE. Two rows differing only in case would
        # therefore collapse into one key here, the second silently overwriting
        # the first's checksum, and the discarded row would never be compared.
        # Refuse instead of guessing which spelling is real.
        if ($applied.ContainsKey($name)) {
            Write-Host ""
            Write-Host "schema_migrations holds two rows whose filenames differ only in case:"
            Write-Host "   $name"
            Write-Host "Postgres treats them as two migrations; Windows treats the files as one."
            Write-Host "Find both rows, decide which spelling is real, and DELETE the other"
            Write-Host "before running this script again:"
            Write-Host "   docker exec $Container psql -U $DbUser -d $Database -c ""SELECT filename, checksum FROM schema_migrations WHERE lower(filename) = lower('$name');"""
            Write-Host "   docker exec $Container psql -U $DbUser -d $Database -c ""DELETE FROM schema_migrations WHERE filename = '<the wrong spelling>';"""
            exit 2
        }
        $applied[$name] = if ($parts.Count -gt 1) { $parts[1] } else { "" }
    }
}
Write-Host "Already applied : $($applied.Count) migration(s)"

# ---------------------------------------------------------------------------
# Step 4 -- verify that each recorded migration is still the file on disk
#
# WHY THIS EXISTS. The runner wrote an MD5 on every apply and never compared
# one, so a migration CORRECTED after it was applied stays "applied" for ever:
# Step 5 selects by filename, and the filename never changed.
#
# ⚠️ **AND IT DOES NOT RESCUE migration_020, WHICH IS THE CASE THAT PROMPTED
# IT.** migration_020_rename_to_document.sql had a misaligned translate() map,
# since corrected -- but 020 is below 056, so no database ever got it through
# this runner: every one of them holds it as a migration_056 BACKFILL row, with
# no checksum at all. Step 4 therefore reports it as unknown, on every database,
# for ever, and could not report it as changed even in principle. What this
# check catches is every migration applied by the runner SINCE 056 and edited
# afterwards. What reaches migration_020 is a new forward migration; nothing
# here does, and saying otherwise would be the comment this file already has a
# history of. (Slice #34.18 adversarial review.)
#
# A NULL STORED CHECKSUM IS NOT A MISMATCH. Rows written before this runner
# began hashing, and everything migration_056 backfilled by assertion (008 to
# 056 inclusive -- it records its own filename too, so the bootstrap migration
# is itself never verified), have nothing to compare. Calling those "changed"
# would bury the one row that matters under sixty that do not.
# ---------------------------------------------------------------------------
# ⚠️ The folder is checked before it is walked, and it is walked ONCE. A
# missing or unreadable src\db makes Get-ChildItem write a non-terminating
# error and return nothing, which used to end this run at "Database is up to
# date. Nothing to do.", exit 0 -- with every recorded row in the NO FILE
# bucket, under a heading telling the reader it is not evidence of anything.
# Enumerating once also removes a race: Step 5 used to walk the folder again,
# so a file appearing between the two walks was applied with an EMPTY checksum
# and became permanently unverifiable -- the very row shape Step 4 exists to
# eliminate. (Slice #34.18 review round 3.)
if (-not (Test-Path -LiteralPath $migrationsDir -PathType Container)) {
    Write-Error "Migrations folder not found: $migrationsDir. Nothing has been applied."
    exit 1
}

$allFiles   = @(Get-ChildItem -LiteralPath $migrationsDir -Filter "migration_*.sql" -File | Sort-Object Name)

# ⚠️ Test-Path -PathType Container returns True for a directory that cannot be
# ENUMERATED, and Get-ChildItem then returns nothing with no error at all -- so
# the guard above passes, every recorded row lands in NO FILE, and the run used
# to end at "Database is up to date. Nothing to do.", exit 0, with a genuinely
# pending migration on disk and unmentioned. A sparse or half-copied checkout
# reaches the same place with an empty folder. A database holding recorded
# migrations while src\db offers none is not a state to report cheerfully.
if ($allFiles.Count -eq 0) {
    Write-Error "No migration_*.sql found in $migrationsDir. Either the folder is empty or it cannot be read; a database with recorded migrations and no files on disk is not something this script will call up to date. Nothing has been applied."
    exit 1
}

$onDisk     = @{}   # filename -> full path
$hashOnDisk = @{}   # filename -> MD5
$byHash     = @{}   # MD5 -> filenames carrying it

foreach ($f in $allFiles) {
    # -File above, because -Filter matches a DIRECTORY named migration_*.sql
    # too; and -ErrorAction here, because under Set-StrictMode -Version Latest
    # `.Hash` on the nothing Get-FileHash returns for an unreadable path is a
    # raw PropertyNotFoundException, in the one script whose entire design is
    # tailored messages.
    # -LiteralPath, matching the Test-Path above: -Path glob-expands, so a
    # migration whose name contains [ or ] matches nothing and produces
    # "Cannot read <file>" about a file that is perfectly readable.
    $fh = Get-FileHash -Algorithm MD5 -LiteralPath $f.FullName -ErrorAction SilentlyContinue
    if ($null -eq $fh) {
        Write-Error "Cannot read $($f.FullName). Nothing has been applied."
        exit 1
    }
    $h = $fh.Hash
    $onDisk[$f.Name]     = $f.FullName
    $hashOnDisk[$f.Name] = $h
    if (-not $byHash.ContainsKey($h)) { $byHash[$h] = @() }
    $byHash[$h] += $f.Name
}

$changed     = @()
$renamed     = @()
$claimedTwin = @{}   # file on disk -> the recorded names that hash to it
$miscased = @()
$unknown  = @()
$absent   = @()

foreach ($name in ($applied.Keys | Sort-Object)) {
    $stored = $applied[$name]

    if (-not $onDisk.ContainsKey($name)) {
        # A RENAME is not a missing file: the same SQL is still on disk under a
        # new name, so Step 5 sees the new name as pending and would apply it a
        # SECOND time. The stored hash identifies it exactly, which is why this
        # is a report and not a guess. (Slice #34.18 review round 2.)
        # ⚠️ Only when the twin is itself UNRECORDED. A file carrying this
        # hash that already has its own row is not somewhere this migration
        # "went" -- Step 5 will not apply it, nothing is at risk, and calling
        # it a rename produced a permanent exit 2 whose own printed repair
        # (UPDATE ... SET filename = ...) then fails on the primary key. Two
        # byte-identical migrations are enough to reach that state.
        $twins = @()
        if ($stored -ne "" -and $byHash.ContainsKey($stored)) {
            $twins = @($byHash[$stored] | Where-Object { -not $applied.ContainsKey($_) })
        }
        if ($twins.Count -gt 0) {
            # Which recorded names claim each file, so the report can say when
            # TWO of them claim one -- there the printed UPDATE works once and
            # then fails on the primary key, which is the shape round 2 fixed
            # for the other arrangement. (Review round 4.)
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
    # typed by hand in the wrong case therefore looks applied here while being
    # a different primary key there -- and Step 5's ContainsKey would report
    # the real migration as already applied and never run it.
    $realName = [System.IO.Path]::GetFileName($onDisk[$name])
    if ($realName -cne $name) {
        $miscased += [pscustomobject]@{ Recorded = $name; OnDisk = $realName }
        continue
    }

    if ($stored -eq "") {
        $unknown += $name
        continue
    }

    # -ne on strings is case-INSENSITIVE in PowerShell, which is what is wanted
    # here: Get-FileHash returns upper-case hex, and a row re-recorded by hand
    # may not. Use -cne if that ever needs to become a difference.
    if ($stored -ne $hashOnDisk[$name]) {
        $changed += [pscustomobject]@{ Name = $name; Stored = $stored; Actual = $hashOnDisk[$name] }
    }
}

$compared = $applied.Count - $unknown.Count - $absent.Count - $renamed.Count - $miscased.Count
Write-Host "Checksum match  : $($compared - $changed.Count) of $compared comparable row(s); $($unknown.Count) unknown, $($absent.Count) with no file, $($renamed.Count) renamed, $($miscased.Count) wrong case"

if ($unknown.Count -gt 0) {
    Write-Host ""
    Write-Host "UNKNOWN ($($unknown.Count)) -- recorded with no checksum, so there is nothing to compare."
    Write-Host "This is NOT a mismatch, and it is expected: migration_056 backfilled 008 to 056"
    Write-Host "by assertion, hashing nothing, so on a database of that vintage most of these"
    Write-Host "rows are that backfill. What they do not tell you is whether those migrations"
    Write-Host "ever really ran -- .\scripts\Verify-Schema.ps1 is what answers that."
    if ($ShowUnknown) {
        foreach ($n in $unknown) { Write-Host "   ? $n" }
    } else {
        Write-Host "Re-run with -ShowUnknown to list them."
    }
}

if ($absent.Count -gt 0) {
    Write-Host ""
    Write-Host "NO FILE ($($absent.Count)) -- recorded in schema_migrations, with no such file in"
    Write-Host "src\db and no UNRECORDED file on disk carrying the recorded hash:"
    foreach ($n in $absent) { Write-Host "   - $n" }
    Write-Host "With no file there is nothing to hash, so on its own this is not evidence that"
    Write-Host "the database differs from the repository."
    Write-Host "⚠️ BUT A RENAME CAN LAND HERE, AND THE RENAME CHECK CANNOT SEE IT. That check"
    Write-Host "matches on the stored hash, so it finds a file renamed and not otherwise"
    Write-Host "touched. A file renamed AND edited -- even by one comment, which the CHANGED"
    Write-Host "advice says is the common edit -- has no matching hash, and a migration_056"
    Write-Host "backfill row has no hash to match with at all. Both arrive here looking like a"
    Write-Host "removal. That is why a name above, together with anything pending below, stops"
    Write-Host "this run."
}

if ($miscased.Count -gt 0) {
    Write-Host ""
    Write-Host "WRONG CASE ($($miscased.Count)) -- recorded under a spelling the file does not have:"
    foreach ($m in $miscased) {
        Write-Host "   ! recorded: $($m.Recorded)"
        Write-Host "     on disk : $($m.OnDisk)"
    }
    Write-Host "Postgres keys schema_migrations by an exact string, so the real file is NOT"
    Write-Host "recorded -- and Windows's case-insensitive lookup is what hides that. Left"
    Write-Host "alone, Step 5 would report the migration as applied and never run it."
}

if ($renamed.Count -gt 0) {
    $doubleClaimed = @($claimedTwin.Keys | Where-Object { $claimedTwin[$_].Count -gt 1 })
    Write-Host ""
    Write-Host "RENAMED ($($renamed.Count)) -- recorded under a name that is gone, but a file on disk"
    Write-Host "still carries the recorded hash, so the SQL is the same SQL:"
    foreach ($r in $renamed) {
        Write-Host "   ! was     : $($r.Name)"
        Write-Host "     now     : $($r.NowCalled)"
    }
    Write-Host "This stops the run because the new name is UNRECORDED, so Step 5 would treat it"
    Write-Host "as pending and apply the same SQL a second time -- and most of these files are"
    Write-Host "not idempotent. Rename the row rather than adding one."
    if ($doubleClaimed.Count -gt 0) {
        Write-Host "⚠️ More than one recorded name hashes to the same file:"
        foreach ($d in $doubleClaimed) { Write-Host "   $d  <- $($claimedTwin[$d] -join ', ')" }
        Write-Host "Only ONE of them can become that filename -- schema_migrations keys on it."
        Write-Host "Rename one row and DELETE the rest, or the second UPDATE fails on the"
        Write-Host "primary key and this run stops for ever."
    }
}

if ($changed.Count -gt 0) {
    Write-Host ""
    Write-Host "CHANGED ($($changed.Count)) -- recorded, but the file on disk no longer hashes to what was stored:"
    foreach ($c in $changed) {
        Write-Host "   ! $($c.Name)"
        Write-Host "        stored  : $($c.Stored)"
        Write-Host "        on disk : $($c.Actual)"
    }
}

if ($changed.Count -gt 0 -or $renamed.Count -gt 0 -or $miscased.Count -gt 0) {
    Write-Host ""
    Write-Host "NOTHING HAS BEEN APPLIED by this run."
    Write-Host ""
    Write-Host @"
There is no safe automatic answer, which is why this stops rather than picking
one. Re-applying is wrong -- most of these files are not idempotent. For a
CHANGED row, which answer is right depends on what the edit changed:

  * cosmetic (a comment, whitespace, a message) -- the database is correct and
    only the record is stale. Re-record the hash, which is also the step that
    unblocks this script:

      docker exec $Container psql -U $DbUser -d $Database -c "UPDATE schema_migrations SET checksum = '<on disk>' WHERE filename = '<file>';"

  * the SQL now DOES something different -- this database is behind the
    repository, and re-running the file is not the way back. RE-RECORD THE HASH
    FIRST, using the same command: until you do, this script exits here and
    cannot apply anything, including the fix. Then write a new migration that
    carries the correction forward and run this script again to apply it.

  * you do not know which -- read the edit before deciding:

      git log -p -- src/db/<file>

  * that command shows NO commit touching the file -- then nothing was edited
    and the BYTES changed anyway: a CRLF/LF renormalisation on a fresh clone, a
    git add --renormalize, an editor that added a BOM. Get-FileHash hashes
    bytes, so this is a false alarm by construction, and the answer is the
    re-record above for every file listed. An empty git log is the diagnosis
    here, not a dead end.

    (No backticks anywhere in this block, deliberately: it is an INTERPOLATING
    here-string, so a backtick is an escape character and is swallowed.)

A COMMENT-ONLY EDIT TO AN APPLIED MIGRATION LANDS HERE TOO, and will keep
doing so -- that is the price of hashing bytes, and it is cheaper than a
comparison that tries to judge which edits matter. Re-record and carry on.

For a RENAMED or WRONG CASE row, the fix is the same shape and updates the name
instead:

      docker exec $Container psql -U $DbUser -d $Database -c "UPDATE schema_migrations SET filename = '<name on disk>' WHERE filename = '<recorded name>';"
"@
    exit 2
}
Write-Host ""

# ---------------------------------------------------------------------------
# Step 5 -- find pending migrations
# ---------------------------------------------------------------------------
# $allFiles comes from Step 4's single walk of the folder -- see the comment
# there for why this is not enumerated a second time.
$pending = @($allFiles | Where-Object { -not $applied.ContainsKey($_.Name) })
Write-Host "Pending         : $($pending.Count) migration(s)"
Write-Host ""

# ⚠️ **THE ONE COMBINATION THAT RE-APPLIES A MIGRATION, CHECKED HERE RATHER
# THAN IN STEP 4 BECAUSE IT NEEDS BOTH LISTS.** A recorded row with no file,
# plus a file with no row, is what a rename looks like once the renamed file has
# ALSO been edited -- and then Step 6 applies the same SQL a second time.
# Measured by the Slice #34.18 review round 4: a seed migration renamed and
# given one comment line inserted its rows twice, exit 0, under a NO FILE
# heading that told the reader a rename would have been caught.
#
# Neither list alone is a problem: names with no file and nothing pending is a
# removal, and pending with nothing absent is the ordinary case. It is the pair
# that cannot be told apart from a rename, so the pair is what stops.
if ($absent.Count -gt 0 -and $pending.Count -gt 0) {
    Write-Host "STOPPING -- $($absent.Count) recorded migration(s) have no file, and $($pending.Count) file(s) have no row."
    Write-Host ""
    Write-Host "Recorded, no file:"
    foreach ($n in $absent) { Write-Host "   - $n" }
    Write-Host "Pending, no row:"
    foreach ($f in $pending) { Write-Host "   + $($f.Name)" }
    Write-Host ""
    Write-Host "If any file in the second list is a RENAMED version of a name in the first,"
    Write-Host "applying it re-runs SQL this database has already run -- and most of these"
    Write-Host "files are not idempotent. Step 4's rename check matches on the stored hash and"
    Write-Host "therefore cannot see a file that was renamed AND edited, or one whose row came"
    Write-Host "from migration_056's backfill and has no hash at all."
    Write-Host ""
    Write-Host "If it IS a rename, move the row rather than adding one:"
    Write-Host "   docker exec $Container psql -U $DbUser -d $Database -c ""UPDATE schema_migrations SET filename = '<name on disk>' WHERE filename = '<recorded name>';"""
    Write-Host "If the two lists are unrelated -- a migration genuinely removed from the repo,"
    Write-Host "and a new one to apply -- delete the stale row and run this script again:"
    Write-Host "   docker exec $Container psql -U $DbUser -d $Database -c ""DELETE FROM schema_migrations WHERE filename = '<recorded name>';"""
    exit 2
}

if ($pending.Count -eq 0) {
    Write-Host "Database is up to date. Nothing to do."
    Write-Host ""
    Write-Host "NOTE: 'up to date' now means two things, and still not a third."
    Write-Host "  1. Every migration_*.sql in src\db is recorded in schema_migrations."
    Write-Host "  2. Every recorded file that carries a checksum still hashes to it --"
    Write-Host "     Step 4 above, which would have stopped this run otherwise."
    Write-Host "It does NOT mean the tables actually exist. migration_056 backfilled 008 to 056"
    Write-Host "by assertion, and those are precisely the rows Step 4 reports as unknown, so"
    Write-Host "a migration that was never really applied still shows as applied here."
    Write-Host "Confirm with:  .\scripts\Verify-Schema.ps1"
    exit 0
}

# ---------------------------------------------------------------------------
# Step 6 -- apply each pending migration in sorted order
# ---------------------------------------------------------------------------
$ok          = 0
$fail        = 0
$unrecorded  = 0

foreach ($file in $pending) {
    Write-Host "Applying $($file.Name) ..."

    $tmpPath  = "/tmp/$($file.Name)"
    $checksum = $hashOnDisk[$file.Name]

    docker cp $file.FullName "${Container}:${tmpPath}"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAILED (docker cp). Stopping."
        $fail++
        break
    }

    # ON_ERROR_STOP=1 is what makes the check below mean anything. Without it
    # psql runs every remaining statement after one fails and still exits 0,
    # so $LASTEXITCODE is 0, this function prints OK and the INSERT INTO
    # schema_migrations below records a migration that did not apply --
    # contradicting this script's own .DESCRIPTION. build-ciprian-image.ps1
    # already passes the flag; this runner did not. (Found by the Slice
    # #26.12 adversarial review.)
    docker exec $Container psql -U $DbUser -d $Database -v ON_ERROR_STOP=1 -f $tmpPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAILED (psql). Fix the error and re-run. Stopping."
        $fail++
        break
    }

    # Record the successful apply. The hash written here is the one Step 4
    # compares on every later run, which is the whole of what makes that check
    # possible -- it needs no new column and no new write.
    #
    # Fixed in passing (#34.18): this INSERT discarded its output AND its exit
    # code, so a failed record left a migration APPLIED and UNRECORDED, and the
    # next run would apply it a second time. Its stdout is still sent to $null
    # -- there is nothing to read there -- but STDERR no longer is, so psql's
    # own message reaches the operator: the exit code says THAT it failed and
    # only that message says why, which is Invoke-Psql's whole argument.
    $safeName = $file.Name.Replace("'", "''")
    $insert   = "INSERT INTO schema_migrations (filename, checksum) VALUES ('$safeName', '$checksum') ON CONFLICT (filename) DO NOTHING;"
    docker exec $Container psql -U $DbUser -d $Database -c $insert > $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  APPLIED, BUT NOT RECORDED (psql exit $LASTEXITCODE)."
        Write-Host "  $($file.Name) ran successfully and its row was NOT written."
        Write-Host "  DO NOT re-run this script until that row exists, or the file is applied a"
        Write-Host "  second time -- and most of these files are not idempotent. The message"
        Write-Host "  above this line is psql's own. Record it by hand with:"
        Write-Host "    docker exec $Container psql -U $DbUser -d $Database -c ""$insert"""
        $unrecorded++
        break
    }

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
if ($unrecorded -gt 0) {
    Write-Host "Applied but NOT recorded : $unrecorded  <-- read the message above before re-running"
}
Write-Host "Baseline : $($applied.Count) (were already recorded)"
Write-Host "================================"
Write-Host ""

if ($unrecorded -gt 0) {
    $notAttempted = $pending.Count - $ok - $unrecorded
    if ($notAttempted -gt 0) {
        Write-Host "Not attempted : $notAttempted migration(s) -- this run stopped at the unrecorded row above."
    }
    Write-Host "Next: write the missing schema_migrations row, exactly as printed above."
    exit 3
}

# ⚠️ Before the routine "Next:" line, not after it. This branch used to fall
# through to "Next: Verify-Schema.ps1", so a run stopped by a broken migration
# ended by recommending a table check -- and never named the migrations it had
# not attempted. (Slice #34.18 review round 3.)
if ($fail -gt 0) {
    $notAttempted = $pending.Count - $ok - $fail
    if ($notAttempted -gt 0) {
        Write-Host "Not attempted : $notAttempted migration(s) -- this run stopped at the failure above."
    }
    Write-Host "Next: fix the migration that failed, then re-run this script. It resumes at"
    Write-Host "      the first file with no row in schema_migrations."
    exit 1
}

Write-Host "Next: .\scripts\Verify-Schema.ps1  (confirms the tables really exist)"
