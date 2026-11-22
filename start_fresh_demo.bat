@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0devkit\start_fresh_demo.ps1" %*
set "FRESH_EXIT=%ERRORLEVEL%"
endlocal & exit /b %FRESH_EXIT%
