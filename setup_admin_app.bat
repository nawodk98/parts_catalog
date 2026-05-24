@echo off
echo ===================================================
echo   Parts Catalog Mobile App - Admin Installer Setup
echo ===================================================
echo.
echo This script will set up your new separate Admin Android App.
echo It installs Expo dependencies and configures the native Android wrapper.
echo.
echo [1/3] Copying graphical assets from client app...
xcopy "PartsMobile\assets" "PartsMobileAdmin\assets" /E /I /H /Y

echo.
echo [2/3] Installing React Native and Expo dependencies...
cd PartsMobileAdmin
call npm install

echo.
echo [3/3] Generating native Android wrapper (package: com.nawodk98.partsmobile.admin)...
call npx expo prebuild --platform android --no-interactive

if %ERRORLEVEL% neq 0 (
    echo.
    echo ===================================================
    echo   SETUP ENCOUNTERED ERRORS
    echo ===================================================
    echo Prebuilding failed. Ensure you have Node, npm, and Expo CLI tools configured correctly.
    cd ..
    pause
    exit /b %ERRORLEVEL%
)

cd ..
echo.
echo ===================================================
echo   SETUP SUCCESSFUL!
echo ===================================================
echo Your separate Admin App is fully set up in: PartsMobileAdmin\
echo.
echo You can now build the APK by running: build_admin_apk.bat
echo or run a development server with: cd PartsMobileAdmin && npx expo start
echo.
pause
