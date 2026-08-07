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

# Deliberately 5.1-compatible and ASCII-only: this script may be the thing that
# deploys the rules, so it must run under whatever shell is available. No PS7 syntax.

$RepoRoot   = Split-Path -Parent $PSScriptRoot
$SourceRoot = Join-Path $RepoRoot 'docs\claude\shared'
$DeployRoot = Split-Path -Parent $RepoRoot      # C:\dev

# source (in repo)                 -> deployed (above repo)
$Pairs = @(
    @{ Src = 'CLAUDE.md'                             ; Dst = 'CLAUDE.md' },
    @{ Src = 'rules\sandbox-and-toolchain.md'        ; Dst = '.claude\rules\sandbox-and-toolchain.md' },
    @{ Src = 'rules\powershell-and-windows.md'       ; Dst = '.claude\rules\powershell-and-windows.md' },
    @{ Src = 'rules\git-and-commits.md'              ; Dst = '.claude\rules\git-and-commits.md' },
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
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    # Hash the NORMALISED text, not the raw bytes: the writer below strips any BOM,
    # so a raw-byte compare would report permanent drift on a BOM'd source.
    $text  = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path))
    $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($text)
    $sha   = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '')
    } finally {
        $sha.Dispose()
    }
}

$drift   = 0
$written = 0
$missing = 0

foreach ($pair in $Pairs) {
    $src = Join-Path $SourceRoot $pair.Src
    $dst = Join-Path $DeployRoot $pair.Dst

    # -Pull reverses which side is authoritative
    if ($Pull) { $from = $dst; $to = $src } else { $from = $src; $to = $dst }

    if (-not (Test-Path -LiteralPath $from -PathType Leaf)) {
        Write-Host ("  MISSING  {0}" -f $from) -ForegroundColor Red
        $drift++
        $missing++
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

    $written++
    $verb = if ($Pull) { 'pulled' } else { 'wrote' }
    Write-Host ("  {0,-8} {1}" -f $verb, $pair.Dst) -ForegroundColor Green
}

Write-Host ''

if ($Check) {
    if ($drift -eq 0) {
        Write-Host '  In sync.' -ForegroundColor Green
        exit 0
    }
    $outOfSync = $drift - $missing
    if ($outOfSync -gt 0) {
        Write-Host ("  {0} file(s) out of sync. Run without -Check to deploy." -f $outOfSync) -ForegroundColor Yellow
    }
    if ($missing -gt 0) {
        Write-Host ("  {0} file(s) MISSING at the source and cannot be deployed." -f $missing) -ForegroundColor Red
    }
    exit 1
}

if ($Pull) {
    if ($written -gt 0) {
        Write-Host ("  Pulled {0} file(s) into the repo. Review with: git diff docs/claude/shared" -f $written) -ForegroundColor Cyan
    } elseif ($missing -eq 0) {
        Write-Host '  Nothing to pull - already in sync.' -ForegroundColor Green
    }
    if ($missing -gt 0) {
        Write-Host ("  {0} deployed file(s) MISSING - not pulled." -f $missing) -ForegroundColor Red
        Write-Host ''
        exit 1
    }
} elseif ($drift -eq 0) {
    Write-Host '  Nothing to do - already in sync.' -ForegroundColor Green
} else {
    if ($written -gt 0) {
        Write-Host ("  Deployed {0} file(s) to {1}." -f $written, $DeployRoot) -ForegroundColor Green
    }
    if ($missing -gt 0) {
        Write-Host ("  {0} source file(s) MISSING - not deployed." -f $missing) -ForegroundColor Red
        Write-Host ''
        exit 1
    }
}

Write-Host ''
