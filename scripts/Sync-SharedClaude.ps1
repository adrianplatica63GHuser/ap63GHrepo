<#
.SYNOPSIS
    Deploys the shared Claude instruction tier from this repo to C:\dev.

.DESCRIPTION
    C:\dev\CLAUDE.md and C:\dev\.claude\rules\ have to live ABOVE the repo so that
    every app under C:\dev inherits them. That puts them outside git's reach, so the
    versioned source of truth is docs\claude\shared\ inside this repo, and C:\dev is
    a deployed copy.

    Edit docs\claude\shared\, commit, then run this script to deploy.

.PARAMETER Check
    Compare only. Reports drift and exits non-zero if the deployed copy differs.
    Nothing is written.

.PARAMETER Pull
    Reverse direction: copy C:\dev back INTO the repo. Use this if you edited the
    deployed copy by mistake and want to keep those edits. Review with git diff after.

.EXAMPLE
    .\scripts\Sync-SharedClaude.ps1
    .\scripts\Sync-SharedClaude.ps1 -Check
    .\scripts\Sync-SharedClaude.ps1 -Pull
#>
[CmdletBinding(DefaultParameterSetName = 'Push')]
param(
    [Parameter(ParameterSetName = 'Check')] [switch] $Check,
    [Parameter(ParameterSetName = 'Pull')]  [switch] $Pull
)

$ErrorActionPreference = 'Stop'

$RepoRoot   = Split-Path -Parent $PSScriptRoot
$SourceRoot = Join-Path $RepoRoot 'docs\claude\shared'
$DeployRoot = Split-Path -Parent $RepoRoot      # C:\dev

# source (in repo)                 -> deployed (above repo)
$Pairs = @(
    @{ Src = 'CLAUDE.md'                             ; Dst = 'CLAUDE.md' },
    @{ Src = 'rules\sandbox-and-toolchain.md'        ; Dst = '.claude\rules\sandbox-and-toolchain.md' },
    @{ Src = 'rules\powershell-and-windows.md'       ; Dst = '.claude\rules\powershell-and-windows.md' },
    @{ Src = 'rules\shared-database.md'              ; Dst = '.claude\rules\shared-database.md' }
)

if (-not (Test-Path $SourceRoot)) {
    throw "Source not found: $SourceRoot"
}

Write-Host ''
Write-Host "  repo source : $SourceRoot"
Write-Host "  deployed to : $DeployRoot"
Write-Host ''

function Get-FileHashOrNull([string] $Path) {
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    }
    return $null
}

$drift = 0

foreach ($pair in $Pairs) {
    $src = Join-Path $SourceRoot $pair.Src
    $dst = Join-Path $DeployRoot $pair.Dst

    # -Pull reverses which side is authoritative
    if ($Pull) { $from = $dst; $to = $src } else { $from = $src; $to = $dst }

    if (-not (Test-Path -LiteralPath $from -PathType Leaf)) {
        Write-Host ("  MISSING  {0}" -f $from) -ForegroundColor Red
        $drift++
        continue
    }

    $hFrom = Get-FileHashOrNull $from
    $hTo   = Get-FileHashOrNull $to

    if ($hFrom -eq $hTo) {
        Write-Host ("  same     {0}" -f $pair.Dst) -ForegroundColor DarkGray
        continue
    }

    $drift++

    if ($Check) {
        $state = if ($null -eq $hTo) { 'NOT DEPLOYED' } else { 'DIFFERS' }
        Write-Host ("  {0,-12} {1}" -f $state, $pair.Dst) -ForegroundColor Yellow
        continue
    }

    $toDir = Split-Path -Parent $to
    if (-not (Test-Path -LiteralPath $toDir)) {
        New-Item -ItemType Directory -Path $toDir -Force | Out-Null
    }

    # Read/write as raw UTF-8 without BOM so LF endings survive the round trip.
    $text = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $from))
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($to, $text, $utf8NoBom)

    $verb = if ($Pull) { 'pulled' } else { 'wrote' }
    Write-Host ("  {0,-8} {1}" -f $verb, $pair.Dst) -ForegroundColor Green
}

Write-Host ''

if ($Check) {
    if ($drift -eq 0) {
        Write-Host '  In sync.' -ForegroundColor Green
        exit 0
    }
    Write-Host ("  {0} file(s) out of sync. Run without -Check to deploy." -f $drift) -ForegroundColor Yellow
    exit 1
}

if ($Pull) {
    Write-Host '  Pulled into the repo. Review with: git diff docs/claude/shared' -ForegroundColor Cyan
} elseif ($drift -eq 0) {
    Write-Host '  Nothing to do - already in sync.' -ForegroundColor Green
} else {
    Write-Host ("  Deployed {0} file(s) to {1}." -f $drift, $DeployRoot) -ForegroundColor Green
}

Write-Host ''
