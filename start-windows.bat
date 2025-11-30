@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo  NEXUS TV OS - OFFLINE APPLICATION
echo ========================================
echo.

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/
    echo.
    echo Download the LTS version and install it.
    echo Then restart your computer and run this script again.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found
node --version
echo.

REM Check for npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed!
    echo.
    pause
    exit /b 1
)

echo [OK] npm found
npm --version
echo.

echo ========================================
echo Installing dependencies (first time only)...
echo ========================================
echo.

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing npm packages...
    call npm install --verbose
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Failed to install dependencies!
        echo.
        echo Try the following:
        echo 1. Delete the "node_modules" folder
        echo 2. Delete "package-lock.json"
        echo 3. Run this script again
        echo.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully
) else (
    echo npm packages already installed
)

echo.
echo ========================================
echo Starting Nexus TV OS...
echo ========================================
echo.
echo Application will open on: http://localhost:5000
echo.
echo Press Ctrl+C to stop the server
echo.
timeout /t 2 /nobreak

call npm run dev

pause
