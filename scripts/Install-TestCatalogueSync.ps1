#Requires -Version 7.0
<#
.SYNOPSIS
    Registers (or re-registers, or removes) the Scheduled Task that keeps
    C:\dev.docs\Test.Catalogue.xlsx in step with docs\testing\TEST-CATALOGUE.md. Slice #36.09.

.DESCRIPTION
    Install (the default), in this order - any failure stops the install:
      1. Installs the ImportExcel module for the current user if it is missing (PSGallery).
         Its bundled EPPlus is what Sync-TestCatalogue.ps1 writes the workbook with.
      2. Runs Sync-TestCatalogue.ps1 -SelfTest: the parser against the real catalogue and
         the fixture, then a write round-trip into a temp copy of the workbook. A red
         self-test means no task is registered.
      3. Stops any watcher already running and removes a previous registration.
      4. Registers "\ga40prj\Test catalogue to Excel": at logon of this user, runs
         Sync-TestCatalogue.ps1 -Watch with no window, restarted a minute after it dies,
         re-checked every 15 minutes (a live watcher makes that a no-op), no time limit,
         runs on battery.
      5. Starts it now and waits for the watcher's "started" line in the log. The window
         is suppressed with "conhost.exe --headless" (pwsh's own -WindowStyle Hidden is
         not honoured when Windows Terminal is the default terminal); if that launcher
         does not come up, it falls back to pwsh -WindowStyle Hidden and says so.

    -Uninstall stops the watcher and removes the task. It leaves ImportExcel, the workbook
    and the log where they are.

.EXAMPLE
    pwsh -NoProfile -ExecutionPolicy Bypass -File C:\dev\ga40prj\scripts\Install-TestCatalogueSync.ps1
.EXAMPLE
    pwsh -NoProfile -ExecutionPolicy Bypass -File C:\dev\ga40prj\scripts\Install-TestCatalogueSync.ps1 -Uninstall
#>
[CmdletBinding()]
param(
    [switch] $Uninstall
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true   # no-op before 7.4

if (-not $IsWindows) { throw 'Install-TestCatalogueSync.ps1 registers a Windows Scheduled Task; run it on Windows.' }

$TaskPath   = '\ga40prj\'
$TaskName   = 'Test catalogue to Excel'
$SyncScript = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'Sync-TestCatalogue.ps1'))
$Workbook   = 'C:\dev.docs\Test.Catalogue.xlsx'
$LogPath    = 'C:\dev.docs\Test.Catalogue.sync.log'     # Sync-TestCatalogue.ps1's default: beside the workbook
$Pwsh       = (Get-Process -Id $PID).Path                # the pwsh.exe running this - PowerShell 7 by construction
$Conhost    = Join-Path $env:SystemRoot 'System32\conhost.exe'

function Get-Watchers {
    @(Get-CimInstance Win32_Process -Filter "Name = 'pwsh.exe'" |
        Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like '*Sync-TestCatalogue.ps1*-Watch*' })
}

function Stop-Watchers {
    foreach ($p in Get-Watchers) {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "  stopped the running watcher (pid $($p.ProcessId))"
    }
}

function Remove-SyncTask {
    $t = Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($t) {
        Stop-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -Confirm:$false
        Write-Host "  removed the task $TaskPath$TaskName"
    }
}

function Register-SyncTask([ValidateSet('headless', 'hidden')] [string] $Launcher) {
    $psArgs = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$SyncScript`" -Watch"
    $action = if ($Launcher -eq 'headless') {
        New-ScheduledTaskAction -Execute $Conhost -Argument "--headless `"$Pwsh`" $psArgs" -WorkingDirectory $PSScriptRoot
    } else {
        New-ScheduledTaskAction -Execute $Pwsh -Argument $psArgs -WorkingDirectory $PSScriptRoot
    }
    $user      = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $trigger   = New-ScheduledTaskTrigger -AtLogOn -User $user
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
    $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
        -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
    $desc = "Slice #36.09. Rewrites $Workbook from the table in $((Split-Path -Parent $PSScriptRoot))\docs\testing\TEST-CATALOGUE.md " +
            "whenever it changes. Log: $LogPath. Remove with: pwsh -NoProfile -File `"$PSCommandPath`" -Uninstall"

    # Re-check every 15 minutes: IgnoreNew makes it a no-op while the watcher runs, and a
    # restart when it has died without a failure code the restart setting would act on.
    $withRepeat = New-ScheduledTaskTrigger -AtLogOn -User $user
    $withRepeat.Repetition = (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15)).Repetition
    try {
        Register-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -Action $action -Trigger $withRepeat `
            -Principal $principal -Settings $settings -Description $desc -Force | Out-Null
    } catch {
        Write-Host "  (the 15-minute re-check was refused: $($_.Exception.Message) - registering without it)"
        Register-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -Action $action -Trigger $trigger `
            -Principal $principal -Settings $settings -Description $desc -Force | Out-Null
    }
}

function Wait-WatcherStarted([datetime] $Since, [int] $Seconds = 25) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 1
        if (-not (Test-Path -LiteralPath $LogPath)) { continue }
        $hit = Get-Content -LiteralPath $LogPath -Tail 40 -Encoding utf8 | Where-Object {
            $_ -match '^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+started\s' -and
            [datetime]::ParseExact($Matches[1], 'yyyy-MM-dd HH:mm:ss', [Globalization.CultureInfo]::InvariantCulture) -ge $Since.AddSeconds(-1)
        } | Select-Object -Last 1
        if ($hit -and (Get-Watchers).Count -gt 0) { return $hit }
    }
    $null
}

# ---- uninstall ------------------------------------------------------------------------

if ($Uninstall) {
    Write-Host "`nRemoving the test catalogue sync"
    Remove-SyncTask
    Stop-Watchers
    Write-Host "  done. ImportExcel, $Workbook and $LogPath are left as they are.`n"
    exit 0
}

# ---- install --------------------------------------------------------------------------

Write-Host "`n[1/5] ImportExcel"
$have = Get-Module -ListAvailable -Name ImportExcel | Sort-Object Version -Descending | Select-Object -First 1
if (-not $have) {
    Write-Host '  not installed - installing for the current user from PSGallery'
    if (Get-Command Install-PSResource -ErrorAction SilentlyContinue) {
        Install-PSResource -Name ImportExcel -Scope CurrentUser -TrustRepository -Quiet
    } else {
        Install-Module -Name ImportExcel -Scope CurrentUser -Force -AllowClobber
    }
    $have = Get-Module -ListAvailable -Name ImportExcel | Sort-Object Version -Descending | Select-Object -First 1
    if (-not $have) { throw 'ImportExcel did not install - see the error above.' }
}
Write-Host "  ImportExcel $($have.Version) at $($have.ModuleBase)"

Write-Host "`n[2/5] self-test (parser + a round-trip on a temp copy of the workbook)"
& $Pwsh -NoProfile -ExecutionPolicy Bypass -File $SyncScript -SelfTest
if ($LASTEXITCODE -ne 0) { throw "the self-test failed (exit $LASTEXITCODE) - nothing was registered" }

Write-Host "`n[3/5] clearing any previous install"
Remove-SyncTask
Stop-Watchers

Write-Host "`n[4/5] registering $TaskPath$TaskName"
$started = $null
foreach ($launcher in 'headless', 'hidden') {
    Register-SyncTask $launcher
    $since = Get-Date
    Start-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName
    Write-Host "  started with the '$launcher' launcher - waiting for the watcher's first log line"
    $started = Wait-WatcherStarted $since
    if ($started) { break }
    $info = Get-ScheduledTaskInfo -TaskPath $TaskPath -TaskName $TaskName
    Write-Host "  no watcher after 25 s with '$launcher' (last task result 0x$('{0:X}' -f $info.LastTaskResult))"
    Remove-SyncTask
    Stop-Watchers
}
if (-not $started) {
    throw "The watcher did not start with either launcher. Run it by hand to see why: pwsh -NoProfile -File `"$SyncScript`" -Watch"
}

Write-Host "`n[5/5] running"
Write-Host "  $started"
$first = $null
$deadline = (Get-Date).AddSeconds(15)       # the start-up sync: EPPlus load, plus up to 5 s if Excel holds the file
while (-not $first -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $first = Get-Content -LiteralPath $LogPath -Tail 10 -Encoding utf8 |
        Where-Object { $_ -match '^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s+(written|unchanged|deferred|error)\s+trigger=startup' -and
            [datetime]::ParseExact($Matches[1], 'yyyy-MM-dd HH:mm:ss', [Globalization.CultureInfo]::InvariantCulture) -ge $since.AddSeconds(-1) } |
        Select-Object -Last 1
}
Write-Host $(if ($first) { "  $first" } else { '  (the start-up sync has not logged yet - read the log in a minute)' })
Write-Host ''
Write-Host "  task      : $TaskPath$TaskName (at logon, launcher '$launcher')"
Write-Host "  workbook  : $Workbook"
Write-Host "  log       : $LogPath"
Write-Host "  uninstall : pwsh -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Uninstall"
Write-Host ''
