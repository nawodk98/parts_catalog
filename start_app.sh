#!/bin/bash

echo "========================================="
echo "   Starting Parts Catalog Server..."
echo "========================================="
echo

node server.js

echo
echo "Server gracefully stopped or encountered an error."
echo
read -p "Press Enter to exit..."
