#!/bin/bash

echo "========================================="
echo "   Starting Parts Catalog Server..."
echo "========================================="
echo

# Auto-detect if node_modules folder is missing
if [ ! -d "node_modules" ]; then
    echo "node_modules folder not found. Installing dependencies..."
    npm install
fi

# Verify if native modules are compatible with this OS (fixes invalid ELF header)
if ! node -e "require('sqlite3')" >/dev/null 2>&1; then
    echo "⚠️  Detected incompatible native modules (e.g., Windows binaries on Linux)."
    echo "Rebuilding packages for this system..."
    npm install || npm rebuild
fi

node server.js

echo
echo "Server gracefully stopped or encountered an error."
echo
read -p "Press Enter to exit..."
