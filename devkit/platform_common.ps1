# Shared helpers for the Windows buttons. Keep process ownership checks here.
Set-StrictMode -Version Latest

function Get-ReviewFlowRoot {
    return [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
}

function Get-ReviewFlowRuntime {
    param([string]$Root, [string]$Directory)
    if (-not $Directory) { $Directory = Join-Path $Root '.local\platform' }
    $resolved = [IO.Path]::GetFullPath($Directory)
    if (-not $resolved.StartsWith($Root + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The runtime directory must be inside this ReviewFlow folder.'
    }
    return $resolved
}

function Get-ReviewFlowDatabaseDirectory {
    param([string]$Root, [string]$Runtime)
    if ($Runtime -eq (Join-Path $Root '.local\platform')) {
        return Join-Path $Root '.local\mongo\db'
    }
    return Join-Path $Runtime 'mongo\db'
}

function Assert-ReviewFlowDataPath {
    param([string]$Root, [string]$Directory)
    $resolved = [IO.Path]::GetFullPath($Directory).TrimEnd('\')
    if (-not $resolved.StartsWith($Root + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Database and backup folders must stay inside this ReviewFlow folder.'
    }
    # Refuse junctions/symlinks in any parent so a rename cannot reach another folder.
    $current = $resolved
    while ($current.Length -ge $Root.Length) {
        $item = $null
        try { $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop }
        catch [System.Management.Automation.ItemNotFoundException] { }
        if ($null -ne $item) {
            if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                throw "Database path must use ordinary folders, without junctions or symlinks: $current"
            }
        }
        if ($current -eq $Root) { break }
        $current = Split-Path -Parent $current
    }
    return $resolved
}

function Get-ReviewFlowWorkspaceId {
    param([string]$Root)
    # Node's ROOT includes the final slash; use the same input as config.js.
    $hash = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes(($Root + '\').ToLowerInvariant())
        return ([BitConverter]::ToString($hash.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant().Substring(0, 16)
    } finally { $hash.Dispose() }
}

function Get-ReviewFlowHealth {
    param([int]$Port)
    try { return Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 2 }
    catch { return $null }
}

function Get-PlatformState {
    param([string]$Directory)
    try { return Get-Content -LiteralPath (Join-Path $Directory 'state.json') -Raw | ConvertFrom-Json }
    catch { return $null }
}

function Get-ListeningProcesses {
    param([int[]]$Ports)
    return @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -in $Ports } |
        Select-Object LocalPort, OwningProcess -Unique)
}

function Get-ProcessDetails {
    param([int]$ProcessId)
    return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

function Test-ProcessHasFile {
    param($Details, [string]$File)
    if (-not $Details -or -not $Details.CommandLine) { return $false }
    # Match a whole quoted or unquoted argument, not another similarly named folder.
    $pattern = '(?i)(?:^|\s)"?' + [regex]::Escape($File) + '"?(?=\s|$)'
    return $Details.CommandLine -match $pattern
}
