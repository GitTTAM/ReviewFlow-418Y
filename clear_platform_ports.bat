@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0devkit\clear_platform_ports.ps1" %*
set "CLEANUP_EXIT=%ERRORLEVEL%"
endlocal & exit /b %CLEANUP_EXIT%
