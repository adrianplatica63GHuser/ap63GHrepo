#Requires -Version 7.0
<#
.SYNOPSIS
    Runs the Windows-side test runner (scripts\test-runner\runner.ts) and
    restarts it when it asks. Slice Propus.2.

.DESCRIPTION
    Started at logon by the Scheduled Task "\ga40prj\Test runner", which
    Install-TestRunner.ps1 registers. Run it by hand only to watch it work:

      pwsh -NoProfile -File C:\dev\ga40prj\scripts\Invoke-TestRunner.ps1

    The runner exits 75 when its own source (runner.ts, protocol.ts) changed on
    disk while it was idle - a later slice edited it - and this wrapper starts
    the new code at once, so a change to the runner never waits for a logon.
    Any other exit ends the wrapper, and the task's restart settings take over.

    What the runner prints goes to .test-runner\runner.console.log, which is
    where a runner.ts that no longer compiles says so. The runner's own log of
    what it did is .test-runner\runner.log.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false   # node's exit code is read below, not thrown

$Repo       = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$Channel    = Join-Path $Repo '.test-runner'
$ConsoleLog = Join-Path $Channel 'runner.console.log'
$Tsx        = Join-Path $Repo 'node_modules\tsx\dist\cli.mjs'
$Runner     = Join-Path $Repo 'scripts\test-runner\runner.ts'
$Pwsh       = (Get-Process -Id $PID).Path            # PowerShell 7 by construction; Verify-Rebuild.ps1 needs it
$ReloadCode = 75

New-Item -ItemType Directory -Force -Path $Channel | Out-Null

function Write-Console([string] $Message) {
    Add-Content -LiteralPath $ConsoleLog -Encoding utf8NoBOM -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') wrapper: $Message"
}

try {
    $Node = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
} catch {
    Write-Console "node is not on PATH for this logon session - the runner cannot start ($($_.Exception.Message))"
    exit 1
}
if (-not (Test-Path -LiteralPath $Tsx)) {
    Write-Console "$Tsx is missing - run npm install in $Repo"
    exit 1
}

Set-Location -LiteralPath $Repo
while ($true) {
    Write-Console "starting $Node $Runner --watch (wrapper pid $PID)"
    & $Node $Tsx $Runner --watch --pwsh $Pwsh *>> $ConsoleLog
    $code = $LASTEXITCODE
    if ($code -ne $ReloadCode) {
        Write-Console "runner exited $code - leaving it to the task's restart settings"
        exit $code
    }
    Write-Console 'runner asked to reload its changed source - restarting'
}
