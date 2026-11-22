[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch]$NoWait,
    [ValidateRange(1024, 65535)][int]$Port = 5050,
    [ValidateRange(1024, 65535)][int]$DatabasePort = 28018,
    [string]$RuntimeDirectory
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'platform_common.ps1')

try {
    $projectRoot = Get-ReviewFlowRoot
    $runtime = Get-ReviewFlowRuntime -Root $projectRoot -Directory $RuntimeDirectory
    $state = Get-PlatformState -Directory $runtime
    $sharedDatabase = $state -and $state.PSObject.Properties['databaseMode'] -and $state.databaseMode -eq 'shared'
    $workspaceId = Get-ReviewFlowWorkspaceId -Root $projectRoot
    Write-Host 'Stopping ReviewFlow. Saved database files stay in place.' -ForegroundColor Cyan

    # Ask the supervisor to close the app and MongoDB cleanly before using a fallback.
    if ($state -and $state.workspaceId -eq $workspaceId) {
        $details = Get-ProcessDetails -ProcessId $state.launcherPid
        if ((Test-ProcessHasFile -Details $details -File (Join-Path $projectRoot 'scripts\platform.mjs')) -and
            (Test-ProcessHasFile -Details $details -File $runtime)) {
            if ($PSCmdlet.ShouldProcess('ReviewFlow app and database', 'Stop gracefully')) {
                @{ instanceId = $state.instanceId } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtime 'stop-request.json') -Encoding ASCII
                $deadline = [DateTime]::UtcNow.AddSeconds(25)
                do {
                    Start-Sleep -Milliseconds 250
                    $details = Get-ProcessDetails -ProcessId $state.launcherPid
                } while ($details -and [DateTime]::UtcNow -lt $deadline)
                if ($details) { throw "ReviewFlow did not stop cleanly. Check $runtime\error.log before trying again." }
            }
        }
    }

    # Handle manually started services only when their command line proves ownership.
    # Unknown listeners are reported and left alone, even on our usual port numbers.
    $blocked = @()
    $ports = @($Port)
    if (-not $sharedDatabase) { $ports += $DatabasePort }
    if ($runtime -eq (Join-Path $projectRoot '.local\platform')) { $ports += 5173 }
    foreach ($listener in (Get-ListeningProcesses -Ports $ports)) {
        $details = Get-ProcessDetails -ProcessId $listener.OwningProcess
        $owned = $false
        foreach ($entry in @('server\src\server.js', 'scripts\local-mongo.mjs', 'node_modules\vite\bin\vite.js')) {
            if (Test-ProcessHasFile -Details $details -File (Join-Path $projectRoot $entry)) { $owned = $true }
        }
        $databaseDirectory = if ($runtime -eq (Join-Path $projectRoot '.local\platform')) {
            Join-Path $projectRoot '.local\mongo\db'
        } else { Join-Path $runtime 'mongo\db' }
        if ($details -and $details.Name -like 'mongod*.exe' -and
            (Test-ProcessHasFile -Details $details -File $databaseDirectory)) { $owned = $true }

        if ($owned) {
            if ($PSCmdlet.ShouldProcess("ReviewFlow PID $($listener.OwningProcess) on port $($listener.LocalPort)", 'Stop process')) {
                Stop-Process -Id $listener.OwningProcess -ErrorAction Stop
            }
        } else {
            $blocked += "Port $($listener.LocalPort), PID $($listener.OwningProcess)"
        }
    }
    if ($blocked.Count -gt 0) {
        Write-Host 'These listeners could not be confirmed as this ReviewFlow project and were left running:' -ForegroundColor Yellow
        $blocked | ForEach-Object { Write-Host "  $_" }
        if (-not $NoWait) { Read-Host 'Press Enter to close' | Out-Null }
        exit 1
    }
    if ($WhatIfPreference) { Write-Host 'Preview only. No processes were stopped.' }
    elseif ($sharedDatabase) { Write-Host 'ReviewFlow app stopped. The shared database stays online.' -ForegroundColor Green }
    else { Write-Host 'ReviewFlow ports cleared. Saved reviews were not deleted.' -ForegroundColor Green }
    exit 0
} catch {
    Write-Host "Cleanup stopped: $($_.Exception.Message)" -ForegroundColor Red
    if (-not $NoWait) { Read-Host 'Press Enter to close' | Out-Null }
    exit 1
}
