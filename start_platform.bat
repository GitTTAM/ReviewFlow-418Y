@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0devkit\start_platform.ps1" %*
set "LAUNCH_EXIT=%ERRORLEVEL%"
endlocal & exit /b %LAUNCH_EXIT%
