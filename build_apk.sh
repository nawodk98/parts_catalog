#!/bin/bash

# Exit immediately if any command exits with a non-zero status
set -e

echo "==================================================="
echo "  Parts Catalog Mobile App - APK Builder"
echo "==================================================="
echo
echo "This script will build the React Native (Expo) app into a standalone APK."
echo "Please ensure you have Java (JDK) installed on your system."
echo
echo "Starting build process..."
echo

cd PartsMobile/android
chmod +x gradlew
./gradlew assembleRelease

echo
echo "Build complete! Copying APK to the main folder..."
cd ../..
cp PartsMobile/android/app/build/outputs/apk/release/app-release.apk PartsMobile_Release.apk

echo
echo "==================================================="
echo "  BUILD SUCCESSFUL!"
echo "==================================================="
echo "Your APK file is ready: PartsMobile_Release.apk"
echo "You can now transfer this file to your Android device to install it."
echo
read -p "Press Enter to exit..."
