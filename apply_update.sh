#!/bin/bash

# Exit immediately if any command exits with a non-zero status
set -e

echo "=========================================="
echo "   Installing System Update..."
echo "=========================================="
echo

if [ ! -f "update.zip" ]; then
    echo "[ERROR] Could not find 'update.zip'."
    echo "Please place the new 'update.zip' file in this folder and run this script again."
    read -p "Press Enter to exit..."
    exit 1
fi

echo "[1/3] Extracting new files from update.zip..."
if command -v unzip >/dev/null 2>&1; then
    unzip -o update.zip
else
    # Fallback to python if unzip is not available
    python3 -c "import zipfile; zipfile.ZipFile('update.zip').extractall('.')"
fi

echo "[2/3] Checking for any new requirements..."
npm install --no-audit --no-fund

echo "[3/3] Cleaning up..."
rm -f update.zip

echo
echo "=========================================="
echo "   Update Applied Successfully!"
echo "=========================================="
echo "Your system is now up to date. Your database (parts.sqlite) was preserved."
echo
read -p "Press Enter to exit..."
