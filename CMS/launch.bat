@echo off
cd /d "%~dp0"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
start "" http://localhost:3000
node server.js
pause
