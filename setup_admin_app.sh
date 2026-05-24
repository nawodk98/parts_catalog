#!/bin/bash

# Exit immediately if any command exits with a non-zero status
set -e

echo "==================================================="
echo "  Parts Catalog Mobile App - Admin Installer Setup"
echo "==================================================="
echo
echo "This script will set up your new separate Admin Android App."
echo "It installs Expo dependencies and configures the native Android wrapper."
echo

echo "[1/3] Copying graphical assets from client app..."
mkdir -p PartsMobileAdmin/assets
cp -R PartsMobile/assets/* PartsMobileAdmin/assets/

echo
echo "[2/3] Installing React Native and Expo dependencies..."
cd PartsMobileAdmin
npm install

echo
echo "[3/3] Generating native Android wrapper (package: com.nawodk98.partsmobile.admin)..."
npx expo prebuild --platform android

echo
echo "==================================================="
echo "  SETUP SUCCESSFUL!"
echo "==================================================="
echo "Your separate Admin App is fully set up in: PartsMobileAdmin/"
echo
echo "You can now build the APK by running: ./build_admin_apk.sh"
echo "or run a development server with: cd PartsMobileAdmin && npx expo start"
echo
read -p "Press Enter to exit..."
