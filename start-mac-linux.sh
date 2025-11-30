#!/bin/bash

echo ""
echo "========================================"
echo " NEXUS TV OS - OFFLINE APPLICATION"
echo "========================================"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo ""
    echo "Please download and install Node.js from:"
    echo "https://nodejs.org/"
    echo ""
    echo "Download the LTS version and install it."
    echo "Then restart your computer and run this script again."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "[OK] Node.js found"
node --version
echo ""

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm is not installed!"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "[OK] npm found"
npm --version
echo ""

echo "========================================"
echo "Installing dependencies (first time only)..."
echo "========================================"
echo ""

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install --verbose
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install dependencies!"
        echo ""
        echo "Try the following:"
        echo "1. Delete the 'node_modules' folder"
        echo "2. Delete 'package-lock.json'"
        echo "3. Run this script again"
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo "[OK] Dependencies installed successfully"
else
    echo "npm packages already installed"
fi

echo ""
echo "========================================"
echo "Starting Nexus TV OS..."
echo "========================================"
echo ""
echo "Application will open on: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
sleep 2

npm run dev
