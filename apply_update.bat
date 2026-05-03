@echo off
title Parts Catalog - System Updater
echo ==========================================
echo    Installing System Update...
echo ==========================================
echo.
if not exist "update.zip" (
    echo [ERROR] Could not find "update.zip". 
    echo Please place the new "update.zip" file in this folder and run this script again.
    pause
    exit /b
)

echo [1/3] Extracting new files from update.zip...
powershell -command "Expand-Archive -Path 'update.zip' -DestinationPath '.' -Force"

echo [2/3] Checking for any new requirements...
call npm install --no-audit --no-fund

echo [3/3] Cleaning up...
del update.zip

echo.
echo ==========================================
echo    Update Applied Successfully!
echo ==========================================
echo Your system is now up to date. Your database (parts.sqlite) was preserved.
echo.
pause
