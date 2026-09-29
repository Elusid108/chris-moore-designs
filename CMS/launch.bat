@echo off
setlocal
cd /d "%~dp0"
title Chris Moore Designs CMS

where node >nul 2>&1
if errorlevel 1 goto try_fnm

rem The site preview and the publish build check need Node 22.12 or newer.
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)"
if not errorlevel 1 goto node_ok

:try_fnm
rem The default Node is missing or too old; use the Node 22 that fnm manages, if there is one.
where fnm >nul 2>&1
if errorlevel 1 goto node_old
for /f "delims=" %%d in ('fnm exec --using 22 node -p process.execPath 2^>nul') do set "PATH=%%~dpd;%PATH%"
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)" >nul 2>&1
if not errorlevel 1 goto node_ok

:node_old
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node 22.12 or newer from https://nodejs.org and run this again.
  pause
  exit /b 1
)
echo.
echo WARNING: this Node.js is older than 22.12, so Preview and the publish build check will fail.
echo Update it from https://nodejs.org, or run: fnm install 22
echo The rest of the CMS still works.
echo.

:node_ok
for /f "delims=" %%v in ('node -v') do echo Using Node %%v

if not exist "node_modules\express\package.json" (
  echo Installing CMS dependencies, first run only...
  call npm ci
  if errorlevel 1 (
    echo.
    echo Dependency install failed. See the messages above.
    pause
    exit /b 1
  )
)

if not exist "..\node_modules\astro\package.json" (
  echo Installing site dependencies for Preview, first run only...
  pushd ..
  call npm ci
  popd
  if errorlevel 1 (
    echo.
    echo Site dependency install failed. The CMS will start, but Preview will not work.
    echo.
  )
)

rem Stop a previous CMS still holding port 3000.
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /R /C:":3000 " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

rem Open the browser a moment after the server starts.
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:3000"
node server.js
pause
