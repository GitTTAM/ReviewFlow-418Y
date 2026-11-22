# Shared helpers for the two Windows buttons. Keep process ownership checks here.
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
