#Requires -Version 7.0
<#
.SYNOPSIS
    Registers (or checks, or removes) the Scheduled Task that runs the
    Windows-side test runner, so Claude can run e2e, lint, tsc, jest and
    Verify-Rebuild on this laptop whenever it needs a result. Slice Propus.2.

.DESCRIPTION
    Claude cannot run npm run e2e or npx jest from its side of the device bridge
    (no Windows binaries, no Playwright browsers, no route to localhost). The one
    channel it has is files in a connected folder. So Claude writes a request
    file into C:\dev\ga40prj\.test-runner\requests\, the runner started by this
    task runs the fixed sequence it names, and writes a result file Claude reads.
    The contract is scripts\test-runner\protocol.ts; the rule that tells Claude
    how to use it is in C:\dev\.claude\rules\sandbox-and-toolchain.md.

    Install (the default), in this order - any failure stops the install:
      1. Finds node and the repo's tsx.
      2. Runs the runner's self-test: the tools it calls exist, git answers,
         .env sets E2E_EMAIL and E2E_PASSWORD (names checked, values never read),
         port 3100 is free, pwsh answers. A red self-test registers nothing.
      3. Stops any runner already running and removes a previous registration.
      4. Registers "\ga40prj\Test runner": at logon of this user, runs
         Invoke-TestRunner.ps1 with no window, restarted a minute after it dies,
         re-checked every 15 minutes, no time limit, runs on battery. The window
         is suppressed with "conhost.exe --headless", falling back to
         pwsh -WindowStyle Hidden if that launcher does not come up.
      5. Starts it, waits for its heartbeat, and sends it a ping request.

    -Check reports whether the task is registered, whether the runner is alive
    (a fresh heartbeat AND an answered ping), and exits 0 only when it is.

    -Uninstall stops the runner (and any dev server it started) and removes
    the task. It leaves .test-runner\ and its results where they are.

.EXAMPLE
    pwsh -NoProfile -ExecutionPolicy Bypass -File C:\dev\ga40prj\scripts\Install-TestRunner.ps1
.EXAMPLE
    pwsh -NoProfile -ExecutionPolicy Bypass -File C:\dev\ga40prj\scripts\Install-TestRunner.ps1 -Check
.EXAMPLE
    pwsh -NoProfile -ExecutionPolicy Bypass -File C:\dev\ga40prj\scripts\Install-TestRunner.ps1 -Uninstall
#>
[CmdletBinding(DefaultParameterSetName = 'Install')]
param(
    [Parameter(ParameterSetName = 'Check')]     [switch] $Check,
    [Parameter(ParameterSetName = 'Uninstall')] [switch] $Uninstall
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true   # no-op before 7.4; turned off around every call whose exit code is a result

if (-not $IsWindows) { throw 'Install-TestRunner.ps1 registers a Windows Scheduled Task; run it on Windows.' }

$TaskPath   = '\ga40prj\'
$TaskName   = 'Test runner'
$Repo       = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$Wrapper    = Join-Path $PSScriptRoot 'Invoke-TestRunner.ps1'
$RunnerTs   = Join-Path $PSScriptRoot 'test-runner\runner.ts'
$Tsx        = Join-Path $Repo 'node_modules\tsx\dist\cli.mjs'
$Channel    = Join-Path $Repo '.test-runner'
$Requests   = Join-Path $Channel 'requests'
$Results    = Join-Path $Channel 'results'
$Heartbeat  = Join-Path $Channel 'heartbeat.json'
$RunnerLog  = Join-Path $Channel 'runner.log'
$ConsoleLog = Join-Path $Channel 'runner.console.log'
$Pwsh       = (Get-Process -Id $PID).Path                # the pwsh.exe running this - PowerShell 7 by construction
$Conhost    = Join-Path $env:SystemRoot 'System32\conhost.exe'
$StaleAfter = 30                                         # seconds; the runner beats every 5

function Get-RunnerProcesses {
    @(Get-CimInstance Win32_Process -Filter "Name = 'pwsh.exe' OR Name = 'node.exe'" |
        Where-Object {
            $_.ProcessId -ne $PID -and (
                $_.CommandLine -like '*Invoke-TestRunner.ps1*' -or
                $_.CommandLine -like '*test-runner*runner.ts*--watch*')
        })
}

function Stop-Runner {
    # taskkill /T takes the whole tree: the wrapper, the runner, and a next dev
    # or playwright it had started. Stop-Process would orphan those.
    foreach ($p in Get-RunnerProcesses) {
        if (Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue) {
            $PSNativeCommandUseErrorActionPreference = $false
            & taskkill.exe /PID $p.ProcessId /T /F *> $null
            $PSNativeCommandUseErrorActionPreference = $true
            Write-Host "  stopped $($p.Name) pid $($p.ProcessId) and its children"
        }
    }
    # A killed runner cannot release its lock; the next one would otherwise
    # have to prove the recorded pid dead, and Windows reuses pids.
    Remove-Item -LiteralPath (Join-Path $Channel 'runner.lock') -Force -ErrorAction SilentlyContinue
}

function Remove-RunnerTask {
    $t = Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($t) {
        Stop-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -Confirm:$false
        Write-Host "  removed the task $TaskPath$TaskName"
    }
}

function Register-RunnerTask([ValidateSet('headless', 'hidden')] [string] $Launcher) {
    $psArgs = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Wrapper`""
    $action = if ($Launcher -eq 'headless') {
        New-ScheduledTaskAction -Execute $Conhost -Argument "--headless `"$Pwsh`" $psArgs" -WorkingDirectory $Repo
    } else {
        New-ScheduledTaskAction -Execute $Pwsh -Argument $psArgs -WorkingDirectory $Repo
    }
    $user      = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $trigger   = New-ScheduledTaskTrigger -AtLogOn -User $user
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
    $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
        -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
    $desc = "Slice Propus.2. Runs the fixed test sequences Claude requests through $Channel. " +
            "Check: pwsh -NoProfile -File `"$PSCommandPath`" -Check. Remove: pwsh -NoProfile -File `"$PSCommandPath`" -Uninstall"

    # Re-check every 15 minutes: IgnoreNew makes it a no-op while the runner lives,
    # and a restart when it has died without a failure code the restart setting acts on.
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

# The heartbeat's age, in seconds, or $null when there is none. The age is
# read from the file's own write time, not from the beatAt inside it:
# ConvertFrom-Json turns an ISO string into a [datetime] whose Kind depends on
# the PowerShell version, and a Romanian-locale round trip through a string can
# swap day and month. The runner rewrites the file (write, then rename) every 5 s.
function Get-HeartbeatAge {
    if (-not (Test-Path -LiteralPath $Heartbeat)) { return $null }
    try {
        $written = (Get-Item -LiteralPath $Heartbeat).LastWriteTimeUtc
        $hb = Get-Content -LiteralPath $Heartbeat -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable
        [pscustomobject]@{
            Seconds  = [math]::Round(([datetime]::UtcNow - $written).TotalSeconds, 1)
            Pid      = $hb.pid
            BusyWith = $hb.busyWith
            Commit   = $hb.runnerCommit
        }
    } catch { $null }
}

function Wait-Heartbeat([datetime] $SinceUtc, [int] $Seconds = 40) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 1
        if (-not (Test-Path -LiteralPath $Heartbeat)) { continue }
        if ((Get-Item -LiteralPath $Heartbeat).LastWriteTimeUtc -lt $SinceUtc) { continue }
        $age = Get-HeartbeatAge
        if ($age -and $age.Seconds -lt $StaleAfter) { return $age }
    }
    $null
}

# A ping is an ordinary request for the sequence that runs nothing. Any result
# proves the runner is reading requests; a "refused: busy" is a live runner too.
function Invoke-Ping([int] $Seconds = 20) {
    $PSNativeCommandUseErrorActionPreference = $false
    $head = (& git -C $Repo rev-parse HEAD 2>$null)
    $PSNativeCommandUseErrorActionPreference = $true
    if ($LASTEXITCODE -ne 0 -or -not $head) { return [pscustomobject]@{ Ok = $false; Text = 'git rev-parse HEAD failed' } }
    $id  = 'ping-{0}-{1}' -f [datetime]::UtcNow.ToString('yyyyMMddTHHmmssZ'), (Get-Random -Maximum 100000)
    $req = [ordered]@{ version = 1; id = $id; sequence = 'ping'; commit = $head.Trim().ToLowerInvariant() } | ConvertTo-Json -Compress
    New-Item -ItemType Directory -Force -Path $Requests | Out-Null
    $tmp = Join-Path $Requests "$id.json.tmp"
    Set-Content -LiteralPath $tmp -Value $req -Encoding utf8NoBOM -NoNewline
    Move-Item -LiteralPath $tmp -Destination (Join-Path $Requests "$id.json") -Force
    $result = Join-Path $Results "$id.json"
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $Seconds) {
        Start-Sleep -Milliseconds 500
        if (Test-Path -LiteralPath $result) {
            try {
                $r = Get-Content -LiteralPath $result -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable
                $how = if ($r.status -eq 'refused') { "refused: $($r.refusal.code)" } else { $r.status }
                return [pscustomobject]@{ Ok = $true; Text = "answered in $([math]::Round($sw.Elapsed.TotalSeconds, 1)) s ($how)" }
            } catch { }   # caught mid-rename; the next poll reads it whole
        }
    }
    [pscustomobject]@{ Ok = $false; Text = "no answer in $Seconds s (request $id left in $Requests)" }
}

function Show-Tail([string] $Path, [int] $Lines = 8) {
    if (Test-Path -LiteralPath $Path) {
        Write-Host "  last lines of $Path :"
        Get-Content -LiteralPath $Path -Tail $Lines -Encoding utf8 | ForEach-Object { Write-Host "    $_" }
    }
}

# ---- check ---------------------------------------------------------------------------

if ($Check) {
    Write-Host "`nTest runner check"
    $task = Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $task) {
        Write-Host "  task      : NOT REGISTERED - install with: pwsh -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
        Write-Host "  verdict   : NOT INSTALLED`n"
        exit 1
    }
    $info = Get-ScheduledTaskInfo -TaskPath $TaskPath -TaskName $TaskName
    Write-Host "  task      : $TaskPath$TaskName - $($task.State) (last result 0x$('{0:X}' -f $info.LastTaskResult), last run $($info.LastRunTime))"
    $procs = Get-RunnerProcesses
    Write-Host "  processes : $(if ($procs) { ($procs | ForEach-Object { "$($_.Name) $($_.ProcessId)" }) -join ', ' } else { 'none' })"
    $age = Get-HeartbeatAge
    Write-Host "  heartbeat : $(if ($age) { "$($age.Seconds) s ago, pid $($age.Pid), runner code at $($age.Commit), busy with $(if ($age.BusyWith) { $age.BusyWith } else { '-' })" } else { 'none' })"
    $ping = Invoke-Ping
    Write-Host "  ping      : $($ping.Text)"
    $alive = $age -and $age.Seconds -lt $StaleAfter -and $ping.Ok
    Write-Host "  verdict   : $(if ($alive) { 'ALIVE' } else { 'DOWN' })"
    if (-not $alive) {
        Show-Tail $ConsoleLog
        Show-Tail $RunnerLog
        Write-Host "  restart   : Start-ScheduledTask -TaskPath '$TaskPath' -TaskName '$TaskName'"
    }
    Write-Host ''
    exit $(if ($alive) { 0 } else { 2 })
}

# ---- uninstall ------------------------------------------------------------------------

if ($Uninstall) {
    Write-Host "`nRemoving the test runner"
    Remove-RunnerTask
    Stop-Runner
    Write-Host "  done. $Channel is left as it is.`n"
    exit 0
}

# ---- install --------------------------------------------------------------------------

Write-Host "`n[1/5] node and tsx"
$Node = (Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $Node) { throw 'node is not on PATH. Install Node.js (the version this repo builds with) and re-run.' }
if (-not (Test-Path -LiteralPath $Tsx)) { throw "$Tsx is missing - run npm install in $Repo first." }
Write-Host "  node $((& $Node --version)) at $Node"

Write-Host "`n[2/5] self-test (tools, git, .env names, port 3100, pwsh)"
Push-Location -LiteralPath $Repo
try {
    $PSNativeCommandUseErrorActionPreference = $false
    & $Node $Tsx $RunnerTs --self-test --pwsh $Pwsh
    $selfTest = $LASTEXITCODE
    $PSNativeCommandUseErrorActionPreference = $true
} finally { Pop-Location }
if ($selfTest -ne 0) { throw "the self-test failed (exit $selfTest) - nothing was registered. Fix what it names and re-run." }

Write-Host "`n[3/5] clearing any previous install"
Remove-RunnerTask
Stop-Runner

Write-Host "`n[4/5] registering $TaskPath$TaskName"
$alive = $null
foreach ($launcher in 'headless', 'hidden') {
    Register-RunnerTask $launcher
    $since = [datetime]::UtcNow
    Start-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName
    Write-Host "  started with the '$launcher' launcher - waiting for the runner's heartbeat"
    $alive = Wait-Heartbeat $since
    if ($alive) { break }
    $info = Get-ScheduledTaskInfo -TaskPath $TaskPath -TaskName $TaskName
    Write-Host "  no heartbeat after 40 s with '$launcher' (last task result 0x$('{0:X}' -f $info.LastTaskResult))"
    Show-Tail $ConsoleLog
    Remove-RunnerTask
    Stop-Runner
}
if (-not $alive) {
    throw "The runner did not start with either launcher. Run it by hand to see why: pwsh -NoProfile -File `"$Wrapper`""
}

Write-Host "`n[5/5] ping"
$ping = Invoke-Ping
Write-Host "  $($ping.Text)"
if (-not $ping.Ok) { throw "The runner beats but did not answer a ping. Read $RunnerLog and $ConsoleLog." }
Write-Host ''
Write-Host "  task      : $TaskPath$TaskName (at logon, launcher '$launcher')"
Write-Host "  runner    : pid $($alive.Pid), code at $($alive.Commit), port 3100, build cache .next\runner"
Write-Host "  channel   : $Channel"
Write-Host "  check     : pwsh -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Check"
Write-Host "  uninstall : pwsh -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Uninstall"
Write-Host ''
