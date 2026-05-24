@echo off
echo ===================================================
echo   Parts Catalog Mobile App - Admin APK Builder
echo ===================================================
echo.
echo This script will build the separate Admin React Native (Expo) app into a standalone APK.
echo Please ensure you have Java (JDK) and Android SDK paths set correctly.
echo.
echo Starting build process...
echo.

cd PartsMobileAdmin\android
call gradlew.bat assembleRelease

if %ERRORLEVEL% neq 0 (
    echo.
    echo ===================================================
    echo   BUILD FAILED
    echo ===================================================
    echo Check the error messages above. You may need to verify your Android build tools/Java configuration.
    cd ..\..
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Build complete! Copying Admin APK to the main folder...
cd ..\..
copy "PartsMobileAdmin\android\app\build\outputs\apk\release\app-release.apk" "PartsMobileAdmin_Release.apk"

echo.
echo ===================================================
echo   BUILD SUCCESSFUL!
echo ===================================================
echo Your Admin APK file is ready: PartsMobileAdmin_Release.apk
echo You can install this alongside your employee version.
echo.
pause
