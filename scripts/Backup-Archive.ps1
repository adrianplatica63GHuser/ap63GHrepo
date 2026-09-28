#Requires -Version 7.0
<#
.SYNOPSIS
    Back up the archive - the local database and every page file - to OneDrive,
    or run the restore drill on the newest backup. Slice #37.11, FU-006.

.DESCRIPTION
    The work is scripts\backup\archive.ts; this is the way to run it by hand.
    Normally nobody does: the test runner (the Scheduled Task "\ga40prj\Test
    runner") takes a backup every day it is running, one before every
    migrate-local, and runs the drill once a month and after a migration.

    A backup is a folder  %OneDrive%\ga40prj-backups\<yyyy-MM-ddTHHmmssZ>\
    holding  ga40db.dump  (pg_dump -Fc),  uploads\  (every page file) and
    manifest.json  (rows per table, every file's size and SHA-256). The last 14
    days are kept. Set the user environment variable GA40_BACKUP_ROOT to an
    absolute path to put them somewhere else.

    The live database is only read. The drill restores the newest backup into a
    throwaway container on 127.0.0.1:5434 and a scratch folder, checks every row
    and file against the manifest, asks the restored app on port 3200 for each
    entity list once, and removes all of it.

.PARAMETER Drill
    Run the restore drill instead of taking a backup.

.PARAMETER Where
    Print where the backups are, the newest, and the last drill. Changes nothing.

.EXAMPLE
    pwsh -NoProfile -File C:\dev\ga40prj\scripts\Backup-Archive.ps1

.EXAMPLE
    pwsh -NoProfile -File C:\dev\ga40prj\scripts\Backup-Archive.ps1 -Drill

.NOTES
    Exit codes, from archive.ts:  backup 0 written, 2 could not;
    drill 0 passed, 1 the copy is not the archive, 2 could not run.
#>
[CmdletBinding()]
param(
    [switch]$Drill,
    [switch]$Where
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false   # the exit code is the answer, passed through below

$repo   = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$tsx    = Join-Path $repo 'node_modules\tsx\dist\cli.mjs'
$script = Join-Path $repo 'scripts\backup\archive.ts'
$mode   = if ($Where) { 'where' } elseif ($Drill) { 'drill' } else { 'backup' }

Push-Location -LiteralPath $repo
try {
    node $tsx $script $mode
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
