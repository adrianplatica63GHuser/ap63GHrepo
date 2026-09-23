#Requires -Version 7.0
<#
.SYNOPSIS
    Regenerates C:\dev.docs\Test.Catalogue.xlsx from the table under "## The catalogue"
    in docs\testing\TEST-CATALOGUE.md. Slice #36.09.

.DESCRIPTION
    The markdown is the source; the workbook is a generated view of its table.

    READ   The section is found by its heading text "## The catalogue", never by line
           number. Below it: the header row, the |---| separator, then data rows up to
           the FIRST line that is not a table row. The prose after the table is not read.
    MAP    Columns are matched by header NAME in both files (the workbook's header cells
           are trimmed first), never by position - so the workbook's own column order
           wins and survives a reorder. A header present in only one file is logged by
           name. Workbook columns with no markdown twin are left untouched.
    CLEAN  [TC-X](cases/TC-X.md) -> the text TC-X, hyperlinked to the absolute path of
           the case file. Backticks, bold and escapes are stripped. An em dash (U+2014)
           or an empty cell -> a blank cell. yyyy-mm-dd -> a real Excel date.
    WRITE  Every data row below the header is rewritten on every write, so a row removed
           from the markdown leaves no ghost. The header row, column widths, row heights,
           sheet name, freeze panes and filters are kept, because the existing workbook
           is opened and edited rather than regenerated. A note on the header says the
           sheet is generated.
    IDEM   The target is compared cell by cell before anything is written; an unchanged
           table opens the file, finds nothing to do, and writes nothing (the file's
           LastWriteTime does not move).
    LOCK   Excel holding the file open is the normal case. The workbook is opened with
           an exclusive handle (read, compare and write all happen under it); if that
           fails for 5 x 1 s the run is DEFERRED, logged, and retried on every poll
           until it goes through - it is never dropped.
    LOG    Every run writes one line to the log (default: beside the workbook,
           Test.Catalogue.sync.log): written | unchanged | deferred | error.

    Modes:
      (default)   one sync, then exit. Exit code 0 written/unchanged, 3 deferred, 1 error.
      -Watch      the long-running loop the Scheduled Task starts (see
                  Install-TestCatalogueSync.ps1): one sync at start, then a folder
                  watcher (Changed/Created/Deleted/Renamed, debounced) backed by a poll
                  of the markdown's SHA-256 every -PollSeconds. The log's trigger= field
                  says which of the two caught each change.
      -ParseOnly  print the parsed rows as JSON and exit. Needs no xlsx library.
      -SelfTest   the parser check (real catalogue + fixture) and, when ImportExcel is
                  installed, a write round-trip into a TEMP COPY of the workbook.

    xlsx library: ImportExcel's bundled EPPlus, used directly. Works with Excel closed or
    not installed, needs no per-change step, adds no npm dependency. The installer
    installs the module.

.EXAMPLE
    pwsh -NoProfile -File C:\dev\ga40prj\scripts\Sync-TestCatalogue.ps1
.EXAMPLE
    pwsh -NoProfile -File C:\dev\ga40prj\scripts\Sync-TestCatalogue.ps1 -SelfTest
#>
[CmdletBinding(DefaultParameterSetName = 'Once')]
param(
    [string] $MarkdownPath,
    [string] $WorkbookPath = 'C:\dev.docs\Test.Catalogue.xlsx',
    [string] $SheetName = 'Test.Catalogue',
    [string] $LogPath,

    [Parameter(ParameterSetName = 'Watch')] [switch] $Watch,
    [Parameter(ParameterSetName = 'Watch')] [ValidateRange(2, 3600)] [int] $PollSeconds = 10,
    [Parameter(ParameterSetName = 'Watch')] [ValidateRange(100, 60000)] [int] $DebounceMilliseconds = 2000,

    [Parameter(ParameterSetName = 'ParseOnly')] [switch] $ParseOnly,
    [Parameter(ParameterSetName = 'SelfTest')] [switch] $SelfTest
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true   # no-op before 7.4

# ---- paths ------------------------------------------------------------------------------

if (-not $MarkdownPath) {
    $MarkdownPath = Join-Path $PSScriptRoot '..' 'docs' 'testing' 'TEST-CATALOGUE.md'
}
# Absolute before any raw [System.IO.File] call (powershell-and-windows.md).
$MarkdownPath = [IO.Path]::GetFullPath($MarkdownPath)
$WorkbookPath = [IO.Path]::GetFullPath($WorkbookPath)
if (-not $LogPath) {
    $LogPath = Join-Path ([IO.Path]::GetDirectoryName($WorkbookPath)) (
        [IO.Path]::GetFileNameWithoutExtension($WorkbookPath) + '.sync.log')
}
$LogPath = [IO.Path]::GetFullPath($LogPath)

$script:Utf8NoBom   = [Text.UTF8Encoding]::new($false)
$script:Heading     = '## The catalogue'
$script:EmptyMarks  = @('', [string][char]0x2014)              # "" and the em dash
$script:SeparatorRe = '^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$'
$script:DateRe      = '^\d{4}-\d{2}-\d{2}$'
$script:NoteAuthor  = 'Sync-TestCatalogue'

function Get-NoteText([string] $MdPath) {
    "GENERATED VIEW - do not edit the rows below.`n" +
    "Every row under this header is rewritten from $MdPath (the table under " +
    "'$script:Heading') by scripts\Sync-TestCatalogue.ps1 whenever that file changes. " +
    "A value typed here is overwritten at the next change: edit the markdown instead. " +
    "The header row, column widths, freeze panes and filters are yours and are kept."
}

# ---- logging ----------------------------------------------------------------------------

function Write-SyncLog {
    param([string] $Status, [string] $Trigger, [string] $Detail)
    $line = '{0:yyyy-MM-dd HH:mm:ss}  {1,-9}  trigger={2,-14} {3}' -f (Get-Date), $Status, $Trigger, $Detail
    Write-Host $line
    try {
        $dir = [IO.Path]::GetDirectoryName($LogPath)
        if (-not [IO.Directory]::Exists($dir)) { [void][IO.Directory]::CreateDirectory($dir) }
        $fi = [IO.FileInfo]::new($LogPath)
        if ($fi.Exists -and $fi.Length -gt 1MB) {
            [IO.File]::Copy($LogPath, "$LogPath.1", $true)
            [IO.File]::WriteAllText($LogPath, '', $script:Utf8NoBom)
        }
        [IO.File]::AppendAllText($LogPath, $line + "`r`n", $script:Utf8NoBom)
    } catch {
        Write-Warning "could not write the log at ${LogPath}: $($_.Exception.Message)"
    }
}

# ---- markdown -> rows -------------------------------------------------------------------

function Split-MdRow([string] $Line) {
    $s = $Line.Trim()
    if ($s.StartsWith('|')) { $s = $s.Substring(1) }
    if ($s.EndsWith('|') -and -not $s.EndsWith('\|')) { $s = $s.Substring(0, $s.Length - 1) }
    # GFM: an unescaped pipe always splits, even inside a code span; \| is a literal pipe.
    foreach ($part in [regex]::Split($s, '(?<!\\)\|')) { $part.Replace('\|', '|').Trim() }
}

function ConvertFrom-MdText([string] $s) {
    # Plain (non-code) text: hide backslash escapes, strip links/emphasis/<br>, restore.
    $s = [regex]::Replace($s, '\\([!-/:-@\[-`{-~])', { param($m) [string][char](0xE000 + [int][char]$m.Groups[1].Value) })
    $s = [regex]::Replace($s, '!?\[([^\]]*)\]\([^)]*\)', '$1')
    $s = [regex]::Replace($s, '\*\*(.+?)\*\*', '$1')
    $s = [regex]::Replace($s, '__(.+?)__', '$1')
    $s = [regex]::Replace($s, '(?<![\*\w])\*(?=\S)(.+?)(?<=\S)\*(?![\*\w])', '$1')
    $s = [regex]::Replace($s, '<br\s*/?>', "`n", 'IgnoreCase')
    $s = [Net.WebUtility]::HtmlDecode($s)
    [regex]::Replace($s, '[\uE000-\uE07F]', { param($m) [string][char]([int][char]$m.Value - 0xE000) })
}

function ConvertFrom-MdInline([string] $s) {
    $s = $s.Trim()
    $link = $null
    $m = [regex]::Match($s, '^\[(?<t>(?:[^\[\]\\]|\\.)*)\]\((?<u>[^\s()]+)(?:\s+"[^"]*")?\)$')
    if ($m.Success) { $link = $m.Groups['u'].Value; $s = $m.Groups['t'].Value }
    $sb = [Text.StringBuilder]::new()
    $pos = 0
    foreach ($cm in [regex]::Matches($s, '(?<ticks>`+)(?<code>.+?)\k<ticks>')) {
        [void]$sb.Append((ConvertFrom-MdText $s.Substring($pos, $cm.Index - $pos)))
        [void]$sb.Append($cm.Groups['code'].Value.Trim())     # code span: verbatim, ticks gone
        $pos = $cm.Index + $cm.Length
    }
    [void]$sb.Append((ConvertFrom-MdText $s.Substring($pos)))
    [pscustomobject]@{ Text = $sb.ToString().Trim(); Link = $link }
}

function Resolve-MdLink([string] $Link, [string] $BaseDir) {
    if (-not $Link -or $Link.StartsWith('#')) { return $null }
    if ($Link -match '^[a-zA-Z][a-zA-Z0-9+.-]+:') { return $Link }       # http:, mailto:, ...
    $rel = [Uri]::UnescapeDataString(($Link -split '#', 2)[0])
    $rel = $rel.Replace('/', [IO.Path]::DirectorySeparatorChar).Replace('\', [IO.Path]::DirectorySeparatorChar)
    [IO.Path]::GetFullPath([IO.Path]::Combine($BaseDir, $rel))
}

function ConvertFrom-MdCell([string] $Raw, [string] $BaseDir) {
    $r = ConvertFrom-MdInline $Raw
    $text = $r.Text
    $value = $null
    if ($script:EmptyMarks -contains $text) {
        $text = ''
    } elseif ($text -match $script:DateRe) {
        $d = [datetime]::MinValue
        if ([datetime]::TryParseExact($text, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture,
                [Globalization.DateTimeStyles]::None, [ref]$d)) { $value = $d } else { $value = $text }
    } else {
        $value = $text
    }
    [pscustomobject]@{ Text = $text; Value = $value; Link = (Resolve-MdLink $r.Link $BaseDir) }
}

function Read-Catalogue([string] $Path) {
    $text  = [IO.File]::ReadAllText($Path, $script:Utf8NoBom)       # UTF-8 explicitly: never the ANSI/OEM code page
    $lines = $text -split "`r?`n"
    $baseDir = [IO.Path]::GetDirectoryName($Path)

    $h = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i].TrimEnd() -ceq $script:Heading) { $h = $i; break }
    }
    if ($h -lt 0) { throw "heading '$script:Heading' not found in $Path" }

    $i = $h + 1
    while ($i -lt $lines.Count -and $lines[$i].Trim() -eq '') { $i++ }
    if ($i -ge $lines.Count -or -not $lines[$i].TrimStart().StartsWith('|')) {
        throw "no table directly under '$script:Heading' (line $($h + 1))"
    }
    $headers = @(Split-MdRow $lines[$i] | ForEach-Object { (ConvertFrom-MdInline $_).Text })
    $i++
    if ($i -ge $lines.Count -or $lines[$i].Trim() -notmatch $script:SeparatorRe) {
        throw "the table under '$script:Heading' has no |---| separator on line $($i + 1)"
    }
    $i++

    $warnings = [Collections.Generic.List[string]]::new()
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($hd in $headers) { if (-not $seen.Add($hd)) { $warnings.Add("duplicate markdown header '$hd'") } }

    $rows = [Collections.Generic.List[object]]::new()
    while ($i -lt $lines.Count -and $lines[$i].TrimStart().StartsWith('|')) {
        $cells = @(Split-MdRow $lines[$i])
        if ($cells.Count -ne $headers.Count) {
            $warnings.Add("line $($i + 1) has $($cells.Count) cells, the header has $($headers.Count)")
        }
        $row = [ordered]@{}
        for ($c = 0; $c -lt $headers.Count; $c++) {
            if ($row.Contains($headers[$c])) { continue }
            $raw = if ($c -lt $cells.Count) { $cells[$c] } else { '' }
            $row[$headers[$c]] = ConvertFrom-MdCell $raw $baseDir
        }
        $rows.Add([pscustomobject]@{ Line = $i + 1; Cells = $row })
        $i++
    }
    [pscustomobject]@{
        Path = $Path; Headers = $headers; Rows = $rows; Warnings = $warnings
        HeadingLine = $h + 1; FirstLineAfterTable = $i + 1
    }
}

function Get-FileSha256([string] $Path) {
    [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([IO.File]::ReadAllBytes($Path)))
}

# ---- rows -> workbook -------------------------------------------------------------------

function Import-Epplus {
    if ('OfficeOpenXml.ExcelPackage' -as [type]) { return }
    if (-not (Get-Module -ListAvailable -Name ImportExcel)) {
        throw 'the ImportExcel module is not installed - run scripts\Install-TestCatalogueSync.ps1, which installs it'
    }
    Import-Module ImportExcel -WarningAction SilentlyContinue -ErrorAction Stop
}

function Get-LinkUri([string] $Target) {
    if ($Target -match '^[a-zA-Z][a-zA-Z0-9+.-]+://' -or $Target -match '^mailto:') { return [Uri]::new($Target) }
    # A local path becomes an escaped file:/// URI (spaces and diacritics are legal in it).
    [Uri]::new([Uri]::new($Target).AbsoluteUri)
}

function Test-DateFormat($Cell) {
    $id = $Cell.Style.Numberformat.NumFmtID
    $f  = [string]$Cell.Style.Numberformat.Format
    ($id -ge 14 -and $id -le 22) -or (($f -replace '"[^"]*"', '') -match 'y' -and ($f -replace '"[^"]*"', '') -match 'd')
}

function Test-CellMatches($Cell, $Want) {
    $v = $Cell.Value
    if ($null -eq $Want -or $null -eq $Want.Value) {
        if ($null -ne $v -and [string]$v -ne '') { return $false }
    } elseif ($Want.Value -is [datetime]) {
        $d = if ($v -is [double]) { [datetime]::FromOADate($v) } elseif ($v -is [datetime]) { $v } else { return $false }
        if ($d.Date -ne $Want.Value.Date -or -not (Test-DateFormat $Cell)) { return $false }
    } else {
        if ($v -isnot [string] -or $v -cne $Want.Value) { return $false }
    }
    $have = if ($Cell.Hyperlink) { $Cell.Hyperlink.OriginalString } else { '' }
    $need = if ($Want -and $Want.Link) { (Get-LinkUri $Want.Link).OriginalString } else { '' }
    $have -ceq $need
}

function Find-HeaderRow($Ws, [string[]] $MdHeaders) {
    if (-not $Ws.Dimension) { return 0 }
    $want = [Collections.Generic.HashSet[string]]::new([string[]]$MdHeaders, [StringComparer]::OrdinalIgnoreCase)
    $best = 0; $bestRow = 0
    for ($r = 1; $r -le [Math]::Min($Ws.Dimension.End.Row, 20); $r++) {
        $n = 0
        for ($c = 1; $c -le $Ws.Dimension.End.Column; $c++) {
            if ($want.Contains(([string]$Ws.Cells[$r, $c].Value).Trim())) { $n++ }
        }
        if ($n -gt $best) { $best = $n; $bestRow = $r }
    }
    if ($best -ge 2) { $bestRow } else { 0 }
}

function New-CatalogueWorkbook([string] $Path, [string] $Sheet, [string[]] $Headers) {
    $pkg = [OfficeOpenXml.ExcelPackage]::new()
    try {
        $ws = $pkg.Workbook.Worksheets.Add($Sheet)
        $c = 2
        foreach ($h in $Headers) { $ws.Cells[1, $c].Value = $h; $ws.Cells[1, $c].Style.Font.Bold = $true; $c++ }
        [IO.File]::WriteAllBytes($Path, $pkg.GetAsByteArray())
    } finally { $pkg.Dispose() }
}

function Sync-Workbook {
    <# Returns Status (written | unchanged | deferred | error), Detail, and the header report. #>
    param($Catalogue, [string] $Path, [string] $Sheet, [int] $LockAttempts = 5)
    Import-Epplus
    $created = $false
    if (-not [IO.File]::Exists($Path)) {
        New-CatalogueWorkbook $Path $Sheet $Catalogue.Headers
        $created = $true
    }

    $fs = $null
    for ($a = 1; $a -le $LockAttempts; $a++) {
        try { $fs = [IO.File]::Open($Path, 'Open', 'ReadWrite', 'None'); break }
        catch [IO.IOException] { if ($a -lt $LockAttempts) { Start-Sleep -Seconds 1 } else { $lockMsg = $_.Exception.Message } }
    }
    if (-not $fs) {
        return [pscustomobject]@{ Status = 'deferred'; Detail = "workbook is locked (open in Excel?): $lockMsg" }
    }

    $pkg = [OfficeOpenXml.ExcelPackage]::new()
    try {
        $pkg.Load($fs)
        $ws = $pkg.Workbook.Worksheets[$Sheet]
        if (-not $ws) { return [pscustomobject]@{ Status = 'error'; Detail = "sheet '$Sheet' not found in $Path" } }

        $hdr = Find-HeaderRow $ws $Catalogue.Headers
        if ($hdr -eq 0) {
            return [pscustomobject]@{ Status = 'error'; Detail = "no header row in sheet '$Sheet' names two or more of: $($Catalogue.Headers -join ', ')" }
        }
        $wbCols = [ordered]@{}
        for ($c = 1; $c -le $ws.Dimension.End.Column; $c++) {
            $name = ([string]$ws.Cells[$hdr, $c].Value).Trim()
            if ($name -and -not $wbCols.Contains($name)) { $wbCols[$name] = $c }
        }
        $map = [ordered]@{}                      # markdown header -> workbook column
        $missingInWb = @(); $missingInMd = @()
        foreach ($h in $Catalogue.Headers) { if ($wbCols.Contains($h)) { $map[$h] = $wbCols[$h] } else { $missingInWb += $h } }
        foreach ($k in $wbCols.Keys) { if (-not ($Catalogue.Headers -contains $k)) { $missingInMd += $k } }
        if ($map.Count -eq 0) { return [pscustomobject]@{ Status = 'error'; Detail = 'no workbook column matches a markdown header' } }

        $n       = $Catalogue.Rows.Count
        $first   = $hdr + 1
        $lastRow = [Math]::Max($ws.Dimension.End.Row, $hdr + $n)
        $noteCol = if ($map.Contains('ID')) { $map['ID'] } else { @($map.Values | Sort-Object)[0] }
        $noteCell = $ws.Cells[$hdr, $noteCol]
        $noteText = Get-NoteText $Catalogue.Path

        $same = $noteCell.Comment -and $noteCell.Comment.Text -ceq $noteText
        for ($r = $first; $same -and $r -le $lastRow; $r++) {
            $k = $r - $first
            foreach ($h in $map.Keys) {
                $want = if ($k -lt $n) { $Catalogue.Rows[$k].Cells[$h] } else { $null }
                if (-not (Test-CellMatches $ws.Cells[$r, $map[$h]] $want)) { $same = $false; break }
            }
        }

        $report = @()
        if ($missingInWb) { $report += "markdown-only columns (not written): $($missingInWb -join ', ')" }
        if ($missingInMd) { $report += "workbook-only columns (left as they are): $($missingInMd -join ', ')" }
        foreach ($w in $Catalogue.Warnings) { $report += $w }
        $detail = "rows=$n" + $(if ($report) { ' | ' + ($report -join ' | ') } else { '' })

        if ($same) { return [pscustomobject]@{ Status = 'unchanged'; Detail = $detail } }

        for ($r = $first; $r -le $lastRow; $r++) {
            $k = $r - $first
            foreach ($h in $map.Keys) {
                $col  = $map[$h]
                $cell = $ws.Cells[$r, $col]
                $want = if ($k -lt $n) { $Catalogue.Rows[$k].Cells[$h] } else { $null }
                # A row past the range Adrian formatted inherits the formatting of the row above.
                if ($k -lt $n -and $r -gt $first -and $cell.StyleID -eq 0) { $cell.StyleID = $ws.Cells[($r - 1), $col].StyleID }
                $cell.Value = if ($want) { $want.Value } else { $null }
                if ($want -and $want.Value -is [datetime] -and -not (Test-DateFormat $cell)) {
                    $cell.Style.Numberformat.Format = 'yyyy-mm-dd'
                }
                if ($want -and $want.Link) {
                    $cell.Hyperlink = Get-LinkUri $want.Link
                    if (-not $cell.Style.Font.UnderLine) {
                        $cell.Style.Font.UnderLine = $true
                        $cell.Style.Font.Color.SetColor(255, 5, 99, 193)       # Excel's hyperlink blue
                    }
                } elseif ($cell.Hyperlink) {
                    $cell.Hyperlink = $null
                }
            }
        }
        if ($noteCell.Comment -and $noteCell.Comment.Text -cne $noteText) { $ws.Comments.Remove($noteCell.Comment) }
        if (-not $noteCell.Comment) {
            $cm = $noteCell.AddComment($noteText, $script:NoteAuthor)
            $cm.AutoFit = $true
        }

        $bytes = $pkg.GetAsByteArray()
        $fs.Position = 0
        $fs.SetLength(0)
        $fs.Write($bytes, 0, $bytes.Length)
        $fs.Flush($true)
        if ($created) { $detail += ' | workbook did not exist and was created' }
        [pscustomobject]@{ Status = 'written'; Detail = $detail }
    } finally {
        $pkg.Dispose()
        $fs.Dispose()
    }
}

# ---- one run, and the watch loop --------------------------------------------------------

$script:State = @{ LastHash = $null; Pending = $false; PendingSince = $null; LastDeferredLog = [datetime]::MinValue }

function Invoke-SyncRun([string] $Trigger) {
    $st = $script:State
    try {
        $hash = Get-FileSha256 $MarkdownPath
        $md = "md=$($hash.Substring(0, 8))"
        try { $cat = Read-Catalogue $MarkdownPath }
        catch {
            $st.LastHash = $hash; $st.Pending = $false
            Write-SyncLog 'error' $Trigger "$md $($_.Exception.Message) - nothing written"
            return 'error'
        }
        # A retry of a pending write probes the lock once; a fresh change waits up to 5 s for it.
        $attempts = if ($Trigger -eq 'retry') { 1 } else { 5 }
        $res = Sync-Workbook -Catalogue $cat -Path $WorkbookPath -Sheet $SheetName -LockAttempts $attempts
        $st.LastHash = $hash
        if ($res.Status -eq 'deferred') {
            if (-not $st.Pending) { $st.PendingSince = Get-Date }
            $st.Pending = $true
            $now = Get-Date
            if ($Trigger -ne 'retry' -or ($now - $st.LastDeferredLog).TotalMinutes -ge 30) {
                $st.LastDeferredLog = $now
                Write-SyncLog 'deferred' $Trigger ("$md $($res.Detail) - pending since {0:HH:mm:ss}, retried every poll until it is written" -f $st.PendingSince)
            }
            return 'deferred'
        }
        $suffix = ''
        if ($st.Pending -and $res.Status -ne 'error') {
            $suffix = ' | was deferred since {0:yyyy-MM-dd HH:mm:ss}' -f $st.PendingSince
            $st.Pending = $false
        }
        Write-SyncLog $res.Status $Trigger "$md $($res.Detail)$suffix"
        return $res.Status
    } catch {
        Write-SyncLog 'error' $Trigger "$($_.Exception.Message)"
        return 'error'
    }
}

$script:WatchEvents = 'Changed', 'Created', 'Deleted', 'Renamed', 'Error'

function New-CatalogueWatcher([string] $Dir) {
    $w = [IO.FileSystemWatcher]::new($Dir, '*')
    $w.IncludeSubdirectories = $false
    $w.NotifyFilter = [IO.NotifyFilters]'FileName, LastWrite, Size, CreationTime'
    $w.InternalBufferSize = 65536
    foreach ($e in $script:WatchEvents) {
        Register-ObjectEvent -InputObject $w -EventName $e -SourceIdentifier "TCSync.$e" | Out-Null
    }
    $w.EnableRaisingEvents = $true
    $w
}

function Remove-CatalogueWatcher($W) {
    foreach ($e in $script:WatchEvents) { Unregister-Event -SourceIdentifier "TCSync.$e" -ErrorAction SilentlyContinue }
    if ($W) { $W.Dispose() }
}

function Start-WatchLoop {
    $mutex = [Threading.Mutex]::new($false, 'Local\ga40prj.TestCatalogueSync')
    $owned = $false
    try { $owned = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned = $true }
    if (-not $owned) {
        Write-SyncLog 'skipped' 'startup' "another watcher already holds the lock - pid $PID exits"
        return
    }
    $dir = [IO.Path]::GetDirectoryName($MarkdownPath)
    Write-SyncLog 'started' 'startup' "pid=$PID poll=${PollSeconds}s debounce=${DebounceMilliseconds}ms md=$MarkdownPath xlsx=$WorkbookPath"
    [void](Invoke-SyncRun 'startup')

    $fsw = $null; $dueAt = $null; $via = ''
    $nextPoll = (Get-Date).AddSeconds($PollSeconds)
    try {
        while ($true) {
            if (-not $fsw -and [IO.Directory]::Exists($dir)) {
                try { $fsw = New-CatalogueWatcher $dir } catch { Remove-CatalogueWatcher $null; $fsw = $null }
            }
            [void](Wait-Event -Timeout 1)
            foreach ($ev in @(Get-Event -ErrorAction SilentlyContinue)) {
                if ($ev.SourceIdentifier -eq 'TCSync.Error') {
                    Remove-CatalogueWatcher $fsw; $fsw = $null       # re-created on the next pass
                } elseif ($ev.SourceIdentifier -like 'TCSync.*') {
                    $a = $ev.SourceEventArgs
                    $paths = @($a.FullPath)
                    if ($a -is [IO.RenamedEventArgs]) { $paths += $a.OldFullPath }
                    if ($paths -contains $MarkdownPath) {
                        $dueAt = (Get-Date).AddMilliseconds($DebounceMilliseconds)
                        if ($via -notmatch "\b$($a.ChangeType)\b") { $via = ($via, $a.ChangeType | Where-Object { $_ }) -join '+' }
                    }
                }
                Remove-Event -EventIdentifier $ev.EventIdentifier -ErrorAction SilentlyContinue
            }
            $now = Get-Date
            if ($dueAt -and $now -ge $dueAt) {
                $dueAt = $null
                [void](Invoke-SyncRun "watch:$via")
                $via = ''
                $nextPoll = (Get-Date).AddSeconds($PollSeconds)
            } elseif ($now -ge $nextPoll -and -not $dueAt) {
                # The poll is the backstop: it only acts on a change the watcher did not report.
                $nextPoll = $now.AddSeconds($PollSeconds)
                $h = $null
                try { if ([IO.File]::Exists($MarkdownPath)) { $h = Get-FileSha256 $MarkdownPath } } catch { $h = $null }
                if ($h -and $h -ne $script:State.LastHash) { [void](Invoke-SyncRun 'poll') }
                elseif ($script:State.Pending) { [void](Invoke-SyncRun 'retry') }
            }
        }
    } finally {
        Write-SyncLog 'stopped' 'exit' "pid=$PID"
        Remove-CatalogueWatcher $fsw
        $mutex.ReleaseMutex()
        $mutex.Dispose()
    }
}

# ---- self-test --------------------------------------------------------------------------

function Invoke-SelfTest {
    $fails = [Collections.Generic.List[string]]::new()
    $passes = 0
    function Check([bool] $Cond, [string] $What) {
        if ($Cond) { $script:passes++; Write-Host "  ok    $What" } else { $fails.Add($What); Write-Host "  FAIL  $What" -ForegroundColor Red }
    }
    $script:passes = 0

    # 1. The real catalogue.
    Write-Host "`n[1] the real catalogue: $MarkdownPath"
    $cat = Read-Catalogue $MarkdownPath
    $lines = [IO.File]::ReadAllText($MarkdownPath, $script:Utf8NoBom) -split "`r?`n"
    # An independent count: lines in the section (heading to next "## ") that begin "| [TC-".
    $inSection = $false; $expected = 0
    foreach ($l in $lines) {
        if ($l.TrimEnd() -ceq $script:Heading) { $inSection = $true; continue }
        if ($inSection -and $l.StartsWith('## ')) { break }
        if ($inSection -and $l -match '^\|\s*\[TC-') { $expected++ }
    }
    $ids = @($cat.Rows | ForEach-Object { $_.Cells['ID'].Text })
    Check ($cat.Headers[0] -ceq 'ID' -and @($cat.Headers | Where-Object { -not $_ }).Count -eq 0) "headers: $($cat.Headers -join ' | ')"
    Check ($cat.Rows.Count -eq $expected -and $expected -gt 0) "rows = $($cat.Rows.Count), '| [TC-' lines in the section = $expected"
    Check (@($ids | Where-Object { $_ -notmatch '^TC-[A-Z]+-\d{2}$' }).Count -eq 0) "every ID is TC-<AREA>-<nn> ($($ids[0]) ... $($ids[-1]))"
    Check (@($ids | Select-Object -Unique).Count -eq $ids.Count) 'IDs are unique'
    Check (@($cat.Rows | Where-Object { -not $_.Cells['ID'].Link -or -not (Test-Path -LiteralPath $_.Cells['ID'].Link) }).Count -eq 0) 'every ID links to a case file that exists'
    $allText = @($cat.Rows | ForEach-Object { $r = $_; $cat.Headers | ForEach-Object { $r.Cells[$_].Text } })
    Check (@($allText | Where-Object { $_ -match '`|\]\(|\*\*' }).Count -eq 0) 'no cell keeps a backtick, a link bracket or **'
    Check (@($allText | Where-Object { $_ -ceq [string][char]0x2014 }).Count -eq 0) 'no cell is a bare em dash'
    Check (@($cat.Rows | Where-Object { $v = $_.Cells['Last green'].Value; $null -ne $v -and $v -isnot [datetime] }).Count -eq 0) 'Last green is a date or blank in every row'
    Check ($cat.Warnings.Count -eq 0) "no parser warnings ($($cat.Warnings -join '; '))"

    # 2. The fixture: a decoy table above, a link, an em dash, backticks, diacritics, an escaped pipe,
    #    an extra column, and prose glued to the table's last row with a table row after it.
    $fixture = Join-Path $PSScriptRoot 'testing' 'fixtures' 'test-catalogue-sync.fixture.md'
    Write-Host "`n[2] the fixture: $fixture"
    foreach ($variant in 'LF', 'CRLF') {
        $path = $fixture
        if ($variant -eq 'CRLF') {
            $path = Join-Path ([IO.Path]::GetTempPath()) "tcsync-fixture-$PID.md"
            [IO.File]::WriteAllText($path, ([IO.File]::ReadAllText($fixture, $script:Utf8NoBom) -replace "`r?`n", "`r`n"), $script:Utf8NoBom)
        }
        try {
            $f = Read-Catalogue $path
            $casesDir = Join-Path ([IO.Path]::GetDirectoryName($path)) 'cases'
            Check ($f.Rows.Count -eq 3) "[$variant] 3 rows - not the decoy table above, not the row after the prose"
            Check ($f.Headers -join '|' -ceq 'ID|Title|Area|Kind|Data folder|State|Last green|Spec|Owner') "[$variant] 9 headers, 'Owner' included"
            $r1 = $f.Rows[0].Cells; $r2 = $f.Rows[1].Cells; $r3 = $f.Rows[2].Cells
            Check ($r1['ID'].Text -ceq 'TC-FIX-01' -and $r1['ID'].Link -ceq (Join-Path $casesDir 'TC-FIX-01.md')) "[$variant] link -> text TC-FIX-01 + absolute path to cases\TC-FIX-01.md"
            Check ($r1['Title'].Text -ceq "Proprietate creat`u{0103} manual, vizibil`u{0103} `u{00EE}n list`u{0103}") "[$variant] diacritics a-breve / i-circumflex survive, codepoint for codepoint"
            Check ($r2['Title'].Text -ceq "Acela`u{0219}i folder importat a doua oar`u{0103} `u{2014} `u{201E}Deja `u{00EE}n sistem`u{201D}") "[$variant] s-comma-below (U+0219), mid-text em dash and Romanian quotes survive"
            Check ($r3['Title'].Text -ceq "`u{0218}antier `u{00EE}n `u{021A}ara B`u{00E2}rsei | pipe, bold and a_b_c") "[$variant] capital S/T-comma-below, escaped pipe, **bold** stripped, a_b_c untouched"
            Check ($null -eq $r1['Data folder'].Value -and $r1['Data folder'].Text -ceq '') "[$variant] an em-dash cell becomes blank"
            Check ($r2['Data folder'].Value -ceq '02.rerun' -and $r1['State'].Value -ceq 'confirmed') "[$variant] backticks stripped from a folder and a state"
            Check ($r2['Spec'].Value -ceq 'e2e/auth/login-dashboard.spec.ts') "[$variant] a backticked spec path becomes the bare path"
            Check ($r1['Last green'].Value -is [datetime] -and $r1['Last green'].Value -eq [datetime]'2026-09-23') "[$variant] 2026-09-23 becomes a date"
            Check ($r2['Last green'].Value -eq [datetime]'2026-01-05' -and $null -eq $r3['Last green'].Value) "[$variant] 2026-01-05 is a date, an em-dash date is blank"
            Check ($r3['Owner'].Value -ceq 'Adrian') "[$variant] a markdown-only column still parses"
            $fl = [IO.File]::ReadAllText($path, $script:Utf8NoBom) -split "`r?`n"
            Check ($fl[$f.FirstLineAfterTable - 1].StartsWith('**One row is')) "[$variant] the table ends at line $($f.FirstLineAfterTable), the prose line glued to it"
        } finally {
            if ($variant -eq 'CRLF') { Remove-Item -LiteralPath $path -ErrorAction SilentlyContinue }
        }
    }
    try { $null = Read-Catalogue (Join-Path $PSScriptRoot 'Sync-TestCatalogue.ps1'); Check $false 'a file with no catalogue heading is refused' }
    catch { Check ($_.Exception.Message -match 'not found') 'a file with no catalogue heading is refused, not read as empty' }

    # 3. A write round-trip into a TEMP COPY of the workbook. The real workbook is never written here.
    Write-Host "`n[3] workbook round-trip on a temp copy of $WorkbookPath"
    $haveLib = ('OfficeOpenXml.ExcelPackage' -as [type]) -or (Get-Module -ListAvailable -Name ImportExcel)
    if (-not $haveLib) {
        Write-Host '  SKIPPED - ImportExcel is not installed (Install-TestCatalogueSync.ps1 installs it)' -ForegroundColor Yellow
    } elseif (-not [IO.File]::Exists($WorkbookPath)) {
        Write-Host "  SKIPPED - $WorkbookPath does not exist" -ForegroundColor Yellow
    } else {
        Import-Epplus
        $tmp = Join-Path ([IO.Path]::GetTempPath()) "tcsync-selftest-$PID.xlsx"
        [IO.File]::Copy($WorkbookPath, $tmp, $true)
        try {
            $before = [OfficeOpenXml.ExcelPackage]::new([IO.FileInfo]$tmp)
            $wsB = $before.Workbook.Worksheets[$SheetName]
            $widths = @(1..12 | ForEach-Object { $wsB.Column($_).Width })
            $headerTexts = @(1..12 | ForEach-Object { [string]$wsB.Cells[1, $_].Value })
            $before.Dispose()

            $res = Sync-Workbook -Catalogue $cat -Path $tmp -Sheet $SheetName
            Check ($res.Status -in 'written', 'unchanged') "real catalogue -> $($res.Status) ($($res.Detail))"
            $mtime = [IO.File]::GetLastWriteTimeUtc($tmp)
            Start-Sleep -Milliseconds 1100
            $res2 = Sync-Workbook -Catalogue $cat -Path $tmp -Sheet $SheetName
            Check ($res2.Status -eq 'unchanged' -and [IO.File]::GetLastWriteTimeUtc($tmp) -eq $mtime) 'second run with the same table: unchanged, LastWriteTime did not move'

            $p = [OfficeOpenXml.ExcelPackage]::new([IO.FileInfo]$tmp)
            try {
                $ws = $p.Workbook.Worksheets[$SheetName]
                $hdr = Find-HeaderRow $ws $cat.Headers
                $col = @{}; for ($c = 1; $c -le $ws.Dimension.End.Column; $c++) { $n = ([string]$ws.Cells[$hdr, $c].Value).Trim(); if ($n) { $col[$n] = $c } }
                $bad = 0
                for ($k = 0; $k -lt $cat.Rows.Count; $k++) {
                    foreach ($h in $cat.Headers) {
                        if (-not $col.ContainsKey($h)) { continue }
                        $cell = $ws.Cells[($hdr + 1 + $k), $col[$h]]
                        $want = $cat.Rows[$k].Cells[$h]
                        if (-not (Test-CellMatches $cell $want)) { $bad++; Write-Host "    mismatch row $($k + 1) '$h': '$($cell.Value)' vs '$($want.Text)'" }
                    }
                }
                Check ($bad -eq 0) "every cell reads back identical to the markdown ($($cat.Rows.Count) rows x $($col.Count) columns), Romanian titles included"
                $idCell = $ws.Cells[($hdr + 1), $col['ID']]
                Check ($idCell.Hyperlink -and $idCell.Hyperlink.OriginalString -like 'file:///*/cases/TC-*.md') "ID cell links to $($idCell.Hyperlink.OriginalString)"
                $lg = $ws.Cells[($hdr + 1), $col['Last green']]
                Check ($lg.Value -is [double] -and (Test-DateFormat $lg)) "Last green is stored as a number with a date format ('$($lg.Style.Numberformat.Format)', shows '$($lg.Text)')"
                Check ($ws.Cells[$hdr, $col['ID']].Comment.Text -like 'GENERATED VIEW*') 'the header carries the generated-view note'
                $widthsAfter = @(1..12 | ForEach-Object { $ws.Column($_).Width })
                Check (($widths -join ',') -eq ($widthsAfter -join ',')) 'column widths unchanged'
                Check ((@(1..12 | ForEach-Object { [string]$ws.Cells[1, $_].Value }) -join '|') -ceq ($headerTexts -join '|')) "header row kept as it was, spaces included: $($headerTexts -join '|')"
            } finally { $p.Dispose() }

            $fx = Read-Catalogue $fixture
            $res3 = Sync-Workbook -Catalogue $fx -Path $tmp -Sheet $SheetName
            $p = [OfficeOpenXml.ExcelPackage]::new([IO.FileInfo]$tmp)
            try {
                $ws = $p.Workbook.Worksheets[$SheetName]
                $ghost = 0
                for ($r = $hdr + 4; $r -le $ws.Dimension.End.Row; $r++) {
                    foreach ($c in $col.Values) { if ($null -ne $ws.Cells[$r, $c].Value -or $ws.Cells[$r, $c].Hyperlink) { $ghost++ } }
                }
                Check ($res3.Status -eq 'written' -and $ghost -eq 0) "shrinking $($cat.Rows.Count) rows to 3 leaves no ghost values or links below row $($hdr + 3)"
                Check ($res3.Detail -match 'markdown-only columns \(not written\): Owner') "a markdown-only column is reported by name: $($res3.Detail)"
                Check ([string]$ws.Cells[($hdr + 3), $col['Title']].Value -ceq $fx.Rows[2].Cells['Title'].Text) 'the fixture''s capital S/T-comma-below title reads back identically'
            } finally { $p.Dispose() }

            $lockFs = [IO.File]::Open($tmp, 'Open', 'Read', 'Read')      # the share mode Excel holds
            try {
                $res4 = Sync-Workbook -Catalogue $cat -Path $tmp -Sheet $SheetName -LockAttempts 2
                Check ($res4.Status -eq 'deferred') "a locked workbook is deferred, not an error: $($res4.Detail)"
            } finally { $lockFs.Dispose() }
            $res5 = Sync-Workbook -Catalogue $cat -Path $tmp -Sheet $SheetName
            Check ($res5.Status -eq 'written') 'once the lock clears the deferred table is written'
        } finally {
            Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
        }
    }

    Write-Host ''
    if ($fails.Count) {
        Write-Host "SELF-TEST FAILED: $($fails.Count) of $($fails.Count + $script:passes) checks" -ForegroundColor Red
        exit 1
    }
    Write-Host "SELF-TEST PASSED: $script:passes checks" -ForegroundColor Green
    exit 0
}

# ---- entry ------------------------------------------------------------------------------

switch ($PSCmdlet.ParameterSetName) {
    'ParseOnly' {
        $cat = Read-Catalogue $MarkdownPath
        [pscustomobject]@{
            headingLine = $cat.HeadingLine; firstLineAfterTable = $cat.FirstLineAfterTable
            headers = $cat.Headers; warnings = @($cat.Warnings)
            rows = @($cat.Rows | ForEach-Object {
                $r = $_; $o = [ordered]@{ line = $r.Line }
                foreach ($h in $cat.Headers) {
                    $c = $r.Cells[$h]
                    $o[$h] = if ($c.Value -is [datetime]) { 'date:' + $c.Value.ToString('yyyy-MM-dd') } else { $c.Value }
                    if ($c.Link) { $o["$h.link"] = $c.Link }
                }
                $o
            })
        } | ConvertTo-Json -Depth 5
        exit 0
    }
    'SelfTest' { Invoke-SelfTest }
    'Watch'    { Start-WatchLoop; exit 0 }
    default {
        $status = Invoke-SyncRun 'manual'
        exit $(switch ($status) { 'written' { 0 } 'unchanged' { 0 } 'deferred' { 3 } default { 1 } })
    }
}
