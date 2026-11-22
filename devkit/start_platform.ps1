[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$NoWait,
    [switch]$PreflightOnly,
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
    $runtime = Get-ReviewFlowRuntime -Root $projectRoot -Directory $RuntimeDirectory
    Set-Location -LiteralPath $projectRoot

    Write-Host 'Starting ReviewFlow...' -ForegroundColor Cyan
    $nodeCommand = (Get-Command node.exe -ErrorAction Stop).Source
    $npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
    $nodeMajor = [int]((& $nodeCommand --version).TrimStart('v').Split('.')[0])
    if ($nodeMajor -lt 22) { throw 'Install Node.js 22 or newer, then double-click Start again.' }
    foreach ($required in @('package-lock.json', 'server\src\server.js', 'scripts\platform.mjs', 'client\index.html')) {
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $required))) {
            throw "Missing $required. Keep the launcher in the ReviewFlow project folder."
        }
    }
    if ($Port -eq $DatabasePort) { throw 'The app and database must use different ports.' }
    if ($PreflightOnly) {
        Write-Host 'Preflight passed. No packages installed and no services started.'
        exit 0
    }

    $workspaceId = Get-ReviewFlowWorkspaceId -Root $projectRoot
    $launchMutex = [Threading.Mutex]::new($false, "Local\ReviewFlow-$workspaceId-$Port")
    $lockHeld = $launchMutex.WaitOne(0)
    if (-not $lockHeld) { Write-Host 'ReviewFlow is already starting. Give the first launch a moment.'; exit 0 }

    $health = Get-ReviewFlowHealth -Port $Port
    if ($health -and $health.PSObject.Properties['workspaceId'] -and $health.workspaceId -eq $workspaceId) {
        Write-Host "ReviewFlow is already running at http://127.0.0.1:$Port"
        if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$Port" }
        exit 0
    }
    if (@(Get-ListeningProcesses -Ports @($Port)).Count -gt 0) {
        throw "Port $Port is already in use. Nothing was stopped. Close the existing app, or use Clear Ports if it belongs to this ReviewFlow folder."
    }

    New-Item -ItemType Directory -Force -Path $runtime | Out-Null
    if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }

    # Install only when needed. Build every launch so edited CSS/React is included.
    $lockHash = (Get-FileHash -LiteralPath 'package-lock.json' -Algorithm SHA256).Hash
    $hashFile = Join-Path $runtime 'dependencies.sha256'
    $oldHash = if (Test-Path -LiteralPath $hashFile) { (Get-Content -LiteralPath $hashFile -Raw).Trim() } else { '' }
    $missingPackages = -not (Test-Path -LiteralPath 'node_modules\vite\bin\vite.js') -or
        -not (Test-Path -LiteralPath 'node_modules\mongodb-memory-server\package.json')
    if ($missingPackages -or ($oldHash -and $oldHash -ne $lockHash)) {
        Write-Host 'Installing project packages. First setup can take a few minutes...'
        & $npmCommand ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Package installation failed. Check the error above, then try Start again.' }
    }
    Set-Content -LiteralPath $hashFile -Value $lockHash -Encoding ASCII

    Write-Host 'Building the app...'
    & $npmCommand run build
    if ($LASTEXITCODE -ne 0) { throw 'The build failed. Check the error above. No app or database was started.' }

    $runner = Join-Path $projectRoot 'scripts\platform.mjs'
    $arguments = @('"' + $runner + '"', '--runtime', '"' + $runtime + '"', '--port', "$Port", '--db-port', "$DatabasePort")
    $process = Start-Process -FilePath $nodeCommand -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $runtime 'output.log') -RedirectStandardError (Join-Path $runtime 'error.log')

    $deadline = [DateTime]::UtcNow.AddMinutes(10)
    $lastStage = ''
    do {
        $state = Get-PlatformState -Directory $runtime
        if ($state -and $state.launcherPid -eq $process.Id) {
            if ($state.stage -ne $lastStage) { Write-Host $state.stage; $lastStage = $state.stage }
            if ($state.status -eq 'error') { throw "$($state.stage) See $runtime\error.log" }
            if ($state.status -eq 'ready') {
                $health = Get-ReviewFlowHealth -Port $Port
                if ($health -and $health.workspaceId -eq $workspaceId) {
                    Write-Host "ReviewFlow is ready: http://127.0.0.1:$Port" -ForegroundColor Green
                    if ($state.PSObject.Properties['databaseMode'] -and $state.databaseMode -eq 'shared') {
                        Write-Host 'You can close this window. Clear Ports stops your app; the shared database stays online.'
                    } else { Write-Host 'You can close this window. Use Clear Ports to stop the app and database.' }
                    if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$Port" }
                    exit 0
                }
            }
        }
        $process.Refresh()
        if ($process.HasExited) {
            # A fast failure can finish between our state read and process check.
            $lastState = Get-PlatformState -Directory $runtime
            if ($lastState -and $lastState.launcherPid -eq $process.Id -and $lastState.status -eq 'error') {
                throw "$($lastState.stage) See $runtime\error.log"
            }
            throw "Startup stopped. See $runtime\error.log for details."
        }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Startup timed out. Check $runtime\output.log and error.log, then use Clear Ports before retrying."
} catch {
    Write-Host "ReviewFlow could not start: $($_.Exception.Message)" -ForegroundColor Red
    if (-not $NoWait) { Read-Host 'Press Enter to close' | Out-Null }
    exit 1
} finally {
    if ($lockHeld) { $launchMutex.ReleaseMutex() }
    if ($launchMutex) { $launchMutex.Dispose() }
}
