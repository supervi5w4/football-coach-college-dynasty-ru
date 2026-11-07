@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Patch.ps1" Install %*
set PATCH_EXIT=%ERRORLEVEL%
pause
exit /b %PATCH_EXIT%