[CmdletBinding()]
param(
    [switch]$YesUseFreshDemo,
    [switch]$NoBrowser,
    [switch]$NoWait,
    [ValidateRange(1024, 65535)][int]$Port = 5050,
    [ValidateRange(1024, 65535)][int]$DatabasePort = 28018,
    [string]$RuntimeDirectory
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'platform_common.ps1')
$launchMutex = $null
$lockHeld = $false

try {
    $projectRoot = Get-ReviewFlowRoot
    Set-Location -LiteralPath $projectRoot
    $databaseMode = & node.exe (Join-Path $projectRoot 'scripts\database-mode.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Check the database settings in .env. No files moved.' }
    if ($databaseMode -eq 'shared') { throw 'Fresh demo is only for the local database. Shared data and local files were left untouched.' }
    $runtime = Get-ReviewFlowRuntime -Root $projectRoot -Directory $RuntimeDirectory
    $databaseDirectory = Get-ReviewFlowDatabaseDirectory -Root $projectRoot -Runtime $runtime
    $databaseDirectory = Assert-ReviewFlowDataPath -Root $projectRoot -Directory $databaseDirectory
    if ($Port -eq $DatabasePort) { throw 'The app and database must use different ports.' }

    Write-Host 'Start a fresh fictional ReviewFlow demo' -ForegroundColor Cyan
    Write-Host 'This stops this checkout and moves its current database to a separate backup folder.'
    Write-Host 'Your old answers will stay in that backup, not in the new demo. This does not repair or recover them.'
    Write-Host 'Any db-recovery folder and private PDF files stay where they are.'
    if (-not $YesUseFreshDemo) {
        if ($NoWait) { throw 'No files moved. Run with -YesUseFreshDemo only if you want new fictional demo data.' }
        $answer = Read-Host 'Type FRESH to keep a backup and start new demo data, or press Enter to cancel'
        if ($answer -cne 'FRESH') { Write-Host 'Cancelled. No files moved.'; exit 0 }
    }

    $workspaceId = Get-ReviewFlowWorkspaceId -Root $projectRoot
    $launchMutex = [Threading.Mutex]::new($false, "Local\ReviewFlow-$workspaceId-$Port")
    $lockHeld = $launchMutex.WaitOne(0)
    if (-not $lockHeld) { throw 'ReviewFlow is already starting. Let it finish before choosing a fresh demo.' }

    $serviceArgs = @('-NoWait', '-Port', "$Port", '-DatabasePort', "$DatabasePort", '-RuntimeDirectory', $runtime)
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'clear_platform_ports.ps1') @serviceArgs
    if ($LASTEXITCODE -ne 0) { throw 'Could not clear the ports safely. No database folder was moved.' }
    if (@(Get-ListeningProcesses -Ports @($Port, $DatabasePort)).Count -gt 0) {
        throw 'A service is still using a ReviewFlow port. No database folder was moved.'
    }
    # A manually started MongoDB may use this data directory on a different port.
    foreach ($details in @(Get-CimInstance Win32_Process -Filter "Name LIKE 'mongod%.exe'" -ErrorAction Stop)) {
        if (-not $details.CommandLine) {
            throw 'Could not inspect a MongoDB process. Stop that MongoDB session first. No database folder was moved.'
        }
        if (Test-ProcessHasFile -Details $details -File $databaseDirectory) {
            throw 'This database folder is still in use by MongoDB. Stop that session first. No files moved.'
        }
    }

    # Validate both absolute paths immediately before the directory rename.
    $databaseDirectory = Assert-ReviewFlowDataPath -Root $projectRoot -Directory $databaseDirectory
    if (Test-Path -LiteralPath $databaseDirectory) {
        $backupName = 'db-backup-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
        $backupDirectory = Join-Path (Split-Path -Parent $databaseDirectory) $backupName
        $backupDirectory = Assert-ReviewFlowDataPath -Root $projectRoot -Directory $backupDirectory
        if (Test-Path -LiteralPath $backupDirectory) { throw 'Backup folder already exists. No files moved.' }
        Rename-Item -LiteralPath $databaseDirectory -NewName $backupName -ErrorAction Stop
        Write-Host "Previous database kept at: $backupDirectory" -ForegroundColor Green
    } else { Write-Host 'No existing database folder to back up.' }

    # Normal startup creates and seeds the new directory. Release its launch lock first.
    $launchMutex.ReleaseMutex()
    $lockHeld = $false
    $startArgs = @($serviceArgs)
    if ($NoBrowser) { $startArgs += '-NoBrowser' }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start_platform.ps1') @startArgs
    if ($LASTEXITCODE -ne 0) { throw 'The new demo could not start. Any previous database is still in its backup folder.' }
    exit 0
} catch {
    Write-Host "Fresh demo stopped: $($_.Exception.Message)" -ForegroundColor Red
    if (-not $NoWait) { Read-Host 'Press Enter to close' | Out-Null }
    exit 1
} finally {
    if ($lockHeld) { $launchMutex.ReleaseMutex() }
    if ($launchMutex) { $launchMutex.Dispose() }
}
